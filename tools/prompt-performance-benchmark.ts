interface BenchmarkArgs {
  size: number
  rounds: number
  pageSize: number
  targetP95Ms: number
}

interface PromptSample {
  id: string
  title: string
  content: string
  description: string
  categoryId: string
  tagNames: string[]
  authorId: string
  isPublic: boolean
  updatedAt: number
}

function parseArgs(argv: string[]): BenchmarkArgs {
  const map = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith("--")) {
      continue
    }

    const key = current.replace(/^--/, "")
    const next = argv[index + 1]
    if (!next || next.startsWith("--")) {
      continue
    }

    map.set(key, next)
    index += 1
  }

  const resolveInt = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(map.get(key) || "")
    if (!Number.isFinite(value)) {
      return fallback
    }

    const rounded = Math.floor(value)
    if (rounded < min) return min
    if (rounded > max) return max
    return rounded
  }

  return {
    size: resolveInt("size", 1200, 1000, 50000),
    rounds: resolveInt("rounds", 300, 50, 20000),
    pageSize: resolveInt("page-size", 60, 20, 200),
    targetP95Ms: resolveInt("target-p95-ms", 80, 10, 5000),
  }
}

function buildDataset(size: number) {
  const categories = ["writing", "code", "analysis", "marketing", "support"]
  const tags = ["gpt-4", "agent", "rewrite", "summary", "product", "sql", "react", "test"]

  const list: PromptSample[] = []
  for (let index = 0; index < size; index += 1) {
    const categoryId = categories[index % categories.length]
    const authorId = `user-${index % 25}`
    const promptTags = [tags[index % tags.length], tags[(index + 3) % tags.length]]

    list.push({
      id: `prompt-${index}`,
      title: `Prompt ${index} ${categoryId}`,
      content: `content-${index} for ${categoryId} with ${promptTags.join(" ")}`,
      description: `description-${index}`,
      categoryId,
      tagNames: promptTags,
      authorId,
      isPublic: index % 3 === 0,
      updatedAt: Date.now() - index * 1000,
    })
  }

  return list
}

function runPromptQuery(
  dataset: PromptSample[],
  query: {
    q: string
    categoryId: string
    tag: string
    isPublicOnly: boolean
    page: number
    pageSize: number
  }
) {
  const filtered = dataset
    .filter((item) => {
      if (query.categoryId && item.categoryId !== query.categoryId) {
        return false
      }
      if (query.tag && !item.tagNames.includes(query.tag)) {
        return false
      }
      if (query.isPublicOnly && !item.isPublic) {
        return false
      }
      if (query.q) {
        const keyword = query.q.toLowerCase()
        const text = `${item.title} ${item.content} ${item.description}`.toLowerCase()
        return text.includes(keyword)
      }
      return true
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const skip = (query.page - 1) * query.pageSize
  const pageItems = filtered.slice(skip, skip + query.pageSize)
  return {
    total: filtered.length,
    pageItems,
  }
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[index]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dataset = buildDataset(args.size)

  const keywords = ["prompt", "code", "analysis", "support", "marketing", ""]
  const categories = ["", "writing", "code", "analysis", "marketing", "support"]
  const tags = ["", "gpt-4", "agent", "sql", "react", "test"]
  const latencies: number[] = []

  for (let round = 0; round < args.rounds; round += 1) {
    const query = {
      q: keywords[round % keywords.length],
      categoryId: categories[round % categories.length],
      tag: tags[round % tags.length],
      isPublicOnly: round % 2 === 0,
      page: (round % 6) + 1,
      pageSize: args.pageSize,
    }

    const startedAt = performance.now()
    runPromptQuery(dataset, query)
    const durationMs = performance.now() - startedAt
    latencies.push(Number(durationMs.toFixed(3)))
  }

  const p50 = percentile(latencies, 0.5)
  const p95 = percentile(latencies, 0.95)
  const p99 = percentile(latencies, 0.99)
  const max = percentile(latencies, 1)

  const result = {
    datasetSize: args.size,
    rounds: args.rounds,
    pageSize: args.pageSize,
    targetP95Ms: args.targetP95Ms,
    latencyMs: {
      p50,
      p95,
      p99,
      max,
    },
    pass: p95 <= args.targetP95Ms,
  }

  console.log(JSON.stringify(result, null, 2))

  if (!result.pass) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`[prompt-benchmark] fatal: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
