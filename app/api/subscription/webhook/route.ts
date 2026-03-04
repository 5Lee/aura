import {
  BillingEventProcessStatus,
  BillingProvider,
  SubscriptionStatus,
} from "@prisma/client"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { getBillingProvider, resolveBillingProviderName } from "@/lib/subscription-billing"
import { buildSubscriptionPatchFromWebhook, normalizeBillingCycle } from "@/lib/subscription-lifecycle"

function getProviderFromRequest(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const provider = searchParams.get("provider") ?? request.headers.get("x-aura-billing-provider")
  return resolveBillingProviderName(provider)
}

function getWebhookSecret(provider: BillingProvider) {
  const providerSecret = process.env[`AURA_BILLING_WEBHOOK_SECRET_${provider}`]
  return providerSecret ?? process.env.AURA_BILLING_WEBHOOK_SECRET ?? ""
}

export async function POST(request: Request) {
  const providerName = getProviderFromRequest(request)
  const provider = getBillingProvider(providerName)
  const rawBody = await request.text()
  const signature = request.headers.get("x-aura-signature") ?? ""
  const secret = getWebhookSecret(provider.name)

  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  if (!provider.verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
  }

  let parsedEvent
  try {
    parsedEvent = provider.parseWebhookEvent(rawBody)
  } catch (error) {
    return NextResponse.json(
      { error: `Invalid webhook payload: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 400 }
    )
  }

  const existingEvent = await prisma.billingEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: parsedEvent.provider,
        providerEventId: parsedEvent.providerEventId,
      },
    },
  })

  if (existingEvent?.status === BillingEventProcessStatus.PROCESSED) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      billingEventId: existingEvent.id,
    })
  }

  const billingEvent = await prisma.billingEvent.upsert({
    where: {
      provider_providerEventId: {
        provider: parsedEvent.provider,
        providerEventId: parsedEvent.providerEventId,
      },
    },
    create: {
      provider: parsedEvent.provider,
      providerEventId: parsedEvent.providerEventId,
      type: parsedEvent.type,
      status: BillingEventProcessStatus.RECEIVED,
      payload: parsedEvent.payload,
      receivedAt: parsedEvent.occurredAt,
    },
    update: {
      type: parsedEvent.type,
      status: BillingEventProcessStatus.RECEIVED,
      payload: parsedEvent.payload,
      errorMessage: null,
      processedAt: null,
    },
  })

  try {
    let subscription = parsedEvent.data.externalSubscriptionId
      ? await prisma.subscription.findUnique({
          where: {
            externalSubscriptionId: parsedEvent.data.externalSubscriptionId,
          },
        })
      : null

    if (!subscription && parsedEvent.data.userId && parsedEvent.data.planId) {
      subscription = await prisma.subscription.create({
        data: {
          userId: parsedEvent.data.userId,
          provider: parsedEvent.provider,
          externalCustomerId: parsedEvent.data.externalCustomerId,
          externalSubscriptionId: parsedEvent.data.externalSubscriptionId,
          planId: parsedEvent.data.planId,
          cycle: normalizeBillingCycle(parsedEvent.data.cycle),
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: parsedEvent.data.cancelAtPeriodEnd ?? false,
          trialEndsAt: parsedEvent.data.trialEndsAt ?? null,
          currentPeriodStart: parsedEvent.data.currentPeriodStart ?? null,
          currentPeriodEnd: parsedEvent.data.currentPeriodEnd ?? null,
          metadata: parsedEvent.data.metadata,
        },
      })
    }

    if (!subscription) {
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          status: BillingEventProcessStatus.IGNORED,
          processedAt: new Date(),
          errorMessage: "Subscription not found for webhook event",
        },
      })
      return NextResponse.json({ ok: true, ignored: true, reason: "subscription_not_found" })
    }

    const patch = buildSubscriptionPatchFromWebhook(parsedEvent, subscription.status)
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: patch,
    })

    await prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: {
        status: BillingEventProcessStatus.PROCESSED,
        processedAt: new Date(),
        subscriptionId: updated.id,
        userId: updated.userId,
      },
    })

    return NextResponse.json({
      ok: true,
      idempotent: false,
      subscriptionId: updated.id,
      status: updated.status,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    await prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: {
        status: BillingEventProcessStatus.FAILED,
        processedAt: new Date(),
        errorMessage: message.slice(0, 2000),
      },
    })

    return NextResponse.json({ error: "Webhook processing failed", detail: message }, { status: 500 })
  }
}
