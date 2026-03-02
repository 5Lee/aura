"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Category {
  id: string
  name: string
}

interface PromptFormProps {
  categories: Category[]
  initialData?: {
    id: string
    title: string
    content: string
    description: string
    categoryId: string
    isPublic: boolean
  }
}

export function PromptForm({ categories, initialData }: PromptFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialData?.title || "")
  const [content, setContent] = useState(initialData?.content || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "")
  const [isPublic, setIsPublic] = useState(initialData?.isPublic || false)
  const [tags, setTags] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const url = initialData
        ? `/api/prompts/${initialData.id}`
        : "/api/prompts"

      const method = initialData ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          description,
          categoryId,
          isPublic,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "保存失败")
        return
      }

      router.push("/prompts")
      router.refresh()
    } catch (error) {
      setError("保存失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            标题 <span className="text-red-500">*</span>
          </label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给提示词起个名字"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            分类 <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
            disabled={isLoading}
          >
            <option value="">选择分类</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            描述
          </label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述这个提示词的用途"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-2">
            提示词内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入你的 AI 提示词内容..."
            rows={8}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-2">
            标签
          </label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，如: GPT-4, 创意写作, 助手"
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-input"
            disabled={isLoading}
          />
          <label htmlFor="isPublic" className="text-sm font-medium">
            公开分享（其他用户可以查看）
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "保存中..." : initialData ? "更新" : "创建"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          取消
        </Button>
      </div>
    </form>
  )
}
