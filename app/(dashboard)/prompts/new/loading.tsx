import { PromptEditorShell } from "@/components/prompts/prompt-editor-shell"
import { PromptFormLoading } from "@/components/prompts/prompt-form-loading"

export default function NewPromptLoading() {
  return (
    <PromptEditorShell
      mode="create"
      title="创建新提示词"
      description="正在准备分类、模板变量和默认编辑环境。"
      backHref="/prompts"
      backLabel="返回提示词库"
    >
      <PromptFormLoading />
    </PromptEditorShell>
  )
}
