import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import { getSsoRuntimePolicy } from "@/lib/sso-server"
import { sanitizeTextInput } from "@/lib/security"

export async function POST(request: Request) {
  try {
    const { name, email, password, tenant } = await request.json()
    const normalizedEmail = sanitizeTextInput(email, 160).toLowerCase()
    const tenantDomain = sanitizeTextInput(tenant, 120).toLowerCase()

    // Validate input
    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少为6位" },
        { status: 400 }
      )
    }

    if (tenantDomain) {
      const runtime = await getSsoRuntimePolicy({ tenantDomain })
      if (runtime.enabled && runtime.enforceSso && !runtime.allowLocalFallback) {
        return NextResponse.json(
          { error: "当前企业已启用强制 SSO，请使用企业单点登录完成注册。" },
          { status: 403 }
        )
      }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name: sanitizeTextInput(name, 80) || null,
        email: normalizedEmail,
        password: hashedPassword,
      },
    })

    return NextResponse.json(
      { message: "注册成功", userId: user.id },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "注册失败，请重试" },
      { status: 500 }
    )
  }
}
