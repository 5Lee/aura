"use client"

import { useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  promptId: string
  isAuthenticated: boolean
  isFavorited?: boolean
  favoriteCount?: number
  className?: string
}

export function FavoriteButton({
  promptId,
  isAuthenticated,
  isFavorited: initialFavorited = false,
  favoriteCount = 0,
  className,
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
      className={cn(
        "gap-2 rounded-full px-4",
        isFavorited
          ? "bg-rose-500 text-white shadow-[0_12px_28px_-16px_rgba(244,63,94,0.75)] hover:bg-rose-600"
          : "border-border/70 bg-background/75",
        className
      )}
    >
      <Heart aria-hidden="true" className={cn("h-4 w-4", isFavorited ? "fill-current" : "")} />
      <span>{isFavorited ? "已收藏" : "收藏"}</span>
      <span className="text-xs opacity-80">{count}</span>
    </Button>
  )
}
