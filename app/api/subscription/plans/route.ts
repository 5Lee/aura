import { NextResponse } from "next/server"
import { subscriptionPlans } from "@/lib/subscription-plans"

export async function GET() {
  return NextResponse.json({
    plans: subscriptionPlans,
    currency: "CNY",
    generatedAt: new Date().toISOString(),
  })
}
