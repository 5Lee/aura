import { sanitizeTextInput } from "@/lib/security"

type RedisCommandPart = string | number

type RedisCommandResponse<T> = {
  ok: boolean
  result: T | null
}

type SlotClaimResult = {
  acquired: boolean
  retryAfterSeconds: number
  source: "upstash" | "fallback"
}

const resolveUpstashRedisConfig = () => {
  const url = sanitizeTextInput(process.env.UPSTASH_REDIS_REST_URL, 260).replace(/\/+$/, "")
  const token = sanitizeTextInput(process.env.UPSTASH_REDIS_REST_TOKEN, 260)

  if (!url || !token) {
    return null
  }

  return {
    url,
    token,
  }
}

async function runRedisCommand<T>(command: RedisCommandPart[]): Promise<RedisCommandResponse<T>> {
  const config = resolveUpstashRedisConfig()
  if (!config) {
    return {
      ok: false,
      result: null,
    }
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    })

    if (!response.ok) {
      return {
        ok: false,
        result: null,
      }
    }

    const payload = (await response.json()) as {
      result?: T | null
      error?: string
    }

    if (payload?.error) {
      return {
        ok: false,
        result: null,
      }
    }

    return {
      ok: true,
      result: (payload?.result ?? null) as T | null,
    }
  } catch {
    return {
      ok: false,
      result: null,
    }
  }
}

function normalizeRedisNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.floor(parsed))
}

export function isDistributedRateLimitEnabled() {
  return Boolean(resolveUpstashRedisConfig())
}

export async function claimDistributedRateLimitSlot(
  key: string,
  ttlSeconds: number
): Promise<SlotClaimResult> {
  const setResponse = await runRedisCommand<string>(["SET", key, "1", "EX", ttlSeconds, "NX"])
  if (!setResponse.ok) {
    return {
      acquired: false,
      retryAfterSeconds: 0,
      source: "fallback",
    }
  }

  if (setResponse.result === "OK") {
    return {
      acquired: true,
      retryAfterSeconds: ttlSeconds,
      source: "upstash",
    }
  }

  const ttlResponse = await runRedisCommand<number>(["TTL", key])
  return {
    acquired: false,
    retryAfterSeconds: ttlResponse.ok ? normalizeRedisNumber(ttlResponse.result) || ttlSeconds : ttlSeconds,
    source: "upstash",
  }
}

export async function incrementDistributedRateLimitCounter(key: string, ttlSeconds: number) {
  const incrementResponse = await runRedisCommand<number>(["INCR", key])
  if (!incrementResponse.ok) {
    return {
      count: 0,
      retryAfterSeconds: 0,
      source: "fallback" as const,
    }
  }

  const count = normalizeRedisNumber(incrementResponse.result)
  let retryAfterSeconds = 0

  const ttlResponse = await runRedisCommand<number>(["TTL", key])
  retryAfterSeconds = ttlResponse.ok ? normalizeRedisNumber(ttlResponse.result) : 0

  if (retryAfterSeconds <= 0) {
    await runRedisCommand(["EXPIRE", key, ttlSeconds])
    retryAfterSeconds = ttlSeconds
  }

  return {
    count,
    retryAfterSeconds,
    source: "upstash" as const,
  }
}

export async function getDistributedRateLimitCounter(key: string) {
  const valueResponse = await runRedisCommand<string | number>(["GET", key])
  if (!valueResponse.ok) {
    return {
      count: 0,
      retryAfterSeconds: 0,
      source: "fallback" as const,
    }
  }

  const ttlResponse = await runRedisCommand<number>(["TTL", key])
  return {
    count: normalizeRedisNumber(valueResponse.result),
    retryAfterSeconds: ttlResponse.ok ? normalizeRedisNumber(ttlResponse.result) : 0,
    source: "upstash" as const,
  }
}

export async function clearDistributedRateLimitKeys(keys: string[]) {
  const filteredKeys = keys.filter(Boolean)
  if (filteredKeys.length === 0) {
    return false
  }

  const result = await runRedisCommand<number>(["DEL", ...filteredKeys])
  return result.ok
}
