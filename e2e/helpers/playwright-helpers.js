import { readFile } from "node:fs/promises"
import { mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const acceptedMcpPackages = ["@playwright/mcp", "@anthropic-ai/mcp-server-playwright"]

export const resolveE2EUrl = (pathname, baseURL = "http://127.0.0.1:3000") => {
  return new URL(pathname, baseURL).toString()
}

export const readMcpConfig = async (cwd = process.cwd()) => {
  const content = await readFile(path.join(cwd, ".mcp.json"), "utf8")
  return JSON.parse(content)
}

export const getPlaywrightMcpServer = (mcpConfig) => {
  return mcpConfig?.mcpServers?.playwright ?? null
}

export const isValidPlaywrightMcpServer = (server) => {
  if (!server || server.command !== "npx" || !Array.isArray(server.args)) {
    return false
  }

  return server.args.some((arg) => acceptedMcpPackages.includes(arg))
}

export const ensureValidPlaywrightMcp = async () => {
  const mcpConfig = await readMcpConfig()
  const server = getPlaywrightMcpServer(mcpConfig)

  if (!isValidPlaywrightMcpServer(server)) {
    throw new Error(".mcp.json missing a valid playwright MCP server entry")
  }

  return server
}

export const openInlineHtml = async (page, html) => {
  const encoded = encodeURIComponent(html)
  await page.goto(`data:text/html,${encoded}`)
}

const normalizeSetCookieHeader = (headers) => {
  if (!headers) {
    return []
  }

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie()
  }

  const singleValue = headers.get?.("set-cookie")
  return singleValue ? [singleValue] : []
}

export const updateCookieJar = (cookieJar, headers) => {
  const setCookieHeaders = normalizeSetCookieHeader(headers)

  for (const entry of setCookieHeaders) {
    const [nameValue = "", ...attributes] = entry.split(";").map((part) => part.trim())
    const separatorIndex = nameValue.indexOf("=")

    if (separatorIndex <= 0) {
      continue
    }

    const name = nameValue.slice(0, separatorIndex)
    const value = nameValue.slice(separatorIndex + 1)
    const shouldDelete = attributes.some((attribute) =>
      attribute.toLowerCase().startsWith("max-age=0")
    )

    if (!value || shouldDelete) {
      delete cookieJar[name]
      continue
    }

    cookieJar[name] = value
  }

  return cookieJar
}

export const createCookieHeader = (cookieJar) => {
  return Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

export const createPlaywrightArtifactDir = async (prefix = "aura-playwright-") => {
  return mkdtemp(path.join(tmpdir(), prefix))
}

const sanitizeArtifactName = (value) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const captureStepScreenshot = async (page, outputDir, stepName) => {
  await mkdir(outputDir, { recursive: true })
  const filename = `${sanitizeArtifactName(stepName)}.png`
  const filePath = path.join(outputDir, filename)
  const content = await page.screenshot({ path: filePath })

  return {
    filePath,
    size: content.length,
  }
}
