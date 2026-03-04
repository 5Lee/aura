import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import dynamic from "next/dynamic"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PromptFormLoading } from "@/components/prompts/prompt-form-loading"

const PromptForm = dynamic(
  () => import("@/components/prompts/prompt-form").then((module) => module.PromptForm),
  {
    loading: () => <PromptFormLoading />,
  }
)

export default async function NewPromptPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  })

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">创建新提示词</h1>
        <p className="text-gray-600 dark:text-gray-400">
          添加一个新的 AI 提示词到你的库中（编辑内容会自动保存本地草稿）
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>提示词信息</CardTitle>
          <CardDescription>
            填写提示词的详细信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  )
}
