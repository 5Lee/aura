import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import dynamic from "next/dynamic"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PromptFormLoading } from "@/components/prompts/prompt-form-loading"
import Link from "next/link"

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

  // Check ownership
  if (prompt.authorId !== session.user.id) {
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
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <Link href={`/prompts/${prompt.id}`}>
          <button className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-2">
            ← 返回详情
          </button>
        </Link>
        <h1 className="text-3xl font-bold">编辑提示词</h1>
        <p className="text-gray-600 dark:text-gray-400">
          修改你的 AI 提示词信息
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>提示词信息</CardTitle>
          <CardDescription>
            修改提示词的详细信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptForm categories={categories} initialData={initialData} />
        </CardContent>
      </Card>
    </div>
  )
}
