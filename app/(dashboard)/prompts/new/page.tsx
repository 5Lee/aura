import dynamic from "next/dynamic"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { PromptEditorShell } from "@/components/prompts/prompt-editor-shell"
import { PromptFormLoading } from "@/components/prompts/prompt-form-loading"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
    <PromptEditorShell
      mode="create"
      title="创建新提示词"
      description="把常用任务沉淀成可复用资产，填写基础信息后即可继续补充变量、预览和分享方式。"
      backHref="/prompts"
      backLabel="返回提示词库"
    >
      <PromptForm categories={categories} />
    </PromptEditorShell>
  )
}
