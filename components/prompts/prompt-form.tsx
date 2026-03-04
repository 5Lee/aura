"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
}

interface PromptTemplateVariableForm {
  name: string
  type: "string" | "number" | "boolean" | "json"
  required: boolean
  defaultValue: string
  description?: string
  options?: string[]
  minLength?: number
  maxLength?: number
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
    templateVariables?: PromptTemplateVariableForm[]
  }
}

interface PromptFormDraftSnapshot {
  title: string
  content: string
  description: string
  categoryId: string
  isPublic: boolean
  tags: string
  templateVariables: PromptTemplateVariableForm[]
}

const TEMPLATE_VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g

function extractVariableNamesFromContent(content: string) {
  const names = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = TEMPLATE_VARIABLE_PATTERN.exec(content)) !== null) {
    const name = match[1]?.trim()
    if (name) {
      names.add(name)
    }
  }

  return Array.from(names)
}

function parseSampleInput(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return {}
  }
  return JSON.parse(trimmed)
}

function normalizeDraftTemplateVariables(input: unknown): PromptTemplateVariableForm[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const raw = item as Partial<PromptTemplateVariableForm>
      return {
        name: String(raw.name || ""),
        type:
          raw.type === "number" || raw.type === "boolean" || raw.type === "json"
            ? raw.type
            : "string",
        required: Boolean(raw.required),
        defaultValue: String(raw.defaultValue || ""),
      } satisfies PromptTemplateVariableForm
    })
    .filter((item): item is PromptTemplateVariableForm => item !== null)
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
  const [templateVariables, setTemplateVariables] = useState<PromptTemplateVariableForm[]>(
    initialData?.templateVariables || []
  )
  const [sampleInputText, setSampleInputText] = useState("{}")
  const [renderPreview, setRenderPreview] = useState("")
  const [previewError, setPreviewError] = useState("")
  const [isRenderingPreview, setIsRenderingPreview] = useState(false)
  const [touched, setTouched] = useState({
    title: false,
    categoryId: false,
    content: false,
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [restorableDraft, setRestorableDraft] = useState<PromptFormDraftSnapshot | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [hasAutoSaved, setHasAutoSaved] = useState(false)

  const sampleInputStorageKey = useMemo(
    () => `aura:prompt-template-sample:${initialData?.id || "new"}`,
    [initialData?.id]
  )
  const formDraftStorageKey = useMemo(
    () => `aura:prompt-form-draft:${initialData?.id || "new"}`,
    [initialData?.id]
  )

  const normalizedTemplateVariables = useMemo(() => {
    const seen = new Set<string>()

    return templateVariables
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        defaultValue: item.defaultValue || "",
      }))
      .filter((item) => {
        if (!item.name) {
          return false
        }

        const key = item.name.toLowerCase()
        if (seen.has(key)) {
          return false
        }

        seen.add(key)
        return true
      })
  }, [templateVariables])

  const titleError = !title.trim() ? "请输入标题" : ""
  const categoryError = !categoryId ? "请选择分类" : ""
  const contentError = !content.trim() ? "请输入提示词内容" : ""

  const hasValidationError = Boolean(titleError) || Boolean(categoryError) || Boolean(contentError)
  const shouldShowTitleError = (touched.title || hasSubmitted) && Boolean(titleError)
  const shouldShowCategoryError = (touched.categoryId || hasSubmitted) && Boolean(categoryError)
  const shouldShowContentError = (touched.content || hasSubmitted) && Boolean(contentError)
  const currentDraftSnapshot = useMemo(
    () => ({
      title,
      content,
      description,
      categoryId,
      isPublic,
      tags,
      templateVariables,
    }),
    [categoryId, content, description, isPublic, tags, templateVariables, title]
  )

  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.removeItem(formDraftStorageKey)
    setHasAutoSaved(false)
  }, [formDraftStorageKey])

  const restoreLocalDraft = useCallback(() => {
    if (!restorableDraft) {
      return
    }

    setTitle(restorableDraft.title)
    setContent(restorableDraft.content)
    setDescription(restorableDraft.description)
    setCategoryId(restorableDraft.categoryId)
    setIsPublic(restorableDraft.isPublic)
    setTags(restorableDraft.tags)
    setTemplateVariables(restorableDraft.templateVariables)
    setRestorableDraft(null)

    toast({
      type: "info",
      title: "已恢复本地草稿",
      description: "你可以继续编辑并提交。",
    })
  }, [restorableDraft, toast])

  const discardLocalDraft = useCallback(() => {
    clearLocalDraft()
    setRestorableDraft(null)

    toast({
      type: "info",
      title: "已忽略本地草稿",
      description: "当前页面保留服务端最新内容。",
    })
  }, [clearLocalDraft, toast])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const cached = window.localStorage.getItem(sampleInputStorageKey)
    if (cached) {
      setSampleInputText(cached)
      return
    }

    setSampleInputText("{}")
  }, [sampleInputStorageKey])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(sampleInputStorageKey, sampleInputText)
  }, [sampleInputStorageKey, sampleInputText])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const raw = window.localStorage.getItem(formDraftStorageKey)
    if (!raw) {
      setDraftReady(true)
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PromptFormDraftSnapshot>
      const nextDraft: PromptFormDraftSnapshot = {
        title: String(parsed.title || ""),
        content: String(parsed.content || ""),
        description: String(parsed.description || ""),
        categoryId: String(parsed.categoryId || ""),
        isPublic: Boolean(parsed.isPublic),
        tags: String(parsed.tags || ""),
        templateVariables: normalizeDraftTemplateVariables(parsed.templateVariables),
      }

      const initialSnapshot = {
        title: initialData?.title || "",
        content: initialData?.content || "",
        description: initialData?.description || "",
        categoryId: initialData?.categoryId || "",
        isPublic: initialData?.isPublic || false,
        tags: initialData?.tags || "",
        templateVariables: initialData?.templateVariables || [],
      }

      if (JSON.stringify(nextDraft) !== JSON.stringify(initialSnapshot)) {
        setRestorableDraft(nextDraft)
      }
    } catch {
      window.localStorage.removeItem(formDraftStorageKey)
    } finally {
      setDraftReady(true)
    }
  }, [formDraftStorageKey, initialData])

  useEffect(() => {
    if (typeof window === "undefined" || !draftReady || restorableDraft) {
      return
    }

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(formDraftStorageKey, JSON.stringify(currentDraftSnapshot))
      setHasAutoSaved(true)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [currentDraftSnapshot, draftReady, formDraftStorageKey, restorableDraft])

  const handleTemplateVariableChange = <K extends keyof PromptTemplateVariableForm>(
    index: number,
    key: K,
    value: PromptTemplateVariableForm[K]
  ) => {
    setTemplateVariables((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [key]: value,
      }
      return next
    })
  }

  const removeTemplateVariable = (index: number) => {
    setTemplateVariables((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleRenderPreview = useCallback(async (silent = false) => {
    setIsRenderingPreview(true)
    setPreviewError("")

    try {
      const parsedInput = parseSampleInput(sampleInputText)
      const response = await fetch("/api/prompts/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: content,
          input: parsedInput,
          variables: normalizedTemplateVariables,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        const message = payload?.details?.join("；") || payload?.error || "模板渲染失败"
        setPreviewError(message)
        if (!silent) {
          toast({
            type: "error",
            title: "渲染失败",
            description: message,
          })
        }
        return
      }

      setRenderPreview(payload.rendered || "")
      if (!silent) {
        toast({
          type: "success",
          title: "渲染成功",
          description: "已更新模板预览结果。",
        })
      }
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "模板渲染失败"
      setPreviewError(message)
      if (!silent) {
        toast({
          type: "error",
          title: "渲染失败",
          description: message,
        })
      }
    } finally {
      setIsRenderingPreview(false)
    }
  }, [content, normalizedTemplateVariables, sampleInputText, toast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!content.includes("{{")) {
        setRenderPreview(content)
        setPreviewError("")
        return
      }

      void handleRenderPreview(true)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [content, handleRenderPreview])

  const addTemplateVariable = () => {
    setTemplateVariables((prev) => [
      ...prev,
      {
        name: "",
        type: "string",
        required: false,
        defaultValue: "",
      },
    ])
  }

  const syncVariablesFromContent = () => {
    const detected = extractVariableNamesFromContent(content)
    if (detected.length === 0) {
      toast({
        type: "info",
        title: "未检测到变量",
        description: "当前内容中没有 {{variable}} 占位符。",
      })
      return
    }

    setTemplateVariables((prev) => {
      const map = new Map(prev.map((item) => [item.name.trim().toLowerCase(), item]))
      const next = [...prev]

      for (const variableName of detected) {
        const key = variableName.toLowerCase()
        if (!map.has(key)) {
          next.push({
            name: variableName,
            type: "string",
            required: true,
            defaultValue: "",
          })
        }
      }

      return next
    })

    toast({
      type: "success",
      title: "变量已同步",
      description: `已从模板内容同步 ${detected.length} 个变量。`,
    })
  }

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
      const url = isEditMode ? `/api/prompts/${initialData!.id}` : "/api/prompts"
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
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          templateVariables: normalizedTemplateVariables,
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

      clearLocalDraft()
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(sampleInputStorageKey)
      }

      toast({
        type: "success",
        title: isEditMode ? "更新成功" : "创建成功",
        description: isEditMode ? "提示词已更新。" : "提示词已添加到你的列表。",
      })

      router.push(`/prompts${data.id ? `/${data.id}` : ""}`)
      router.refresh()
    } catch (submitError) {
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {restorableDraft ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="font-medium">检测到本地草稿</p>
          <p className="mt-1">你上次的编辑还未提交，可选择恢复继续。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={restoreLocalDraft}>
              恢复草稿
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={discardLocalDraft}>
              使用当前内容
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            标题 <span className="text-red-500">*</span>
          </label>
          <Input
            id="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
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
          <label htmlFor="category" className="mb-2 block text-sm font-medium">
            分类 <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value)
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
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
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
          <label htmlFor="description" className="mb-2 block text-sm font-medium">
            描述
          </label>
          <Input
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="简要描述这个提示词的用途"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="content" className="mb-2 block text-sm font-medium">
            提示词内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
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
          <label htmlFor="tags" className="mb-2 block text-sm font-medium">
            标签
          </label>
          <Input
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="用逗号分隔，如: GPT-4, 创意写作, 助手"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">模板变量</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={syncVariablesFromContent}>
                从内容提取变量
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addTemplateVariable}>
                添加变量
              </Button>
            </div>
          </div>

          {templateVariables.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无模板变量。你可以在内容中使用 <code>{"{{variable}}"}</code> 后点击“从内容提取变量”。
            </p>
          ) : (
            <div className="space-y-2">
              {templateVariables.map((item, index) => (
                <div
                  key={`${item.name || "var"}-${index}`}
                  className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_auto]"
                >
                  <Input
                    aria-label={`变量名-${index}`}
                    value={item.name}
                    onChange={(event) =>
                      handleTemplateVariableChange(index, "name", event.target.value)
                    }
                    placeholder="变量名"
                    disabled={isLoading}
                  />
                  <select
                    aria-label={`变量类型-${index}`}
                    value={item.type}
                    onChange={(event) =>
                      handleTemplateVariableChange(
                        index,
                        "type",
                        event.target.value as PromptTemplateVariableForm["type"]
                      )
                    }
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                    disabled={isLoading}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="json">json</option>
                  </select>
                  <Input
                    aria-label={`默认值-${index}`}
                    value={item.defaultValue}
                    onChange={(event) =>
                      handleTemplateVariableChange(index, "defaultValue", event.target.value)
                    }
                    placeholder="默认值"
                    disabled={isLoading}
                  />
                  <label className="flex h-10 items-center gap-2 rounded-md border border-input px-2 text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(event) =>
                        handleTemplateVariableChange(index, "required", event.target.checked)
                      }
                      disabled={isLoading}
                    />
                    必填
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTemplateVariable(index)}
                    disabled={isLoading}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">模板渲染预览</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleRenderPreview(false)}
              disabled={isLoading || isRenderingPreview}
            >
              {isRenderingPreview ? "渲染中..." : "立即预览"}
            </Button>
          </div>

          <div>
            <label htmlFor="template-sample-input" className="mb-2 block text-sm font-medium">
              变量样例输入（JSON，自动保存）
            </label>
            <textarea
              id="template-sample-input"
              value={sampleInputText}
              onChange={(event) => setSampleInputText(event.target.value)}
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='{"topic":"代码审查","tone":"专业"}'
              disabled={isLoading}
            />
          </div>

          {previewError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium">渲染结果</p>
            <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm text-foreground">
              {renderPreview || "暂无渲染结果"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4 rounded border-input"
            disabled={isLoading}
          />
          <label htmlFor="isPublic" className="text-sm font-medium">
            公开分享（其他用户可以查看）
          </label>
        </div>
      </div>

      <div className="sticky bottom-2 z-20 -mx-2 flex flex-col gap-3 rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur-sm sm:static sm:-mx-0 sm:flex-row sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="submit" className="w-full sm:w-auto" disabled={isLoading || Boolean(restorableDraft)}>
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
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={clearLocalDraft} disabled={isLoading}>
          清除本地草稿
        </Button>
        {hasAutoSaved ? (
          <p className="text-xs text-muted-foreground sm:ml-auto sm:self-center">草稿已自动保存到本地</p>
        ) : null}
      </div>
    </form>
  )
}
