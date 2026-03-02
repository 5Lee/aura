import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PromptForm } from "@/components/prompts/prompt-form"
import Link from "next/link"

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
    include: { tags: true },
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
  }

  return (
    <div className="max-w-2xl mx-auto">
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

      <Card>
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
