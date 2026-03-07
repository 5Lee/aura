"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Globe, Loader2, Lock, Sparkles, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

function formatStatusTime(timestamp: number | null) {
  if (!timestamp) {
    return null
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

export function PromptForm({ categories, initialData }: PromptFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditMode = Boolean(initialData)
  const initialDraftSnapshot = useMemo(
    () => ({
      title: initialData?.title || "",
      content: initialData?.content || "",
      description: initialData?.description || "",
      categoryId: initialData?.categoryId || "",
      isPublic: initialData?.isPublic || false,
      tags: initialData?.tags || "",
      templateVariables: initialData?.templateVariables || [],
    }),
    [initialData]
  )
  const initialDraftJson = useMemo(() => JSON.stringify(initialDraftSnapshot), [initialDraftSnapshot])

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
  const [lastPreviewAt, setLastPreviewAt] = useState<number | null>(null)
  const [lastPreviewSignature, setLastPreviewSignature] = useState("")
  const previewAbortControllerRef = useRef<AbortController | null>(null)
  const previewRequestIdRef = useRef(0)
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
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null)
  const [lastSavedDraftJson, setLastSavedDraftJson] = useState(initialDraftJson)

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
  const currentDraftJson = useMemo(() => JSON.stringify(currentDraftSnapshot), [currentDraftSnapshot])
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId]
  )
  const normalizedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [tags]
  )
  const detectedVariableNames = useMemo(() => extractVariableNamesFromContent(content), [content])
  const declaredVariableNames = useMemo(
    () => new Set(normalizedTemplateVariables.map((item) => item.name)),
    [normalizedTemplateVariables]
  )
  const missingVariableDefinitions = useMemo(
    () => detectedVariableNames.filter((name) => !declaredVariableNames.has(name)),
    [declaredVariableNames, detectedVariableNames]
  )
  const requiredVariableCount = useMemo(
    () => normalizedTemplateVariables.filter((item) => item.required).length,
    [normalizedTemplateVariables]
  )
  const promptCharacterCount = content.trim().length
  const previewInputSignature = useMemo(
    () =>
      JSON.stringify({
        template: content.trim(),
        sampleInputText,
        variables: normalizedTemplateVariables,
      }),
    [content, normalizedTemplateVariables, sampleInputText]
  )
  const readinessChecklist = useMemo(
    () => [
      { label: "标题", ready: Boolean(title.trim()) },
      { label: "分类", ready: Boolean(categoryId) },
      { label: "内容", ready: Boolean(content.trim()) },
      { label: "变量定义", ready: missingVariableDefinitions.length === 0 },
    ],
    [categoryId, content, missingVariableDefinitions.length, title]
  )
  const completedChecklistCount = useMemo(
    () => readinessChecklist.filter((item) => item.ready).length,
    [readinessChecklist]
  )
  const draftStateLabel = restorableDraft ? "待恢复" : hasAutoSaved ? "已自动保存" : "编辑中"
  const visibilityLabel = isPublic ? "公开分享" : "私有保存"
  const visibilityDescription = isPublic
    ? "保存后其他用户可以查看并复用这条提示词。"
    : "保存后仅你和有权限的协作者可以查看。"
  const formattedAutoSavedTime = useMemo(() => formatStatusTime(lastAutoSavedAt), [lastAutoSavedAt])
  const formattedPreviewTime = useMemo(() => formatStatusTime(lastPreviewAt), [lastPreviewAt])
  const isPreviewFresh = lastPreviewSignature.length > 0 && lastPreviewSignature === previewInputSignature
  const autoSaveMeta = useMemo(() => {
    if (restorableDraft) {
      return {
        label: "检测到待处理草稿",
        description: "请先恢复或忽略本地草稿，再继续提交当前编辑。",
        tone: "warning" as const,
      }
    }

    if (!draftReady) {
      return {
        label: "正在准备本地草稿",
        description: "页面会先检查是否存在可恢复的历史编辑。",
        tone: "muted" as const,
      }
    }

    if (isAutoSaving) {
      return {
        label: "自动保存中...",
        description: "最近的编辑内容会在本地安全保存，减少意外丢失。",
        tone: "progress" as const,
      }
    }

    if (formattedAutoSavedTime) {
      return {
        label: `已于 ${formattedAutoSavedTime} 自动保存`,
        description: "关闭页面后仍可恢复最近一次本地草稿。",
        tone: "success" as const,
      }
    }

    return {
      label: hasAutoSaved ? "本地草稿已同步" : "尚未生成本地草稿",
      description: hasAutoSaved
        ? "当前编辑已经同步到本地，可继续放心修改。"
        : "开始编辑后会自动保存到本地，方便中断后继续。",
      tone: hasAutoSaved ? ("success" as const) : ("muted" as const),
    }
  }, [draftReady, formattedAutoSavedTime, hasAutoSaved, isAutoSaving, restorableDraft])
  const previewMeta = useMemo(() => {
    if (isRenderingPreview) {
      return {
        label: "正在刷新预览",
        description: "根据最新正文、变量和样例输入重新渲染结果。",
        tone: "progress" as const,
      }
    }

    if (previewError) {
      return {
        label: "预览需要处理",
        description: previewError,
        tone: "error" as const,
      }
    }

    if (renderPreview && isPreviewFresh) {
      return {
        label: formattedPreviewTime ? `已于 ${formattedPreviewTime} 同步预览` : "预览已同步",
        description: "当前预览与你的最近输入保持一致，可以直接检查输出格式。",
        tone: "success" as const,
      }
    }

    if (renderPreview) {
      return {
        label: "内容已变化，等待同步",
        description: "继续输入后会自动刷新，也可以手动立即预览。",
        tone: "progress" as const,
      }
    }

    return {
      label: "输入样例数据后可立即得到渲染结果",
      description: "系统会自动刷新预览，帮助你更快检查模板输出是否稳定。",
      tone: "muted" as const,
    }
  }, [formattedPreviewTime, isPreviewFresh, isRenderingPreview, previewError, renderPreview])

  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.removeItem(formDraftStorageKey)
    setHasAutoSaved(false)
    setIsAutoSaving(false)
    setLastAutoSavedAt(null)
    setLastSavedDraftJson(currentDraftJson)
  }, [currentDraftJson, formDraftStorageKey])

  const restoreLocalDraft = useCallback(() => {
    if (!restorableDraft) {
      return
    }

    const restoredDraftJson = JSON.stringify(restorableDraft)

    setTitle(restorableDraft.title)
    setContent(restorableDraft.content)
    setDescription(restorableDraft.description)
    setCategoryId(restorableDraft.categoryId)
    setIsPublic(restorableDraft.isPublic)
    setTags(restorableDraft.tags)
    setTemplateVariables(restorableDraft.templateVariables)
    setLastSavedDraftJson(restoredDraftJson)
    setHasAutoSaved(restoredDraftJson !== initialDraftJson)
    setLastAutoSavedAt(Date.now())
    setIsAutoSaving(false)
    setRestorableDraft(null)

    toast({
      type: "info",
      title: "已恢复本地草稿",
      description: "你可以继续编辑并提交。",
    })
  }, [initialDraftJson, restorableDraft, toast])

  const discardLocalDraft = useCallback(() => {
    clearLocalDraft()
    setLastSavedDraftJson(initialDraftJson)
    setRestorableDraft(null)

    toast({
      type: "info",
      title: "已忽略本地草稿",
      description: "当前页面保留服务端最新内容。",
    })
  }, [clearLocalDraft, initialDraftJson, toast])

  useEffect(() => {
    setLastSavedDraftJson(initialDraftJson)
    setHasAutoSaved(false)
    setIsAutoSaving(false)
    setLastAutoSavedAt(null)
  }, [initialDraftJson])

  useEffect(() => {
    return () => {
      previewAbortControllerRef.current?.abort()
    }
  }, [])

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

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(sampleInputStorageKey, sampleInputText)
    }, 180)

    return () => window.clearTimeout(timer)
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

      if (JSON.stringify(nextDraft) !== initialDraftJson) {
        setRestorableDraft(nextDraft)
      }
    } catch {
      window.localStorage.removeItem(formDraftStorageKey)
    } finally {
      setDraftReady(true)
    }
  }, [formDraftStorageKey, initialDraftJson])

  useEffect(() => {
    if (typeof window === "undefined" || !draftReady || restorableDraft) {
      return
    }

    if (currentDraftJson === lastSavedDraftJson) {
      setIsAutoSaving(false)
      setHasAutoSaved(currentDraftJson !== initialDraftJson)
      return
    }

    setIsAutoSaving(true)

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(formDraftStorageKey, currentDraftJson)
      setHasAutoSaved(currentDraftJson !== initialDraftJson)
      setLastSavedDraftJson(currentDraftJson)
      setLastAutoSavedAt(Date.now())
      setIsAutoSaving(false)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [currentDraftJson, draftReady, formDraftStorageKey, initialDraftJson, lastSavedDraftJson, restorableDraft])

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
    previewAbortControllerRef.current?.abort()

    const controller = new AbortController()
    previewAbortControllerRef.current = controller
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId

    setIsRenderingPreview(true)
    setPreviewError("")

    try {
      const parsedInput = parseSampleInput(sampleInputText)
      const response = await fetch("/api/prompts/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          template: content,
          input: parsedInput,
          variables: normalizedTemplateVariables,
        }),
      })

      const payload = await response.json()
      if (requestId !== previewRequestIdRef.current) {
        return
      }

      if (!response.ok) {
        const message = payload?.details?.join("；") || payload?.error || "模板渲染失败"
        setPreviewError(message)
        setLastPreviewSignature("")
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
      setLastPreviewAt(Date.now())
      setLastPreviewSignature(previewInputSignature)
      if (!silent) {
        toast({
          type: "success",
          title: "渲染成功",
          description: "已更新模板预览结果。",
        })
      }
    } catch (previewError) {
      if (controller.signal.aborted || requestId !== previewRequestIdRef.current) {
        return
      }

      const message = previewError instanceof Error ? previewError.message : "模板渲染失败"
      setPreviewError(message)
      setLastPreviewSignature("")
      if (!silent) {
        toast({
          type: "error",
          title: "渲染失败",
          description: message,
        })
      }
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setIsRenderingPreview(false)
        previewAbortControllerRef.current = null
      }
    }
  }, [content, normalizedTemplateVariables, previewInputSignature, sampleInputText, toast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!content.includes("{{")) {
        previewAbortControllerRef.current?.abort()
        setIsRenderingPreview(false)
        setRenderPreview(content)
        setPreviewError("")
        setLastPreviewAt(content.trim() ? Date.now() : null)
        setLastPreviewSignature(content.trim() ? previewInputSignature : "")
        return
      }

      const detectedVariables = extractVariableNamesFromContent(content)
      const declaredVariables = new Set(normalizedTemplateVariables.map((item) => item.name))
      const missingDefinitions = detectedVariables.filter((name) => !declaredVariables.has(name))

      if (missingDefinitions.length > 0) {
        previewAbortControllerRef.current?.abort()
        setIsRenderingPreview(false)
        setRenderPreview("")
        setPreviewError(`缺少变量定义: ${missingDefinitions.join(", ")}`)
        setLastPreviewSignature("")
        return
      }

      let parsedInput: Record<string, unknown> = {}
      try {
        const parsed = parseSampleInput(sampleInputText)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedInput = parsed as Record<string, unknown>
        }
      } catch {
        previewAbortControllerRef.current?.abort()
        setIsRenderingPreview(false)
        setRenderPreview("")
        setPreviewError("变量样例输入 JSON 格式错误")
        setLastPreviewSignature("")
        return
      }

      const missingRequiredVariables = normalizedTemplateVariables
        .filter((item) => item.required && !item.defaultValue.trim())
        .filter((item) => {
          const value = parsedInput[item.name]
          if (value === undefined || value === null) {
            return true
          }
          if (typeof value === "string") {
            return value.trim().length === 0
          }
          return false
        })
        .map((item) => item.name)

      if (missingRequiredVariables.length > 0) {
        previewAbortControllerRef.current?.abort()
        setIsRenderingPreview(false)
        setRenderPreview("")
        setPreviewError(`缺少变量: ${missingRequiredVariables.join(", ")}`)
        setLastPreviewSignature("")
        return
      }

      void handleRenderPreview(true)
    }, 320)

    return () => window.clearTimeout(timer)
  }, [content, handleRenderPreview, normalizedTemplateVariables, previewInputSignature, sampleInputText])

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
      {error ? (
        <div className="surface-panel border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">保存未成功</p>
          <p className="mt-1 text-destructive/90">{error}</p>
        </div>
      ) : null}

      {restorableDraft ? (
        <div className="surface-panel border-amber-300/50 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-card dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="font-medium">检测到本地草稿</p>
              <p className="text-amber-900/80 dark:text-amber-100/75">
                你上次的编辑还未提交，恢复后可继续修改；忽略后会保留当前页面内容。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={restoreLocalDraft}>
                恢复草稿
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={discardLocalDraft}>
                使用当前内容
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="surface-panel space-y-4 p-5 xl:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="eyebrow-label">Quick guide</p>
            <p className="text-sm font-semibold text-foreground">先完成基础信息，再补变量与渲染预览</p>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
          >
            {completedChecklistCount}/{readinessChecklist.length} 已完成
          </Badge>
        </div>

        <label
          htmlFor="isPublic-mobile"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-[1.35rem] border p-4 transition-colors",
            isPublic
              ? "border-primary/30 bg-primary/10"
              : "border-border/70 bg-background/85 hover:border-border"
          )}
        >
          <input
            type="checkbox"
            id="isPublic-mobile"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
            disabled={isLoading}
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {isPublic ? (
                <Globe aria-hidden="true" className="h-4 w-4 text-primary" />
              ) : (
                <Lock aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{visibilityLabel}</span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{visibilityDescription}</p>
          </div>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 shadow-card">
            <p className="eyebrow-label">Progress</p>
            <p className="mt-3 text-base font-semibold text-foreground">{completedChecklistCount} / {readinessChecklist.length} 项就绪</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasValidationError ? "先补齐标题、分类和提示词内容。" : "基础信息已满足提交前校验。"}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 shadow-card">
            <p className="eyebrow-label">Coverage</p>
            <p className="mt-3 text-base font-semibold text-foreground">
              {normalizedTemplateVariables.length} / {detectedVariableNames.length || 0} 变量已声明
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {missingVariableDefinitions.length > 0
                ? `还缺少 ${missingVariableDefinitions.length} 个变量定义。`
                : detectedVariableNames.length > 0
                  ? "占位变量已经全部完成定义。"
                  : "当前正文没有模板变量。"}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 shadow-card">
            <p className="eyebrow-label">Draft</p>
            <p className="mt-3 text-base font-semibold text-foreground">{autoSaveMeta.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{autoSaveMeta.description}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="eyebrow-label">Section jump</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "#prompt-basics", label: "基础信息" },
              { href: "#prompt-content", label: "正文" },
              { href: "#prompt-variables", label: "变量" },
              { href: "#prompt-preview", label: "预览" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <section id="prompt-basics" className="surface-panel scroll-mt-24 space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="eyebrow-label">Basics</p>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">基础信息</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    先整理标题、分类和标签，让这条提示词在列表里更容易被检索、理解和复用。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {selectedCategory?.name || "未选分类"}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {normalizedTags.length} 个标签
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">
                  标题 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    setTouched((prev) => ({ ...prev, title: true }))
                    setError("")
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                  placeholder="例如：电商新品详情页生成器"
                  className={cn(
                    "h-12 rounded-2xl border-border/70 bg-background/90 px-4 shadow-sm",
                    shouldShowTitleError && "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={shouldShowTitleError}
                  aria-describedby={shouldShowTitleError ? "prompt-title-error" : undefined}
                  required
                  disabled={isLoading}
                />
                {shouldShowTitleError ? (
                  <p id="prompt-title-error" className="text-sm text-destructive">
                    {titleError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">建议用结果导向的命名方式，方便团队快速识别用途。</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  分类 <span className="text-destructive">*</span>
                </Label>
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
                    "flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    shouldShowCategoryError && "border-destructive focus-visible:ring-destructive"
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
                {shouldShowCategoryError ? (
                  <p id="prompt-category-error" className="text-sm text-destructive">
                    {categoryError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">分类会影响后续检索、筛选和推荐排序。</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="一句话说明这条提示词最适合解决什么问题"
                className="h-12 rounded-2xl border-border/70 bg-background/90 px-4 shadow-sm"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="tags">标签</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="用逗号分隔，如：营销, 总结, 多语言"
                  className="h-12 rounded-2xl border-border/70 bg-background/90 px-4 shadow-sm"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">使用 3-5 个高辨识度标签，通常就足够支撑筛选与搜索。</p>
              </div>

              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-muted/35 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {normalizedTags.length > 0 ? (
                    normalizedTags.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="inline-flex items-center rounded-full border border-border/70 bg-background/85 px-3 py-1 text-xs font-medium text-foreground shadow-sm"
                      >
                        #{item}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">标签预览会显示在这里，帮助你确认最终的展示效果。</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section id="prompt-content" className="surface-panel scroll-mt-24 space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="eyebrow-label">Prompt body</p>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">提示词正文</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    保持结构清晰，必要时使用段落、列表和变量占位符，让模型更稳定地复现结果。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {promptCharacterCount} 字符
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {detectedVariableNames.length} 个变量占位
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                提示词内容 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(event) => {
                  setContent(event.target.value)
                  setTouched((prev) => ({ ...prev, content: true }))
                  setError("")
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
                placeholder="你是一名资深运营顾问，请根据以下输入输出一份结构清晰的分析报告……"
                rows={14}
                className={cn(
                  "min-h-[320px] rounded-[1.6rem] border-border/70 bg-background/92 px-4 py-4 text-sm leading-7 shadow-sm",
                  shouldShowContentError && "border-destructive focus-visible:ring-destructive"
                )}
                aria-invalid={shouldShowContentError}
                aria-describedby={shouldShowContentError ? "prompt-content-error" : undefined}
                required
                disabled={isLoading}
              />
              {shouldShowContentError ? (
                <p id="prompt-content-error" className="text-sm text-destructive">
                  {contentError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  可以直接在正文中写入 <code>{"{{variable}}"}</code> 占位符，再同步到模板变量区。
                </p>
              )}
            </div>

            <div className="rounded-[1.45rem] border border-border/70 bg-muted/35 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">变量检测</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    系统会从正文中识别模板变量，确保变量声明和实际占位符保持一致。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-4"
                  onClick={syncVariablesFromContent}
                  disabled={isLoading}
                >
                  <Wand2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  从内容提取变量
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {detectedVariableNames.length > 0 ? (
                  detectedVariableNames.map((name) => (
                    <code
                      key={name}
                      className="inline-flex items-center rounded-full border border-border/70 bg-background/88 px-3 py-1 text-xs font-medium text-foreground shadow-sm"
                    >
                      {`{{${name}}}`}
                    </code>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">还没有检测到变量占位符，可直接编写静态提示词。</p>
                )}
              </div>

              {missingVariableDefinitions.length > 0 ? (
                <div className="mt-4 rounded-[1.2rem] border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  这些变量还没有在模板变量区声明：{missingVariableDefinitions.join("、")}
                </div>
              ) : detectedVariableNames.length > 0 ? (
                <div className="mt-4 rounded-[1.2rem] border border-emerald-200/70 bg-emerald-50/80 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300">
                  占位变量与模板变量定义已对齐，可以继续配置类型、默认值和预览样例。
                </div>
              ) : null}
            </div>
          </section>

          <section id="prompt-variables" className="surface-panel content-auto scroll-mt-24 space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="eyebrow-label">Variables</p>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">模板变量</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    为每个变量设置类型、默认值和是否必填，帮助团队成员更稳定地复用这条提示词。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  已声明 {normalizedTemplateVariables.length}
                </Badge>
                <Button type="button" variant="outline" size="sm" onClick={addTemplateVariable} disabled={isLoading}>
                  新增变量
                </Button>
              </div>
            </div>

            {templateVariables.length === 0 ? (
              <div className="rounded-[1.45rem] border border-dashed border-border/70 bg-muted/35 p-6 text-center">
                <p className="text-sm font-medium text-foreground">还没有变量定义</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  你可以手动新增变量，或先在正文写入 <code>{"{{variable}}"}</code> 后一键同步。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templateVariables.map((item, index) => (
                  <div
                    key={`${item.name || "var"}-${index}`}
                    className="rounded-[1.4rem] border border-border/70 bg-background/90 p-4 shadow-card"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-muted/35 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          变量 {index + 1}
                        </Badge>
                        {item.name.trim() ? (
                          <code className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {`{{${item.name.trim()}}}`}
                          </code>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start rounded-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => removeTemplateVariable(index)}
                        disabled={isLoading}
                      >
                        删除变量
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`prompt-variable-name-${index}`}>变量名</Label>
                        <Input
                          id={`prompt-variable-name-${index}`}
                          aria-label={`变量名-${index}`}
                          value={item.name}
                          onChange={(event) =>
                            handleTemplateVariableChange(index, "name", event.target.value)
                          }
                          placeholder="例如：topic"
                          className="h-11 rounded-2xl border-border/70 bg-background/90 px-4 shadow-sm"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`prompt-variable-type-${index}`}>类型</Label>
                        <select
                          id={`prompt-variable-type-${index}`}
                          aria-label={`变量类型-${index}`}
                          value={item.type}
                          onChange={(event) =>
                            handleTemplateVariableChange(
                              index,
                              "type",
                              event.target.value as PromptTemplateVariableForm["type"]
                            )
                          }
                          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          disabled={isLoading}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="json">json</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`prompt-variable-default-${index}`}>默认值</Label>
                        <Input
                          id={`prompt-variable-default-${index}`}
                          aria-label={`默认值-${index}`}
                          value={item.defaultValue}
                          onChange={(event) =>
                            handleTemplateVariableChange(index, "defaultValue", event.target.value)
                          }
                          placeholder="为空时需由用户输入"
                          className="h-11 rounded-2xl border-border/70 bg-background/90 px-4 shadow-sm"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-sm font-medium leading-none">校验</span>
                        <label
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                            item.required
                              ? "border-primary/30 bg-primary/10 text-foreground"
                              : "border-border/70 bg-background/90 text-muted-foreground"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={(event) =>
                              handleTemplateVariableChange(index, "required", event.target.checked)
                            }
                            className="h-4 w-4 rounded border-input"
                            disabled={isLoading}
                          />
                          必填变量
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="prompt-preview" className="surface-panel content-auto scroll-mt-24 space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="eyebrow-label">Preview</p>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">渲染预览</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    通过样例 JSON 快速检查模板渲染是否符合预期，减少保存后再往返修改的次数。
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                    previewMeta.tone === "error"
                      ? "border border-destructive/20 bg-destructive/10 text-destructive"
                      : previewMeta.tone === "success"
                        ? "border border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : previewMeta.tone === "progress"
                          ? "border border-primary/20 bg-primary/10 text-primary"
                          : "border border-border/70 bg-background/82 text-muted-foreground"
                  )}
                >
                  {previewMeta.tone === "error" ? (
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : previewMeta.tone === "success" ? (
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : previewMeta.tone === "progress" ? (
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {previewMeta.label}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full px-4"
                  onClick={() => void handleRenderPreview(false)}
                  disabled={isLoading || isRenderingPreview}
                >
                  {isRenderingPreview ? (
                    <>
                      <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                      渲染中...
                    </>
                  ) : renderPreview ? (
                    "刷新预览"
                  ) : (
                    "立即预览"
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-2">
                <Label htmlFor="template-sample-input">变量样例输入（JSON，自动保存）</Label>
                <Textarea
                  id="template-sample-input"
                  value={sampleInputText}
                  onChange={(event) => setSampleInputText(event.target.value)}
                  rows={10}
                  className="min-h-[240px] rounded-[1.45rem] border-border/70 bg-background/92 px-4 py-4 font-mono text-sm shadow-sm"
                  placeholder='{"topic":"代码审查","tone":"专业"}'
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">支持对象类型 JSON；内容会保存在本地，方便你多轮调试。</p>
              </div>

              <div className="space-y-3">
                <div
                  className={cn(
                    "rounded-[1.25rem] border p-4 text-sm transition-colors duration-300",
                    previewMeta.tone === "error"
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : previewMeta.tone === "success"
                        ? "border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : previewMeta.tone === "progress"
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-border/70 bg-background/82 text-muted-foreground"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {previewMeta.tone === "error" ? (
                      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : previewMeta.tone === "success" ? (
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : previewMeta.tone === "progress" ? (
                      <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <p className="font-semibold">{previewMeta.label}</p>
                      <p className="leading-6 opacity-90">{previewMeta.description}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.45rem] border border-border/70 bg-background/92 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">渲染结果</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {isRenderingPreview ? "刷新中" : isPreviewFresh ? "已同步" : "待刷新"}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-foreground transition-opacity duration-200",
                      isRenderingPreview && "opacity-70"
                    )}
                  >
                    {renderPreview || "暂无渲染结果"}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="hidden self-start xl:block xl:sticky xl:top-24 xl:space-y-6">
          <section className="surface-panel space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow-label">Overview</p>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
                >
                  {isEditMode ? "编辑模式" : "新建模式"}
                </Badge>
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">发布前概览</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  在保存前确认分享方式、变量覆盖和草稿状态，减少来回修改成本。
                </p>
              </div>
            </div>

            <label
              htmlFor="isPublic"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[1.45rem] border p-4 transition-colors",
                isPublic
                  ? "border-primary/30 bg-primary/10"
                  : "border-border/70 bg-background/85 hover:border-border"
              )}
            >
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
                disabled={isLoading}
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {isPublic ? (
                    <Globe aria-hidden="true" className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{visibilityLabel}</span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {visibilityDescription}
                </p>
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.35rem] border border-border/70 bg-background/85 p-4 shadow-card">
                <p className="eyebrow-label">Category</p>
                <p className="mt-3 text-base font-semibold text-foreground">
                  {selectedCategory?.name || "暂未选择分类"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedCategory ? "当前分类会影响列表筛选与归档位置。" : "请选择最贴近使用场景的分类。"}
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-border/70 bg-background/85 p-4 shadow-card">
                <p className="eyebrow-label">Coverage</p>
                <p className="mt-3 text-base font-semibold text-foreground">
                  {normalizedTemplateVariables.length} / {detectedVariableNames.length || 0} 变量已声明
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {missingVariableDefinitions.length > 0
                    ? `还缺少 ${missingVariableDefinitions.length} 个变量定义。`
                    : detectedVariableNames.length > 0
                      ? "占位变量已经全部完成定义。"
                      : "当前正文没有模板变量。"}
                </p>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/70 bg-muted/35 p-4">
              <p className="eyebrow-label">Readiness</p>
              <div className="mt-3 space-y-2 text-sm">
                {readinessChecklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-background/80 px-3 py-2"
                  >
                    <span className="text-foreground">{item.label}</span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        item.ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-300"
                      )}
                    >
                      {item.ready ? "已完成" : "待补充"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/70 bg-background/85 p-4 shadow-card">
              <p className="eyebrow-label">Snapshot</p>
              <dl className="mt-3 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <dt>标签数量</dt>
                  <dd className="font-medium text-foreground">{normalizedTags.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>必填变量</dt>
                  <dd className="font-medium text-foreground">{requiredVariableCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>正文长度</dt>
                  <dd className="font-medium text-foreground">{promptCharacterCount} 字</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>草稿状态</dt>
                  <dd className="font-medium text-foreground">
                    {draftStateLabel}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </aside>
      </div>

      <div className="surface-panel-strong sticky bottom-24 z-20 p-3 sm:bottom-2 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {autoSaveMeta.tone === "warning" ? (
                <AlertCircle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              ) : autoSaveMeta.tone === "success" ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : autoSaveMeta.tone === "progress" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Sparkles aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-foreground">{autoSaveMeta.label}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {restorableDraft
                ? autoSaveMeta.description
                : hasValidationError
                  ? "请先补齐标题、分类和提示词内容。"
                  : isAutoSaving
                    ? "本地草稿正在同步，完成后可继续安全离开。"
                    : isPublic
                      ? "保存后这条提示词将对其他用户可见。"
                      : "保存后这条提示词会保持私有。"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
            <Button
              type="submit"
              className="col-span-2 w-full rounded-full px-5 sm:w-auto"
              disabled={isLoading || Boolean(restorableDraft)}
            >
              {isLoading ? "保存中..." : isEditMode ? "更新提示词" : "创建提示词"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full px-5 sm:w-auto"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full px-5 sm:w-auto"
              onClick={clearLocalDraft}
              disabled={isLoading || (!hasAutoSaved && !restorableDraft)}
            >
              清除本地草稿
            </Button>
          </div>
        </div>
      </div>
    </form>
  )

}
