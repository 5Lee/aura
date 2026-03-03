"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

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
    tags: string
  }
}

export function PromptForm({ categories, initialData }: PromptFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditMode = Boolean(initialData)
  const [title, setTitle] = useState(initialData?.title || "")
  const [content, setContent] = useState(initialData?.content || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "")
  const [isPublic, setIsPublic] = useState(initialData?.isPublic || false)
  const [tags, setTags] = useState(initialData?.tags || "")
  const [touched, setTouched] = useState({
    title: false,
    categoryId: false,
    content: false,
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const titleError = !title.trim() ? "请输入标题" : ""
  const categoryError = !categoryId ? "请选择分类" : ""
  const contentError = !content.trim() ? "请输入提示词内容" : ""

  const hasValidationError = Boolean(titleError) || Boolean(categoryError) || Boolean(contentError)
  const shouldShowTitleError = (touched.title || hasSubmitted) && Boolean(titleError)
  const shouldShowCategoryError = (touched.categoryId || hasSubmitted) && Boolean(categoryError)
  const shouldShowContentError = (touched.content || hasSubmitted) && Boolean(contentError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setHasSubmitted(true)
    setTouched({ title: true, categoryId: true, content: true })

    if (hasValidationError) {
      return
    }

    setIsLoading(true)

    try {
      const url = isEditMode
        ? `/api/prompts/${initialData!.id}`
        : "/api/prompts"

      const method = isEditMode ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          description: description.trim(),
          categoryId,
          isPublic,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "保存失败")
        toast({
          type: "error",
          title: isEditMode ? "更新失败" : "创建失败",
          description: data.error || "请稍后重试。",
        })
        return
      }

      toast({
        type: "success",
        title: isEditMode ? "更新成功" : "创建成功",
        description: isEditMode ? "提示词已更新。" : "提示词已添加到你的列表。",
      })
      router.push("/prompts")
      router.refresh()
    } catch (error) {
      setError("保存失败，请重试")
      toast({
        type: "error",
        title: isEditMode ? "更新失败" : "创建失败",
        description: "网络异常，请稍后重试。",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
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
            onChange={(e) => {
              setTitle(e.target.value)
              setTouched((prev) => ({ ...prev, title: true }))
              setError("")
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
            placeholder="给提示词起个名字"
            className={cn(shouldShowTitleError && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={shouldShowTitleError}
            aria-describedby={shouldShowTitleError ? "prompt-title-error" : undefined}
            required
            disabled={isLoading}
          />
          {shouldShowTitleError && (
            <p id="prompt-title-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {titleError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            分类 <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setTouched((prev) => ({ ...prev, categoryId: true }))
              setError("")
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, categoryId: true }))}
            className={cn(
              "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10",
              shouldShowCategoryError && "border-red-500 focus-visible:ring-red-500"
            )}
            aria-invalid={shouldShowCategoryError}
            aria-describedby={shouldShowCategoryError ? "prompt-category-error" : undefined}
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
          {shouldShowCategoryError && (
            <p id="prompt-category-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {categoryError}
            </p>
          )}
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
            onChange={(e) => {
              setContent(e.target.value)
              setTouched((prev) => ({ ...prev, content: true }))
              setError("")
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
            placeholder="输入你的 AI 提示词内容..."
            rows={8}
            className={cn(
              "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              shouldShowContentError && "border-red-500 focus-visible:ring-red-500"
            )}
            aria-invalid={shouldShowContentError}
            aria-describedby={shouldShowContentError ? "prompt-content-error" : undefined}
            required
            disabled={isLoading}
          />
          {shouldShowContentError && (
            <p id="prompt-content-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {contentError}
            </p>
          )}
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
          {isLoading ? "保存中..." : isEditMode ? "更新" : "创建"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          取消
        </Button>
      </div>
    </form>
  )
}
