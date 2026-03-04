import { NextResponse } from "next/server"

import {
  renderPromptTemplate,
  validateTemplateInput,
  type PromptTemplateVariableDefinition,
} from "@/lib/prompt-template"

export async function POST(request: Request) {
  try {
    const { template, input, variables } = await request.json()

    if (!template || typeof template !== "string") {
      return NextResponse.json({ error: "模板内容不能为空" }, { status: 400 })
    }

    const variableDefinitions = Array.isArray(variables)
      ? (variables as PromptTemplateVariableDefinition[])
      : []
    const payload = input && typeof input === "object" ? input : {}

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

    const rendered = renderPromptTemplate(template, validation.normalizedInput)
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
