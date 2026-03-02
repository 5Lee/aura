"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface FavoriteButtonProps {
  promptId: string
  isFavorited?: boolean
  favoriteCount?: number
}

export function FavoriteButton({ promptId, isFavorited: initialFavorited = false, favoriteCount = 0 }: FavoriteButtonProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [count, setCount] = useState(favoriteCount)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsFavorited(initialFavorited)
    setCount(favoriteCount)
  }, [initialFavorited, favoriteCount])

  const handleFavorite = async () => {
    if (!session) {
      router.push("/login")
      return
    }

    setIsLoading(true)

    try {
      if (isFavorited) {
        // Remove from favorites
        await fetch(`/api/favorites?promptId=${promptId}`, {
          method: "DELETE",
        })
        setIsFavorited(false)
        setCount(Math.max(0, count - 1))
      } else {
        // Add to favorites
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId }),
        })
        setIsFavorited(true)
        setCount(count + 1)
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
      className={isFavorited ? "bg-red-500 hover:bg-red-600 text-white" : ""}
    >
      <svg
        className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`}
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
