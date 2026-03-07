import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

interface PromptEditorShellProps {
  mode: "create" | "edit"
  title: string
  description: string
  backHref: string
  backLabel: string
  children: React.ReactNode
}

const MODE_META = {
  create: {
    eyebrow: "Create prompt",
    badge: "新建工作流资产",
  },
  edit: {
    eyebrow: "Edit prompt",
    badge: "维护已有资产",
  },
} as const

const EDITOR_FOCUS_POINTS = [
  {
    eyebrow: "Drafting",
    title: "本地草稿保护",
    description: "意外离开页面后，可继续恢复未提交内容。",
  },
  {
    eyebrow: "Variables",
    title: "支持模板变量",
    description: "使用 {{variable}} 构建可复用模板。",
  },
  {
    eyebrow: "Preview",
    title: "边写边预览",
    description: "通过 JSON 样例输入快速检查渲染结果。",
  },
] as const

const EDITOR_SECTION_LINKS = [
  { href: "#prompt-basics", label: "基础信息" },
  { href: "#prompt-content", label: "正文" },
  { href: "#prompt-variables", label: "变量" },
  { href: "#prompt-preview", label: "预览" },
] as const

export function PromptEditorShell({
  mode,
  title,
  description,
  backHref,
  backLabel,
  children,
}: PromptEditorShellProps) {
  const meta = MODE_META[mode]

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="surface-panel-strong relative overflow-hidden p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_38%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_28%)]"
        />
        <div className="relative space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link href={backHref} className="hidden sm:inline-flex">
                <Button variant="ghost" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
                  <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                  {backLabel}
                </Button>
              </Link>

              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow-label">{meta.eyebrow}</p>
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {meta.badge}
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border/70 bg-background/84 p-4 shadow-card backdrop-blur-sm sm:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-label">Focus path</p>
                <p className="mt-2 text-sm font-semibold text-foreground">先补基础信息，再处理变量和预览</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {EDITOR_SECTION_LINKS.map((item) => (
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

            <div className="mt-4 grid grid-cols-3 gap-2">
              {EDITOR_FOCUS_POINTS.map((item) => (
                <div key={item.eyebrow} className="rounded-[1.1rem] border border-border/60 bg-background/75 px-3 py-3">
                  <p className="eyebrow-label">{item.eyebrow}</p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-foreground">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden gap-3 sm:grid sm:grid-cols-3">
            {EDITOR_FOCUS_POINTS.map((item) => (
              <div
                key={item.eyebrow}
                className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm"
              >
                <p className="eyebrow-label">{item.eyebrow}</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-6">{children}</div>
    </div>
  )
}
