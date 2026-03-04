import * as bcrypt from "bcryptjs"

import { prisma } from "@/lib/db"
import { getCredentialGuardForEmail } from "@/lib/sso-server"

export async function verifyUserCredentials(email: string, password: string) {
  const normalizedEmail = email.trim()
  if (!normalizedEmail || !password) {
    return null
  }

  const guard = await getCredentialGuardForEmail(normalizedEmail)
  if (!guard.allowed) {
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
