import { randomUUID } from "node:crypto"

const parseCookieHeader = (cookieHeader = "") => {
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, pair) => {
      const separatorIndex = pair.indexOf("=")
      if (separatorIndex <= 0) {
        return accumulator
      }

      const name = pair.slice(0, separatorIndex).trim()
      const value = pair.slice(separatorIndex + 1).trim()
      accumulator[name] = value
      return accumulator
    }, {})
}

const createHeaders = (setCookieValues = []) => {
  return {
    getSetCookie: () => setCookieValues,
    get: (name) => {
      if (name.toLowerCase() !== "set-cookie") {
        return null
      }

      return setCookieValues[0] ?? null
    },
  }
}

const createResponse = (status, payload, setCookieValues = []) => {
  return {
    status,
    headers: createHeaders(setCookieValues),
    json: async () => payload,
  }
}

export const createAuthFlowFixture = () => {
  const users = new Map()
  const sessions = new Map()

  return {
    async register({ name, email, password }) {
      const normalizedEmail = String(email ?? "").trim().toLowerCase()
      const normalizedName = String(name ?? "").trim()
      const normalizedPassword = String(password ?? "")

      if (!normalizedEmail || !normalizedPassword) {
        return createResponse(400, { error: "邮箱和密码不能为空" })
      }

      if (users.has(normalizedEmail)) {
        return createResponse(400, { error: "该邮箱已被注册" })
      }

      users.set(normalizedEmail, {
        id: randomUUID(),
        email: normalizedEmail,
        name: normalizedName || "Playwright User",
        password: normalizedPassword,
      })

      return createResponse(201, {
        message: "注册成功",
        redirectTo: "/login?registered=true",
      })
    },

    async login({ email, password }) {
      const normalizedEmail = String(email ?? "").trim().toLowerCase()
      const normalizedPassword = String(password ?? "")
      const user = users.get(normalizedEmail)

      if (!user || user.password !== normalizedPassword) {
        return createResponse(401, { error: "邮箱或密码错误" })
      }

      const sessionToken = randomUUID()
      sessions.set(sessionToken, user.email)

      return createResponse(
        200,
        {
          message: "登录成功",
          redirectTo: "/dashboard",
          sessionToken,
        },
        [`aura_session=${sessionToken}; Path=/; HttpOnly`]
      )
    },

    async accessDashboard(cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader)
      const sessionToken = cookies.aura_session

      if (!sessionToken || !sessions.has(sessionToken)) {
        return createResponse(302, { redirectTo: "/login" })
      }

      const email = sessions.get(sessionToken)
      const user = users.get(email)

      return createResponse(200, {
        message: "Dashboard",
        userName: user?.name ?? "User",
      })
    },

    async logout(cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader)
      const sessionToken = cookies.aura_session

      if (sessionToken) {
        sessions.delete(sessionToken)
      }

      return createResponse(
        200,
        { message: "退出成功", redirectTo: "/" },
        ["aura_session=; Path=/; Max-Age=0"]
      )
    },
  }
}
