import * as bcrypt from "bcryptjs"

import { prisma } from "@/lib/db"

export async function verifyUserCredentials(email: string, password: string) {
  const normalizedEmail = email.trim()
  if (!normalizedEmail || !password) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user?.password) {
    return null
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return null
  }

  return user
}
