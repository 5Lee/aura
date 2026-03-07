import dynamic from "next/dynamic"
import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"

import { PromptEditorShell } from "@/components/prompts/prompt-editor-shell"
import { PromptFormLoading } from "@/components/prompts/prompt-form-loading"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePromptPermission } from "@/lib/prompt-permissions"

const PromptForm = dynamic(
  () => import("@/components/prompts/prompt-form").then((module) => module.PromptForm),
  {
    loading: () => <PromptFormLoading />,
  }
)

export default async function EditPromptPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      templateVariables: {
        orderBy: {
          name: "asc",
        },
      },
    },
  })

  if (!prompt) {
    notFound()
  }

  const permission = await resolvePromptPermission(
    {
      promptId: prompt.id,
      isPublic: prompt.isPublic,
      publishStatus: prompt.publishStatus,
      authorId: prompt.authorId,
    },
    session.user.id
  )

  if (!permission.canEdit) {
    redirect("/prompts")
  }

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  })

  const initialData = {
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    description: prompt.description || "",
    categoryId: prompt.categoryId,
    isPublic: prompt.isPublic,
    tags: prompt.tags.map((promptTag) => promptTag.tag.name).join(", "),
    templateVariables: prompt.templateVariables.map((item) => ({
      name: item.name,
      type: (["string", "number", "boolean", "json"].includes(item.type) ? item.type : "string") as
        | "string"
        | "number"
        | "boolean"
        | "json",
      required: item.required,
      defaultValue: item.defaultValue || "",
      description: item.description || "",
      options: Array.isArray(item.options)
        ? item.options.filter((option): option is string => typeof option === "string")
        : [],
      minLength: item.minLength ?? undefined,
      maxLength: item.maxLength ?? undefined,
    })),
  }

  return (
    <PromptEditorShell
      mode="edit"
      title="编辑提示词"
      description="继续完善标题、内容、模板变量和分享方式，让这条提示词更适合长期复用与团队协作。"
      backHref={`/prompts/${prompt.id}`}
      backLabel="返回详情"
    >
      <PromptForm categories={categories} initialData={initialData} />
    </PromptEditorShell>
  )
}
