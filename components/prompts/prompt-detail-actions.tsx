"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { FavoriteButton } from "@/components/prompts/favorite-button"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

interface PromptDetailActionsProps {
  promptId: string
  canEdit: boolean
  isFavorited: boolean
  favoriteCount: number
}

export function PromptDetailActions({
  promptId,
  canEdit,
  isFavorited,
  favoriteCount,
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
    <div className="flex gap-2">
      <FavoriteButton
        promptId={promptId}
        isFavorited={isFavorited}
        favoriteCount={favoriteCount}
      />
      {canEdit ? (
        <>
          <Link href={`/prompts/${promptId}/edit`}>
            <Button variant="outline" disabled={isDeleting}>编辑</Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "删除中..." : "删除"}
          </Button>
        </>
      ) : null}
    </div>
  )
}
