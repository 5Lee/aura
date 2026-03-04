import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sanitizeTextInput } from "@/lib/security"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const profile = await prisma.invoiceProfile.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ profile })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = sanitizeTextInput(body.title, 160)
    const taxNumber = sanitizeTextInput(body.taxNumber, 80)
    const billingEmail = sanitizeTextInput(body.billingEmail, 160) || null
    const address = sanitizeTextInput(body.address, 280) || null
    const phone = sanitizeTextInput(body.phone, 60) || null
    const bankName = sanitizeTextInput(body.bankName, 120) || null
    const bankAccount = sanitizeTextInput(body.bankAccount, 120) || null

    if (!title || !taxNumber) {
      return NextResponse.json({ error: "发票抬头和税号不能为空" }, { status: 400 })
    }

    const profile = await prisma.invoiceProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        title,
        taxNumber,
        billingEmail,
        address,
        phone,
        bankName,
        bankAccount,
      },
      update: {
        title,
        taxNumber,
        billingEmail,
        address,
        phone,
        bankName,
        bankAccount,
      },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Save invoice profile failed:", error)
    return NextResponse.json({ error: "保存发票信息失败" }, { status: 500 })
  }
}
