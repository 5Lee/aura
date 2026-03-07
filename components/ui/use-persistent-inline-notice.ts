"use client"

import { useCallback, useEffect, useState } from "react"

import type { InlineNoticeTone } from "@/components/ui/inline-notice"

export type PersistentInlineNotice = {
  tone: InlineNoticeTone
  message: string
}

type StoredInlineNotice = PersistentInlineNotice & {
  issuedAt: number
}

const STORAGE_PREFIX = "aura:inline-notice:"
const NOTICE_TTL_MS = 4000

function normalizeNotice(value: unknown): PersistentInlineNotice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const tone = (value as { tone?: unknown }).tone
  const message = (value as { message?: unknown }).message

  if (
    tone !== "error" &&
    tone !== "warning" &&
    tone !== "info" &&
    tone !== "success"
  ) {
    return null
  }

  if (typeof message !== "string" || !message.trim()) {
    return null
  }

  return {
    tone,
    message: message.trim(),
  }
}



function normalizeStoredNotice(value: unknown): StoredInlineNotice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const notice = normalizeNotice(value)
  const issuedAt = (value as { issuedAt?: unknown }).issuedAt

  if (!notice || typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) {
    return null
  }

  if (Date.now() - issuedAt > NOTICE_TTL_MS) {
    return null
  }

  return {
    ...notice,
    issuedAt,
  }
}
export function usePersistentInlineNotice(storageKey: string) {
  const sessionStorageKey = `${STORAGE_PREFIX}${storageKey}`
  const [notice, setNoticeState] = useState<PersistentInlineNotice | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    for (const key of Object.keys(window.sessionStorage)) {
      if (!key.startsWith(STORAGE_PREFIX)) {
        continue
      }

      const value = window.sessionStorage.getItem(key)
      if (!value) {
        continue
      }

      try {
        if (!normalizeStoredNotice(JSON.parse(value))) {
          window.sessionStorage.removeItem(key)
        }
      } catch {
        window.sessionStorage.removeItem(key)
      }
    }

    const stored = window.sessionStorage.getItem(sessionStorageKey)
    if (!stored) {
      return
    }

    window.sessionStorage.removeItem(sessionStorageKey)

    try {
      const restored = normalizeStoredNotice(JSON.parse(stored))
      setNoticeState(restored ? { tone: restored.tone, message: restored.message } : null)
    } catch {
      setNoticeState(null)
    }
  }, [sessionStorageKey])

  const setNotice = useCallback(
    (next: PersistentInlineNotice | null) => {
      setNoticeState(next)
      if (typeof window !== "undefined" && next === null) {
        window.sessionStorage.removeItem(sessionStorageKey)
      }
    },
    [sessionStorageKey]
  )

  const persistNotice = useCallback(
    (next: PersistentInlineNotice) => {
      const normalized = normalizeNotice(next)
      if (!normalized) {
        return
      }

      if (typeof window !== "undefined") {
        const storedNotice = {
          ...normalized,
          issuedAt: Date.now(),
        }
        window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(storedNotice))
        window.setTimeout(() => {
          const current = window.sessionStorage.getItem(sessionStorageKey)
          if (!current) {
            return
          }

          try {
            const parsed = normalizeStoredNotice(JSON.parse(current))
            if (!parsed || parsed.issuedAt === storedNotice.issuedAt) {
              window.sessionStorage.removeItem(sessionStorageKey)
            }
          } catch {
            window.sessionStorage.removeItem(sessionStorageKey)
          }
        }, NOTICE_TTL_MS)
      }

      setNoticeState(normalized)
    },
    [sessionStorageKey]
  )

  return {
    notice,
    setNotice,
    persistNotice,
  }
}
