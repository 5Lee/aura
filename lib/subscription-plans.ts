export type SubscriptionPlanId = "free" | "pro" | "team" | "enterprise"

export type PlanLimitValue = number | "unlimited"

export type SubscriptionPlan = {
  id: SubscriptionPlanId
  name: string
  tagline: string
  monthlyPriceCny: number | null
  yearlyPriceCny: number | null
  yearlyDiscountPercent: number
  recommended?: boolean
  trialDays: number
  features: string[]
  limits: {
    maxPrompts: PlanLimitValue
    maxMembersPerPrompt: PlanLimitValue
    maxEvalRunsPerMonth: PlanLimitValue
    maxPrivatePrompts: PlanLimitValue
    maxApiKeys: PlanLimitValue
    maxApiCallsPerMonth: PlanLimitValue
  }
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "个人入门",
    monthlyPriceCny: 0,
    yearlyPriceCny: 0,
    yearlyDiscountPercent: 0,
    trialDays: 0,
    features: ["基础提示词管理", "公开浏览与收藏", "社区模板导入"],
    limits: {
      maxPrompts: 50,
      maxMembersPerPrompt: 1,
      maxEvalRunsPerMonth: 100,
      maxPrivatePrompts: 20,
      maxApiKeys: 1,
      maxApiCallsPerMonth: 5000,
    },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "个人专业版",
    monthlyPriceCny: 79,
    yearlyPriceCny: 790,
    yearlyDiscountPercent: 17,
    recommended: true,
    trialDays: 14,
    features: ["无限公开提示词", "版本历史与回滚", "批量操作与高级筛选", "Prompt-as-Code 导入导出"],
    limits: {
      maxPrompts: 1000,
      maxMembersPerPrompt: 3,
      maxEvalRunsPerMonth: 3000,
      maxPrivatePrompts: 600,
      maxApiKeys: 10,
      maxApiCallsPerMonth: 200000,
    },
  },
  {
    id: "team",
    name: "Team",
    tagline: "团队协作",
    monthlyPriceCny: 299,
    yearlyPriceCny: 2990,
    yearlyDiscountPercent: 17,
    trialDays: 14,
    features: ["角色权限矩阵", "发布流审批", "团队评测看板", "审计日志导出"],
    limits: {
      maxPrompts: "unlimited",
      maxMembersPerPrompt: 20,
      maxEvalRunsPerMonth: 15000,
      maxPrivatePrompts: "unlimited",
      maxApiKeys: 50,
      maxApiCallsPerMonth: 2000000,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "企业定制",
    monthlyPriceCny: null,
    yearlyPriceCny: null,
    yearlyDiscountPercent: 0,
    trialDays: 30,
    features: ["私有化部署", "SSO 与组织策略", "合规审计报告", "专属支持与 SLA"],
    limits: {
      maxPrompts: "unlimited",
      maxMembersPerPrompt: "unlimited",
      maxEvalRunsPerMonth: "unlimited",
      maxPrivatePrompts: "unlimited",
      maxApiKeys: "unlimited",
      maxApiCallsPerMonth: "unlimited",
    },
  },
]

export function isSubscriptionPlanId(value: unknown): value is SubscriptionPlanId {
  return value === "free" || value === "pro" || value === "team" || value === "enterprise"
}

export function getSubscriptionPlanById(planId: SubscriptionPlanId) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? subscriptionPlans[0]
}
