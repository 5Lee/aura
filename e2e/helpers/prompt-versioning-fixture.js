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

const cloneVersionData = (prompt) => {
  return {
    id: randomUUID(),
    promptId: prompt.id,
    version: prompt.versions.length + 1,
    source: "UPDATE",
    changeSummary: null,
    title: prompt.title,
    content: prompt.content,
    description: prompt.description,
    categoryId: prompt.categoryId,
    isPublic: prompt.isPublic,
    tags: [...prompt.tags],
    createdAt: new Date().toISOString(),
  }
}

export const createPromptVersioningFixture = () => {
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

    return { sessionToken, userEmail }
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

      return createResponse(201, { message: "注册成功" })
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
      if (!title || !content) {
        return createResponse(400, { error: "标题和内容不能为空" })
      }

      const promptId = randomUUID()
      const prompt = {
        id: promptId,
        title,
        content,
        description: String(payload?.description ?? ""),
        categoryId: String(payload?.categoryId ?? "general"),
        isPublic: Boolean(payload?.isPublic),
        tags: Array.isArray(payload?.tags)
          ? payload.tags.map((item) => String(item).trim()).filter(Boolean)
          : [],
        userEmail: session.userEmail,
        versions: [],
      }

      const initialVersion = {
        ...cloneVersionData(prompt),
        version: 1,
        source: "CREATE",
        changeSummary: "Initial prompt version",
      }
      prompt.versions.push(initialVersion)

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
      if (!nextTitle || !nextContent) {
        return createResponse(400, { error: "标题和内容不能为空" })
      }

      prompt.title = nextTitle
      prompt.content = nextContent
      prompt.description =
        payload?.description === undefined ? prompt.description : String(payload.description)
      prompt.isPublic = payload?.isPublic === undefined ? prompt.isPublic : Boolean(payload.isPublic)
      prompt.tags = Array.isArray(payload?.tags)
        ? payload.tags.map((item) => String(item).trim()).filter(Boolean)
        : prompt.tags

      const version = {
        ...cloneVersionData(prompt),
        source: "UPDATE",
        changeSummary: "Prompt updated via PATCH",
      }
      prompt.versions.push(version)

      return createResponse(200, {
        message: "提示词更新成功",
        prompt,
      })
    },

    async listVersions(cookieHeader, promptId) {
      const session = resolveSession(cookieHeader)
      if (!session) {
        return createResponse(401, { error: "未授权" })
      }

      const prompt = prompts.get(promptId)
      if (!prompt || prompt.userEmail !== session.userEmail) {
        return createResponse(404, { error: "提示词不存在" })
      }

      const versions = [...prompt.versions].sort((a, b) => b.version - a.version)
      return createResponse(200, versions)
    },

    async rollbackPrompt(cookieHeader, promptId, { versionId, reason, confirmHighRisk }) {
      const session = resolveSession(cookieHeader)
      if (!session) {
        return createResponse(401, { error: "未授权" })
      }

      const prompt = prompts.get(promptId)
      if (!prompt || prompt.userEmail !== session.userEmail) {
        return createResponse(404, { error: "提示词不存在" })
      }

      const targetVersion = prompt.versions.find((item) => item.id === versionId)
      if (!targetVersion) {
        return createResponse(404, { error: "目标版本不存在" })
      }

      const latestVersion = prompt.versions[prompt.versions.length - 1]
      const rollbackDistance = Math.max(0, latestVersion.version - targetVersion.version)
      const isHighRiskRollback = rollbackDistance >= 3
      if (isHighRiskRollback && confirmHighRisk !== true) {
        return createResponse(400, { error: "高风险回滚需要二次确认" })
      }

      prompt.title = targetVersion.title
      prompt.content = targetVersion.content
      prompt.description = targetVersion.description
      prompt.categoryId = targetVersion.categoryId
      prompt.isPublic = targetVersion.isPublic
      prompt.tags = Array.isArray(targetVersion.tags) ? [...targetVersion.tags] : []

      const rollbackVersion = {
        ...cloneVersionData(prompt),
        source: "ROLLBACK",
        changeSummary: reason || `Rollback to version ${targetVersion.version}`,
      }
      prompt.versions.push(rollbackVersion)

      return createResponse(200, {
        message: "回滚成功",
        prompt,
        rollbackVersion,
      })
    },
  }
}
