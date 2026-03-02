import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'writing' },
      update: {},
      create: {
        name: '写作助手',
        slug: 'writing',
        description: '用于创意写作、内容创作等场景的提示词',
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'coding' },
      update: {},
      create: {
        name: '编程开发',
        slug: 'coding',
        description: '代码生成、调试、技术问题的提示词',
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'analysis' },
      update: {},
      create: {
        name: '数据分析',
        slug: 'analysis',
        description: '数据分析、报告生成相关的提示词',
        order: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'creative' },
      update: {},
      create: {
        name: '创意设计',
        slug: 'creative',
        description: '设计灵感、创意生成的提示词',
        order: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'education' },
      update: {},
      create: {
        name: '教育学习',
        slug: 'education',
        description: '学习辅导、知识讲解相关的提示词',
        order: 5,
      },
    }),
  ])

  // Create tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { slug: 'gpt4' },
      update: {},
      create: { name: 'GPT-4', slug: 'gpt4' },
    }),
    prisma.tag.upsert({
      where: { slug: 'claude' },
      update: {},
      create: { name: 'Claude', slug: 'claude' },
    }),
    prisma.tag.upsert({
      where: { slug: 'gemini' },
      update: {},
      create: { name: 'Gemini', slug: 'gemini' },
    }),
    prisma.tag.upsert({
      where: { slug: 'prompt-engineering' },
      update: {},
      create: { name: '提示工程', slug: 'prompt-engineering' },
    }),
  ])

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123456', 10)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@aura.ai' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@aura.ai',
      password: hashedPassword,
    },
  })

  // Create sample prompts
  const samplePrompts = [
    {
      title: '文章写作助手',
      content: '你是一位专业的文章写作助手。请根据我提供的主题，创作一篇结构清晰、内容丰富的文章。文章应包括：引人入胜的标题、简洁的导语、3-5个主体段落（每个段落有明确的主题句和支撑细节），以及一个有力的结尾。',
      description: '用于创作高质量文章的提示词模板',
      categoryId: categories[0].id,
      authorId: demoUser.id,
      isPublic: true,
      tagIds: [tags[0].id, tags[3].id],
    },
    {
      title: '代码审查专家',
      content: '你是一位资深代码审查专家。请仔细审查以下代码，重点关注：1. 代码质量和可读性 2. 潜在的bug和边界情况 3. 性能优化建议 4. 安全性问题 5. 最佳实践建议。请提供具体的改进建议和代码示例。',
      description: '帮助发现代码问题并提供改进建议',
      categoryId: categories[1].id,
      authorId: demoUser.id,
      isPublic: true,
      tagIds: [tags[0].id],
    },
    {
      title: '数据分析助手',
      content: '你是一位数据分析专家。我将提供一组数据，请你帮我：1. 分析数据的整体趋势和模式 2. 识别异常值和特殊情况 3. 提供可视化建议 4. 给出可行的业务洞察和建议。请用清晰易懂的语言解释你的分析结果。',
      description: '专业的数据分析辅助工具',
      categoryId: categories[2].id,
      authorId: demoUser.id,
      isPublic: true,
      tagIds: [tags[1].id],
    },
  ]

  for (const promptData of samplePrompts) {
    const { tagIds, ...data } = promptData

    // Create prompt
    const prompt = await prisma.prompt.upsert({
      where: { id: promptData.title.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: data,
    })

    // Create tag relations
    for (const tagId of tagIds) {
      await prisma.promptTag.upsert({
        where: {
          promptId_tagId: {
            promptId: prompt.id,
            tagId: tagId,
          },
        },
        update: {},
        create: {
          promptId: prompt.id,
          tagId: tagId,
        },
      })
    }
  }

  console.log('数据库种子数据创建成功！')
  console.log('测试账号: demo@aura.ai / demo123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
