import { PromptPublishStatus, PromptRole, type Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildInteropImportPreview,
  buildInteropProfileSeed,
  buildInteropRoundTripCheck,
  buildInteropExportPayload,
  sanitizeInteropProfileInput,
} from "@/lib/prompt-interoperability"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { hasPromptInteropAccess, getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"
import { findOrCreateTagByNameWithClient, normalizeTagNames } from "@/lib/tag-utils"

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as unknown[]
  }

  return value.slice(0, 400)
}

function toSummaryRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

async function applyPromptTagsWithClient(
  tx: Prisma.TransactionClient,
  promptId: string,
  tags: string[]
) {
  await tx.promptTag.deleteMany({ where: { promptId } })

  for (const tagName of tags) {
    const tag = await findOrCreateTagByNameWithClient(tx, tagName)
    if (!tag) {
      continue
    }

    await tx.promptTag.create({
      data: {
        promptId,
        tagId: tag.id,
      },
    })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPromptInteropAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "跨平台导入导出仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.promptInteropProfile.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.promptInteropProfile.createMany({
      data: buildInteropProfileSeed(session.user.id),
    })
  }

  const [profiles, jobs] = await Promise.all([
    prisma.promptInteropProfile.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
    }),
    prisma.promptInteropJob.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            platform: true,
            mode: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 160,
    }),
  ])

  return NextResponse.json({ profiles, jobs })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPromptInteropAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "跨平台导入导出仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeInteropProfileInput(body)

    const current = sanitized.id
      ? await prisma.promptInteropProfile.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const existing = await prisma.promptInteropProfile.findFirst({
      where: {
        userId: session.user.id,
        platform: sanitized.platform,
        mode: sanitized.mode,
        name: sanitized.name,
        NOT: current ? { id: current.id } : undefined,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      return NextResponse.json({ error: "同平台同模式下配置名称已存在" }, { status: 400 })
    }

    const profile = await prisma.promptInteropProfile.upsert({
      where: {
        id: current?.id || "__create_prompt_interop_profile__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        platform: sanitized.platform,
        mode: sanitized.mode,
        fieldMapping: sanitized.fieldMapping,
        conflictPolicy: sanitized.conflictPolicy,
        compatibilityMode: sanitized.compatibilityMode,
      },
      update: {
        name: sanitized.name,
        platform: sanitized.platform,
        mode: sanitized.mode,
        fieldMapping: sanitized.fieldMapping,
        conflictPolicy: sanitized.conflictPolicy,
        compatibilityMode: sanitized.compatibilityMode,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "interop.profile.upsert",
      resource: "interoperability",
      request,
      metadata: {
        profileId: profile.id,
        platform: profile.platform,
        mode: profile.mode,
      },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Save interoperability profile failed:", error)
    return NextResponse.json({ error: "保存跨平台适配配置失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPromptInteropAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "跨平台导入导出仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const action = sanitizeTextInput(body.action, 40).toLowerCase()

    if (action === "preview-import") {
      const profileId = sanitizeTextInput(body.profileId, 80)
      if (!profileId) {
        return NextResponse.json({ error: "profileId 不能为空" }, { status: 400 })
      }

      const profile = await prisma.promptInteropProfile.findFirst({
        where: {
          id: profileId,
          userId: session.user.id,
        },
      })

      if (!profile) {
        return NextResponse.json({ error: "适配配置不存在" }, { status: 404 })
      }

      const rows = normalizeRows(body.rows)
      const existingPrompts = await prisma.prompt.findMany({
        where: {
          authorId: session.user.id,
        },
        select: {
          sourceExternalId: true,
          title: true,
        },
        take: 2000,
      })

      const preview = buildInteropImportPreview({
        rows,
        mapping:
          profile.fieldMapping && typeof profile.fieldMapping === "object" && !Array.isArray(profile.fieldMapping)
            ? (profile.fieldMapping as Record<string, string>)
            : {},
        conflictPolicy: profile.conflictPolicy,
        existingByExternalId: new Set(
          existingPrompts
            .map((item) => sanitizeTextInput(item.sourceExternalId, 120))
            .filter(Boolean)
        ),
        existingByTitle: new Set(existingPrompts.map((item) => sanitizeTextInput(item.title, 160)).filter(Boolean)),
      })

      const job = await prisma.promptInteropJob.create({
        data: {
          userId: session.user.id,
          profileId: profile.id,
          platform: profile.platform,
          mode: profile.mode,
          status: "PREVIEW",
          payload: rows,
          previewSummary: {
            summary: preview.summary,
            items: preview.items,
          },
          appliedCount: 0,
          skippedCount: preview.summary.skipped,
          conflictCount: preview.summary.conflicts,
        },
      })

      await recordPromptAuditLog({
        actorId: session.user.id,
        action: "interop.import.preview",
        resource: "interoperability",
        request,
        metadata: {
          profileId: profile.id,
          jobId: job.id,
          total: preview.summary.total,
          conflicts: preview.summary.conflicts,
        },
      })

      return NextResponse.json({
        job,
        preview,
      })
    }

    if (action === "apply-import") {
      const jobId = sanitizeTextInput(body.jobId, 80)
      if (!jobId) {
        return NextResponse.json({ error: "jobId 不能为空" }, { status: 400 })
      }

      const job = await prisma.promptInteropJob.findFirst({
        where: {
          id: jobId,
          userId: session.user.id,
        },
        include: {
          profile: true,
        },
      })

      if (!job) {
        return NextResponse.json({ error: "预览任务不存在" }, { status: 404 })
      }

      const summary = toSummaryRecord(job.previewSummary)
      const items = Array.isArray(summary.items) ? summary.items : []

      const defaultCategory = await prisma.category.findFirst({
        select: {
          id: true,
        },
        orderBy: [{ createdAt: "asc" }],
      })

      if (!defaultCategory) {
        return NextResponse.json({ error: "请先创建至少一个分类后再导入" }, { status: 400 })
      }

      let created = 0
      let updated = 0
      let skipped = 0
      let conflicts = 0

      for (let index = 0; index < items.length; index += 1) {
        const row = toSummaryRecord(items[index])
        const actionName = sanitizeTextInput(row.action, 20).toLowerCase()
        const draft = toSummaryRecord(row.draft)
        const title = sanitizeTextInput(draft.title, 160)
        const content = String(draft.content || "").slice(0, 50000)
        const description = String(draft.description || "").slice(0, 4000)
        const externalId = sanitizeTextInput(draft.externalId, 120)
        const tags = normalizeTagNames(Array.isArray(draft.tags) ? draft.tags : [])

        if (!title || !content.trim() || actionName === "skip") {
          skipped += 1
          if (actionName === "skip") {
            conflicts += 1
          }
          continue
        }

        if (actionName === "update") {
          const existing = externalId
            ? await prisma.prompt.findFirst({
                where: {
                  authorId: session.user.id,
                  OR: [{ sourceExternalId: externalId }, { title }],
                },
              })
            : await prisma.prompt.findFirst({
                where: {
                  authorId: session.user.id,
                  title,
                },
              })

          if (!existing) {
            skipped += 1
            conflicts += 1
            continue
          }

          await prisma.$transaction(async (tx) => {
            await tx.prompt.update({
              where: {
                id: existing.id,
              },
              data: {
                title,
                content,
                description: description || null,
                sourceExternalId: externalId || existing.sourceExternalId,
              },
            })

            await applyPromptTagsWithClient(tx, existing.id, tags)
          })

          updated += 1
          continue
        }

        const createTitle =
          actionName === "duplicate"
            ? `${title} (import ${index + 1})`
            : title

        await prisma.$transaction(async (tx) => {
          const prompt = await tx.prompt.create({
            data: {
              title: createTitle,
              content,
              description: description || null,
              categoryId: defaultCategory.id,
              isPublic: false,
              publishStatus: PromptPublishStatus.DRAFT,
              authorId: session.user.id,
              sourceExternalId: externalId || null,
            },
          })

          await tx.promptMember.create({
            data: {
              promptId: prompt.id,
              userId: session.user.id,
              role: PromptRole.OWNER,
              invitedById: session.user.id,
            },
          })

          await applyPromptTagsWithClient(tx, prompt.id, tags)
        })

        created += 1
      }

      const updatedJob = await prisma.promptInteropJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: "APPLIED",
          appliedCount: created + updated,
          skippedCount: skipped,
          conflictCount: conflicts,
          errorMessage: null,
          previewSummary: {
            ...(summary || {}),
            applyResult: {
              created,
              updated,
              skipped,
              conflicts,
            },
          },
        },
      })

      await recordPromptAuditLog({
        actorId: session.user.id,
        action: "interop.import.apply",
        resource: "interoperability",
        request,
        metadata: {
          jobId: updatedJob.id,
          profileId: updatedJob.profileId,
          created,
          updated,
          skipped,
          conflicts,
        },
      })

      return NextResponse.json({
        job: updatedJob,
        result: {
          created,
          updated,
          skipped,
          conflicts,
        },
      })
    }

    if (action === "export") {
      const profileId = sanitizeTextInput(body.profileId, 80)
      if (!profileId) {
        return NextResponse.json({ error: "profileId 不能为空" }, { status: 400 })
      }

      const profile = await prisma.promptInteropProfile.findFirst({
        where: {
          id: profileId,
          userId: session.user.id,
        },
      })

      if (!profile) {
        return NextResponse.json({ error: "适配配置不存在" }, { status: 404 })
      }

      const promptIds = Array.isArray(body.promptIds)
        ? body.promptIds.map((item) => sanitizeTextInput(item, 80)).filter(Boolean)
        : []

      const prompts = await prisma.prompt.findMany({
        where: {
          OR: [{ authorId: session.user.id }, { members: { some: { userId: session.user.id } } }],
          ...(promptIds.length > 0 ? { id: { in: promptIds } } : {}),
        },
        include: {
          category: {
            select: {
              slug: true,
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  name: true,
                },
              },
            },
          },
          templateVariables: {
            orderBy: { name: "asc" },
          },
          testCases: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 400,
      })

      const exportPayload = buildInteropExportPayload({
        prompts: prompts.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          description: item.description,
          sourceExternalId: item.sourceExternalId,
          updatedAt: item.updatedAt,
          tags: item.tags.map((tag) => tag.tag.name),
          categorySlug: item.category.slug,
          isPublic: item.isPublic,
          publishStatus: item.publishStatus,
          templateVariables: item.templateVariables.map((variable) => ({
            name: variable.name,
            type: variable.type,
            required: variable.required,
            defaultValue: variable.defaultValue,
            description: variable.description,
            options: variable.options,
          })),
          testCases: item.testCases.map((testCase) => ({
            name: testCase.name,
            assertionType: testCase.assertionType,
            expectedOutput: testCase.expectedOutput,
            enabled: testCase.enabled,
            inputVariables: testCase.inputVariables,
          })),
        })),
        platform: profile.platform,
        compatibilityMode: profile.compatibilityMode,
      })

      const preview = buildInteropImportPreview({
        rows: exportPayload,
        mapping:
          profile.fieldMapping && typeof profile.fieldMapping === "object" && !Array.isArray(profile.fieldMapping)
            ? (profile.fieldMapping as Record<string, string>)
            : {},
        conflictPolicy: "skip",
        existingByExternalId: new Set<string>(),
        existingByTitle: new Set<string>(),
      })

      const roundTrip = buildInteropRoundTripCheck({
        previewItems: preview.items.map((item) => ({ draft: item.draft })),
        exportedPayload: exportPayload,
        mapping:
          profile.fieldMapping && typeof profile.fieldMapping === "object" && !Array.isArray(profile.fieldMapping)
            ? (profile.fieldMapping as Record<string, string>)
            : {},
      })

      const job = await prisma.promptInteropJob.create({
        data: {
          userId: session.user.id,
          profileId: profile.id,
          platform: profile.platform,
          mode: profile.mode,
          status: "EXPORTED",
          exportedPayload: exportPayload,
          previewSummary: {
            summary: {
              exported: exportPayload.length,
            },
            roundTrip,
          },
          appliedCount: 0,
          skippedCount: 0,
          conflictCount: roundTrip.lossless ? 0 : roundTrip.previewCount - roundTrip.matched,
        },
      })

      await recordPromptAuditLog({
        actorId: session.user.id,
        action: "interop.export.run",
        resource: "interoperability",
        request,
        metadata: {
          jobId: job.id,
          profileId: profile.id,
          exported: exportPayload.length,
          lossless: roundTrip.lossless,
        },
      })

      return NextResponse.json({
        job,
        exportedPayload: exportPayload,
        roundTrip,
      })
    }

    return NextResponse.json({ error: "不支持的操作类型" }, { status: 400 })
  } catch (error) {
    console.error("Interoperability action failed:", error)
    return NextResponse.json({ error: "跨平台适配处理失败" }, { status: 500 })
  }
}
