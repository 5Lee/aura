import { PromptVersionSource } from "@prisma/client"

import { prisma } from "@/lib/db"
import { getOrSetPerfCache, invalidatePerfCacheByTag } from "@/lib/perf-cache"

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

  const created = await prisma.promptVersion.create({
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

  invalidatePerfCacheByTag(`prompt-versions:${promptId}`)
  return created
}

export async function listPromptVersions(promptId: string, take = 20) {
  return getOrSetPerfCache(
    `prompt-versions:${promptId}:take:${take}`,
    async () =>
      prisma.promptVersion.findMany({
        where: { promptId },
        orderBy: { version: "desc" },
        take,
        select: {
          id: true,
          promptId: true,
          version: true,
          source: true,
          changeSummary: true,
          title: true,
          content: true,
          description: true,
          categoryId: true,
          isPublic: true,
          tags: true,
          createdAt: true,
        },
      }),
    {
      ttlMs: 10000,
      tags: [`prompt-versions:${promptId}`],
    }
  )
}

export function invalidatePromptVersionListCache(promptId: string) {
  invalidatePerfCacheByTag(`prompt-versions:${promptId}`)
}
