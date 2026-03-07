"use client"

import Link from "next/link"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { FavoriteButton } from "@/components/prompts/favorite-button"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

interface PromptDetailActionsProps {
  promptId: string
  canEdit: boolean
  isAuthenticated: boolean
  isFavorited: boolean
  favoriteCount: number
  className?: string
}

export function PromptDetailActions({
  promptId,
  canEdit,
  isAuthenticated,
  isFavorited,
  favoriteCount,
  className,
}: PromptDetailActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (isDeleting) {
      return
    }

    if (!confirm("确定要删除这个提示词吗？")) {
      toast({
        type: "info",
        title: "已取消删除",
        description: "你的提示词未发生变化。",
      })
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        toast({
          type: "error",
          title: "删除失败",
          description: payload?.error || "请稍后再试。",
        })
        return
      }

      toast({
        type: "success",
        title: "删除成功",
        description: "提示词已从你的列表移除。",
      })
      router.push("/prompts")
      router.refresh()
    } catch (error) {
      toast({
        type: "error",
        title: "删除失败",
        description: "网络异常，请稍后重试。",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={cn("grid w-full gap-2 sm:flex sm:flex-wrap sm:justify-start lg:justify-end", className)}>
      <FavoriteButton
        promptId={promptId}
        isAuthenticated={isAuthenticated}
        isFavorited={isFavorited}
        favoriteCount={favoriteCount}
        className="w-full justify-center sm:w-auto"
      />
      {canEdit ? (
        <>
          <Link href={`/prompts/${promptId}/edit`} className="w-full sm:w-auto">
            <Button
              variant="outline"
              disabled={isDeleting}
              className="w-full rounded-full border-border/70 bg-background/75 px-4 sm:w-auto"
            >
              编辑
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full justify-center rounded-full px-4 sm:w-auto"
          >
            <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
            {isDeleting ? "删除中..." : "删除"}
          </Button>
        </>
      ) : null}
    </div>
  )
}
