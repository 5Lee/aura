import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  title: string
  description: string
  actions?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-gradient-to-br from-card via-card to-muted/30 shadow-card",
        className
      )}
      {...props}
    >
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center sm:px-10">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-card-foreground">{title}</h2>
          <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actions && (
          <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
