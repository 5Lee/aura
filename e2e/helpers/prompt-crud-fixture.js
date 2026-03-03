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

export const createPromptCrudFixture = () => {
  const users = new Map()
  const sessions = new Map()
  const prompts = new Map()

  const resolveSession = (cookieHeader) => {
    const cookies = parseCookieHeader(cookieHeader)
    const sessionToken = cookies.aura_session
    const userEmail = sessions.get(sessionToken)

    if (!sessionToken || !userEmail) {
      return null
    }

    return {
      sessionToken,
      userEmail,
    }
  }

  return {
    async register({ name, email, password }) {
      const normalizedEmail = String(email ?? "").trim().toLowerCase()
      const normalizedPassword = String(password ?? "")
      const normalizedName = String(name ?? "").trim()

      if (!normalizedEmail || !normalizedPassword) {
        return createResponse(400, { error: "邮箱和密码不能为空" })
      }

      if (users.has(normalizedEmail)) {
        return createResponse(400, { error: "该邮箱已被注册" })
      }

      users.set(normalizedEmail, {
        id: randomUUID(),
        name: normalizedName || "Playwright User",
        email: normalizedEmail,
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

    async createPrompt(cookieHeader, payload) {
      const session = resolveSession(cookieHeader)
      if (!session) {
        return createResponse(401, { error: "未授权" })
      }

      const title = String(payload?.title ?? "").trim()
      const content = String(payload?.content ?? "").trim()
      const tags = Array.isArray(payload?.tags)
        ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : []

      if (!title || !content) {
        return createResponse(400, { error: "标题和内容不能为空" })
      }

      const promptId = randomUUID()
      const prompt = {
        id: promptId,
        title,
        content,
        tags,
        userEmail: session.userEmail,
        createdAt: new Date().toISOString(),
      }

      prompts.set(promptId, prompt)

      return createResponse(201, {
        message: "提示词创建成功",
        prompt,
      })
    },

    async updatePrompt(cookieHeader, promptId, payload) {
      const session = resolveSession(cookieHeader)
      if (!session) {
        return createResponse(401, { error: "未授权" })
      }

      const prompt = prompts.get(promptId)
      if (!prompt || prompt.userEmail !== session.userEmail) {
        return createResponse(404, { error: "提示词不存在" })
      }

      const nextTitle = String(payload?.title ?? prompt.title).trim()
      const nextContent = String(payload?.content ?? prompt.content).trim()
      const nextTags = Array.isArray(payload?.tags)
        ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : prompt.tags

      if (!nextTitle || !nextContent) {
        return createResponse(400, { error: "标题和内容不能为空" })
      }

      const updatedPrompt = {
        ...prompt,
        title: nextTitle,
        content: nextContent,
        tags: nextTags,
        updatedAt: new Date().toISOString(),
      }

      prompts.set(promptId, updatedPrompt)

      return createResponse(200, {
        message: "提示词更新成功",
        prompt: updatedPrompt,
      })
    },

    async deletePrompt(cookieHeader, promptId) {
      const session = resolveSession(cookieHeader)
      if (!session) {
        return createResponse(401, { error: "未授权" })
      }

      const prompt = prompts.get(promptId)
      if (!prompt || prompt.userEmail !== session.userEmail) {
        return createResponse(404, { error: "提示词不存在" })
      }

      prompts.delete(promptId)

      return createResponse(200, {
        message: "提示词删除成功",
      })
    },

    async getPrompt(cookieHeader, promptId) {
      const session = resolveSession(cookieHeader)
      if (!session) {
        return createResponse(401, { error: "未授权" })
      }

      const prompt = prompts.get(promptId)
      if (!prompt || prompt.userEmail !== session.userEmail) {
        return createResponse(404, { error: "提示词不存在" })
      }

      return createResponse(200, {
        prompt,
      })
    },
  }
}
