import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react"

import type { BrandConfig } from "@/lib/branding"
import { cn } from "@/lib/utils"

type AuthExperienceStat = {
  label: string
  value: string
}

type AuthExperienceItem = {
  description: string
  title: string
}

type AuthExperiencePanelProps = {
  brandConfig: BrandConfig
  className?: string
  description: string
  eyebrow: string
  footer?: string
  items: AuthExperienceItem[]
  stats: AuthExperienceStat[]
  title: string
}

export function AuthExperiencePanel({
  brandConfig,
  className,
  description,
  eyebrow,
  footer,
  items,
  stats,
  title,
}: AuthExperiencePanelProps) {
  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/10 px-5 py-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:px-7 sm:py-8",
        className
      )}
      style={{
        background: `linear-gradient(140deg, ${brandConfig.primaryColor}F2, #0f172a 42%, ${brandConfig.secondaryColor}CC)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-16 h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: `${brandConfig.secondaryColor}55` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full blur-3xl"
        style={{ backgroundColor: `${brandConfig.primaryColor}44` }}
      />
      <div className="relative space-y-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/72">{brandConfig.brandName}</p>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-white/78 sm:text-base">{description}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-white/60">{item.label}</p>
              <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-white/12 bg-slate-950/18 p-4 backdrop-blur-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            体验与风控并行
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-white/80" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/72">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {footer ? (
          <div className="flex items-center gap-2 text-sm text-white/78">
            <ArrowRight className="h-4 w-4" />
            <span>{footer}</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
