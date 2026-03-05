import {
  ConnectorCheckStatus,
  ConnectorProvider,
  ConnectorStatus,
} from "@prisma/client"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type ConnectorPreset = {
  name: string
  provider: ConnectorProvider
  apiBaseUrl: string
}

export const DEFAULT_CONNECTOR_PRESETS: ConnectorPreset[] = [
  {
    name: "OpenAI Production",
    provider: ConnectorProvider.OPENAI,
    apiBaseUrl: "https://api.openai.com/v1",
  },
  {
    name: "Langfuse Tracking",
    provider: ConnectorProvider.LANGFUSE,
    apiBaseUrl: "https://cloud.langfuse.com",
  },
]

function resolveKeyMaterial() {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "aura-connector-fallback"
  return createHash("sha256").update(raw).digest()
}

export function maskCredential(value: string) {
  const normalized = sanitizeTextInput(value, 400)
  if (!normalized) {
    return ""
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
  }

  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`
}

export function fingerprintCredential(value: string) {
  const normalized = sanitizeTextInput(value, 1000)
  if (!normalized) {
    return ""
  }

  return createHash("sha256").update(normalized).digest("hex").slice(0, 20)
}

export function encryptConnectorCredential(value: string) {
  const normalized = sanitizeTextInput(value, 2000)
  if (!normalized) {
    return ""
  }

  const iv = randomBytes(12)
  const key = resolveKeyMaterial()
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".")
}

export function decryptConnectorCredential(value: string) {
  const normalized = sanitizeTextInput(value, 4000)
  if (!normalized) {
    return ""
  }

  try {
    const [ivPart, tagPart, encryptedPart] = normalized.split(".")
    if (!ivPart || !tagPart || !encryptedPart) {
      return ""
    }

    const iv = Buffer.from(ivPart, "base64")
    const tag = Buffer.from(tagPart, "base64")
    const encrypted = Buffer.from(encryptedPart, "base64")
    const key = resolveKeyMaterial()

    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return sanitizeTextInput(decrypted.toString("utf8"), 2000)
  } catch {
    return ""
  }
}

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

export function normalizeConnectorProvider(value: unknown) {
  const normalized = sanitizeTextInput(value, 40).toUpperCase()

  if (normalized === ConnectorProvider.OPENAI) {
    return ConnectorProvider.OPENAI
  }
  if (normalized === ConnectorProvider.ANTHROPIC) {
    return ConnectorProvider.ANTHROPIC
  }
  if (normalized === ConnectorProvider.LANGFUSE) {
    return ConnectorProvider.LANGFUSE
  }
  if (normalized === ConnectorProvider.PROMPTFOO) {
    return ConnectorProvider.PROMPTFOO
  }
  if (normalized === ConnectorProvider.OPENWEBUI) {
    return ConnectorProvider.OPENWEBUI
  }
  if (normalized === ConnectorProvider.CUSTOM) {
    return ConnectorProvider.CUSTOM
  }

  return ConnectorProvider.CUSTOM
}

export function normalizeConnectorStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()

  if (normalized === ConnectorStatus.ACTIVE) {
    return ConnectorStatus.ACTIVE
  }
  if (normalized === ConnectorStatus.DEGRADED) {
    return ConnectorStatus.DEGRADED
  }
  if (normalized === ConnectorStatus.DISABLED) {
    return ConnectorStatus.DISABLED
  }

  return ConnectorStatus.DISABLED
}

export function sanitizeConnectorInput(input: unknown, fallback = DEFAULT_CONNECTOR_PRESETS[0]) {
  const source = normalizeRecord(input)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    provider: normalizeConnectorProvider(source.provider || fallback.provider),
    status: normalizeConnectorStatus(source.status),
    apiBaseUrl: sanitizeTextInput(source.apiBaseUrl, 300) || fallback.apiBaseUrl,
    credential: sanitizeTextInput(source.credential, 2000),
    note: sanitizeMultilineTextInput(source.note, 300).trim(),
  }
}

export function buildConnectorSeed(userId: string) {
  return DEFAULT_CONNECTOR_PRESETS.map((item) => ({
    userId,
    name: item.name,
    provider: item.provider,
    status: ConnectorStatus.DISABLED,
    apiBaseUrl: item.apiBaseUrl,
    credentialCipher: null,
    credentialPreview: null,
    credentialFingerprint: null,
    secretVersion: 1,
  }))
}

export function resolveConnectorHealthCheck({
  connector,
  credential,
}: {
  connector: {
    status: ConnectorStatus
    provider: ConnectorProvider
    name: string
    apiBaseUrl: string | null
  }
  credential: string
}) {
  if (!credential) {
    return {
      status: ConnectorCheckStatus.FAIL,
      message: "缺少认证凭据",
      latencyMs: 0,
      diagnostics: {
        code: "missing-credential",
        provider: connector.provider,
      },
    }
  }

  if (connector.status === ConnectorStatus.DISABLED) {
    return {
      status: ConnectorCheckStatus.WARN,
      message: "连接器已禁用，未执行外部请求",
      latencyMs: 0,
      diagnostics: {
        code: "connector-disabled",
        provider: connector.provider,
      },
    }
  }

  const baseline = 90 + connector.name.length * 3 + connector.provider.length * 2
  const latencyMs = Math.min(900, baseline)

  if (latencyMs > 500 || !connector.apiBaseUrl) {
    return {
      status: ConnectorCheckStatus.WARN,
      message: "连接成功但延迟偏高或端点配置待优化",
      latencyMs,
      diagnostics: {
        code: "latency-warning",
        provider: connector.provider,
        endpointConfigured: Boolean(connector.apiBaseUrl),
      },
    }
  }

  return {
    status: ConnectorCheckStatus.PASS,
    message: "连接健康检查通过",
    latencyMs,
    diagnostics: {
      code: "ok",
      provider: connector.provider,
    },
  }
}
