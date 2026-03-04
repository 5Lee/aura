import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { sanitizeTemplateVariables } from "@/lib/prompt-template-variable-utils"
import { sanitizeJsonValue, sanitizeMultilineTextInput } from "@/lib/security"
import {
  renderPromptTemplate,
  validateTemplateInput,
  type PromptTemplateVariableDefinition,
} from "@/lib/prompt-template"

const MAX_TEMPLATE_LENGTH = 24000

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const { template, input, variables } = await request.json().catch(() => ({}))

    if (!template || typeof template !== "string") {
      return NextResponse.json({ error: "模板内容不能为空" }, { status: 400 })
    }

    const safeTemplate = sanitizeMultilineTextInput(template, MAX_TEMPLATE_LENGTH)
    if (!safeTemplate.trim()) {
      return NextResponse.json({ error: "模板内容不能为空" }, { status: 400 })
    }

    if (template.length > MAX_TEMPLATE_LENGTH) {
      return NextResponse.json({ error: `模板长度不能超过 ${MAX_TEMPLATE_LENGTH} 字符` }, { status: 400 })
    }

    const sanitizedVariableDefinitions = sanitizeTemplateVariables(variables)
    const variableDefinitions: PromptTemplateVariableDefinition[] = sanitizedVariableDefinitions.map((item) => ({
      name: item.name,
      type: item.type,
      required: item.required,
      defaultValue: item.defaultValue || undefined,
      minLength: item.minLength || undefined,
      maxLength: item.maxLength || undefined,
      options: item.options,
    }))
    const sanitizedInput = sanitizeJsonValue(input, {
      maxDepth: 6,
      maxKeysPerObject: 64,
      maxArrayLength: 100,
      maxStringLength: 2000,
    })
    const payload =
      sanitizedInput &&
      typeof sanitizedInput === "object" &&
      !Array.isArray(sanitizedInput)
        ? (sanitizedInput as Record<string, unknown>)
        : {}

    const validation = validateTemplateInput(variableDefinitions, payload as Record<string, unknown>)
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "变量校验失败",
          details: validation.errors,
        },
        { status: 400 }
      )
    }

    const rendered = renderPromptTemplate(safeTemplate, validation.normalizedInput)
    if (!rendered.ok) {
      return NextResponse.json(
        {
          error: rendered.error,
          missingVariables: rendered.missingVariables,
          preview: rendered.rendered,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      rendered: rendered.rendered,
      missingVariables: rendered.missingVariables,
    })
  } catch (error) {
    console.error("Render prompt template failed:", error)
    return NextResponse.json({ error: "模板渲染失败" }, { status: 500 })
  }
}
