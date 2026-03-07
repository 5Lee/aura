import { PrismaAdapter } from "@next-auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

import { verifyUserCredentials } from "./auth-credentials"
import { validateLoginProof } from "./auth-login-guard"
import { prisma } from "./db"
import { getCredentialGuardForEmail } from "./sso-server"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
        tenant: { label: "租户", type: "text" },
        loginProof: { label: "登录校验", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码")
        }

        const credentialGuard = await getCredentialGuardForEmail(credentials.email)
        if (!credentialGuard.allowed) {
          throw new Error(credentialGuard.reason || "当前企业已启用强制 SSO，请使用企业单点登录。")
        }

        const loginProof = typeof credentials.loginProof === "string" ? credentials.loginProof : ""
        const tenant = typeof credentials.tenant === "string" ? credentials.tenant : ""
        if (
          !validateLoginProof({
            token: loginProof,
            email: credentials.email,
            password: credentials.password,
            tenant,
            request: req,
          })
        ) {
          throw new Error("登录校验已失效，请重试")
        }

        const user = await verifyUserCredentials(credentials.email, credentials.password)
        if (!user) {
          throw new Error("邮箱或密码错误")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
