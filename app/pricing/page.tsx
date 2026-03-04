import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { subscriptionPlans, type PlanLimitValue } from "@/lib/subscription-plans"

function formatPrice(value: number | null) {
  if (value === null) {
    return "联系销售"
  }

  if (value === 0) {
    return "免费"
  }

  return `¥${value}`
}

function formatLimit(value: PlanLimitValue) {
  return value === "unlimited" ? "不限" : value.toLocaleString("zh-CN")
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-10 sm:py-14">
        <section className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4">Phase 5 Week 17</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Aura 商业化套餐设计</h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            覆盖个人、团队与企业场景，价格与权益统一由配置驱动，便于后续接入支付和订阅管理。
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {subscriptionPlans.map((plan) => (
            <Card
              key={plan.id}
              className={plan.recommended ? "border-primary/60 shadow-lg shadow-primary/10" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.recommended ? <Badge>推荐</Badge> : null}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">{formatPrice(plan.monthlyPriceCny)}</p>
                  <p className="text-xs text-muted-foreground">
                    月付
                    {plan.monthlyPriceCny && plan.monthlyPriceCny > 0
                      ? ` · 年付 ${formatPrice(plan.yearlyPriceCny)}（省 ${plan.yearlyDiscountPercent}%）`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">试用期：{plan.trialDays} 天</p>
                </div>

                <ul className="space-y-1 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === "enterprise" ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/register">联系销售</Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/register">开始使用</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </section>

        <section className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">权益</th>
                {subscriptionPlans.map((plan) => (
                  <th key={plan.id} className="px-4 py-3 font-medium">{plan.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-3 text-muted-foreground">提示词数量</td>
                {subscriptionPlans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">{formatLimit(plan.limits.maxPrompts)}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="px-4 py-3 text-muted-foreground">私有提示词</td>
                {subscriptionPlans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">{formatLimit(plan.limits.maxPrivatePrompts)}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="px-4 py-3 text-muted-foreground">每条提示词成员数</td>
                {subscriptionPlans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">{formatLimit(plan.limits.maxMembersPerPrompt)}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="px-4 py-3 text-muted-foreground">月度评测次数</td>
                {subscriptionPlans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">{formatLimit(plan.limits.maxEvalRunsPerMonth)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
