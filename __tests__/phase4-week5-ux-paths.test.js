import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const promptFormSource = readFileSync(new URL("../components/prompts/prompt-form.tsx", import.meta.url), "utf8")
const editPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/edit/page.tsx", import.meta.url),
  "utf8"
)
const workflowPanelSource = readFileSync(
  new URL("../components/prompts/prompt-workflow-panel.tsx", import.meta.url),
  "utf8"
)
const versionPanelSource = readFileSync(
  new URL("../components/prompts/prompt-version-panel.tsx", import.meta.url),
  "utf8"
)
const detailActionsSource = readFileSync(
  new URL("../components/prompts/prompt-detail-actions.tsx", import.meta.url),
  "utf8"
)

test("prompt form supports local draft recovery and mobile-first action bar", () => {
  assert.match(promptFormSource, /aura:prompt-form-draft:/)
  assert.match(promptFormSource, /检测到本地草稿/)
  assert.match(promptFormSource, /恢复草稿/)
  assert.match(promptFormSource, /草稿已自动保存到本地/)
  assert.match(promptFormSource, /sticky bottom-2/)
})

test("edit page now relies on permission matrix instead of owner-only check", () => {
  assert.match(editPageSource, /resolvePromptPermission/)
  assert.match(editPageSource, /if \(!permission\.canEdit\)/)
})

test("workflow panel gives recovery guidance for private prompts before publish", () => {
  assert.match(workflowPanelSource, /无法流转到“已发布”/)
  assert.match(workflowPanelSource, /前往编辑页开启公开可见/)
})

test("version panel surfaces retry path after rollback or history loading failures", () => {
  assert.match(versionPanelSource, /panelError/)
  assert.match(versionPanelSource, /重试加载/)
  assert.match(versionPanelSource, /await fetchVersions\(\)/)
})

test("prompt detail actions include in-flight delete guard and feedback", () => {
  assert.match(detailActionsSource, /const \[isDeleting, setIsDeleting\]/)
  assert.match(detailActionsSource, /if \(isDeleting\)/)
  assert.match(detailActionsSource, /删除中\.\.\./)
})
