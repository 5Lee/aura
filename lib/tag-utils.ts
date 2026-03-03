import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

function buildTagSlug(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return slug || "tag"
}

export function normalizeTagNames(input: unknown) {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()
  const tags: string[] = []

  for (const value of input) {
    const name = typeof value === "string" ? value.trim() : ""
    if (!name) {
      continue
    }

    const key = name.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    tags.push(name)
  }

  return tags
}

export async function findOrCreateTagByName(tagName: string) {
  const name = tagName.trim()
  if (!name) {
    return null
  }

  const existingByName = await prisma.tag.findUnique({
    where: { name },
  })
  if (existingByName) {
    return existingByName
  }

  const baseSlug = buildTagSlug(name)
  let slugCandidate = baseSlug
  let attempt = 1

  while (attempt <= 20) {
    try {
      return await prisma.tag.create({
        data: {
          name,
          slug: slugCandidate,
        },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error
      }

      const conflictFields = Array.isArray(error.meta?.target)
        ? error.meta.target.map((item) => String(item))
        : []

      if (conflictFields.includes("name")) {
        const conflictedTag = await prisma.tag.findUnique({ where: { name } })
        if (conflictedTag) {
          return conflictedTag
        }
      }

      slugCandidate = `${baseSlug}-${attempt}`
      attempt += 1
    }
  }

  throw new Error("无法为标签生成唯一 slug")
}
