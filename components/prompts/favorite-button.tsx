"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

interface FavoriteButtonProps {
  promptId: string
  isAuthenticated: boolean
  isFavorited?: boolean
  favoriteCount?: number
}

export function FavoriteButton({
  promptId,
  isAuthenticated,
  isFavorited: initialFavorited = false,
  favoriteCount = 0,
}: FavoriteButtonProps) {
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [count, setCount] = useState(favoriteCount)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsFavorited(initialFavorited)
    setCount(favoriteCount)
  }, [initialFavorited, favoriteCount])

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    setIsLoading(true)

    try {
      if (isFavorited) {
        await fetch(`/api/favorites?promptId=${promptId}`, {
          method: "DELETE",
        })
        setIsFavorited(false)
        setCount((current) => Math.max(0, current - 1))
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId }),
        })
        setIsFavorited(true)
        setCount((current) => current + 1)
      }
      router.refresh()
    } catch (error) {
      console.error("Favorite error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      size="sm"
      onClick={handleFavorite}
      disabled={isLoading}
      className={isFavorited ? "bg-red-500 text-white hover:bg-red-600" : ""}
    >
      <svg
        className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`}
        fill={isFavorited ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span className="ml-1">{count}</span>
    </Button>
  )
}
