import { PromptVersionSource } from "@prisma/client"

import { prisma } from "@/lib/db"

interface CreatePromptVersionSnapshotOptions {
  promptId: string
  source: PromptVersionSource
  actorId?: string
  changeSummary?: string
}

export async function createPromptVersionSnapshot({
  promptId,
  source,
  actorId,
  changeSummary,
}: CreatePromptVersionSnapshotOptions) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  })

  if (!prompt) {
    return null
  }

  const latestVersion = await prisma.promptVersion.findFirst({
    where: { promptId },
    orderBy: { version: "desc" },
    select: { version: true },
  })

  const version = (latestVersion?.version ?? 0) + 1

  return prisma.promptVersion.create({
    data: {
      promptId,
      version,
      source,
      changeSummary: changeSummary || null,
      title: prompt.title,
      content: prompt.content,
      description: prompt.description,
      categoryId: prompt.categoryId,
      isPublic: prompt.isPublic,
      tags: prompt.tags.map((item) => item.tag.name),
      createdById: actorId || null,
    },
  })
}

export async function listPromptVersions(promptId: string, take = 20) {
  return prisma.promptVersion.findMany({
    where: { promptId },
    orderBy: { version: "desc" },
    take,
  })
}
