interface PerfCacheEntry<T> {
  value: T
  expiresAt: number
  tags: string[]
}

interface PerfCacheOptions {
  ttlMs?: number
  tags?: string[]
}

const DEFAULT_TTL_MS = 15000
const cacheStore = new Map<string, PerfCacheEntry<unknown>>()
const tagIndex = new Map<string, Set<string>>()

function registerTag(tag: string, key: string) {
  const keys = tagIndex.get(tag) || new Set<string>()
  keys.add(key)
  tagIndex.set(tag, keys)
}

function unregisterKeyFromTags(key: string, tags: string[]) {
  for (const tag of tags) {
    const keys = tagIndex.get(tag)
    if (!keys) {
      continue
    }

    keys.delete(key)
    if (keys.size === 0) {
      tagIndex.delete(tag)
    }
  }
}

export async function getOrSetPerfCache<T>(
  key: string,
  loader: () => Promise<T>,
  options: PerfCacheOptions = {}
) {
  const now = Date.now()
  const cached = cacheStore.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.value as T
  }

  if (cached) {
    unregisterKeyFromTags(key, cached.tags)
    cacheStore.delete(key)
  }

  const value = await loader()
  const tags = (options.tags || []).filter(Boolean)
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS

  cacheStore.set(key, {
    value,
    expiresAt: now + ttlMs,
    tags,
  })

  for (const tag of tags) {
    registerTag(tag, key)
  }

  return value
}

export function invalidatePerfCacheByTag(tag: string) {
  const keys = tagIndex.get(tag)
  if (!keys || keys.size === 0) {
    return
  }

  for (const key of keys) {
    const entry = cacheStore.get(key)
    if (!entry) {
      continue
    }
    unregisterKeyFromTags(key, entry.tags)
    cacheStore.delete(key)
  }
}

export function invalidatePerfCacheByTags(tags: string[]) {
  for (const tag of tags) {
    invalidatePerfCacheByTag(tag)
  }
}
