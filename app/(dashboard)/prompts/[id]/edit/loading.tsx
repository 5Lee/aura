import { PromptEditorShell } from "@/components/prompts/prompt-editor-shell"
import { PromptFormLoading } from "@/components/prompts/prompt-form-loading"

export default function EditPromptLoading() {
  return (
    <PromptEditorShell
      mode="edit"
      title="编辑提示词"
      description="正在准备编辑上下文、模板变量和本地草稿信息。"
      backHref="/prompts"
      backLabel="返回提示词库"
    >
      <PromptFormLoading />
    </PromptEditorShell>
  )
}
