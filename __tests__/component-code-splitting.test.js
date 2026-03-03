import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const newPromptPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/new/page.tsx", import.meta.url),
  "utf8"
)
const editPromptPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/edit/page.tsx", import.meta.url),
  "utf8"
)
const detailPromptPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/page.tsx", import.meta.url),
  "utf8"
)
const formLoadingSource = readFileSync(
  new URL("../components/prompts/prompt-form-loading.tsx", import.meta.url),
  "utf8"
)
const dynamicLoadingSource = readFileSync(
  new URL("../components/prompts/prompt-dynamic-loading.tsx", import.meta.url),
  "utf8"
)

test("prompt new and edit pages lazy-load prompt form via next/dynamic", () => {
  assert.match(newPromptPageSource, /import dynamic from "next\/dynamic"/)
  assert.match(
    newPromptPageSource,
    /import\("@\/components\/prompts\/prompt-form"\)\.then\(\(module\) => module\.PromptForm\)/
  )
  assert.match(newPromptPageSource, /loading: \(\) => <PromptFormLoading \/>/)

  assert.match(editPromptPageSource, /import dynamic from "next\/dynamic"/)
  assert.match(
    editPromptPageSource,
    /import\("@\/components\/prompts\/prompt-form"\)\.then\(\(module\) => module\.PromptForm\)/
  )
  assert.match(editPromptPageSource, /loading: \(\) => <PromptFormLoading \/>/)
})

test("prompt detail page lazy-loads interactive action components", () => {
  assert.match(detailPromptPageSource, /import dynamic from "next\/dynamic"/)
  assert.match(
    detailPromptPageSource,
    /import\("@\/components\/prompts\/prompt-copy-button"\)\.then\(\(module\) => module\.PromptCopyButton\)/
  )
  assert.match(
    detailPromptPageSource,
    /import\("@\/components\/prompts\/prompt-detail-actions"\)\.then\(\s*\(module\) => module\.PromptDetailActions\s*\)/
  )
  assert.match(detailPromptPageSource, /loading: \(\) => <PromptCopyButtonLoading \/>/)
  assert.match(detailPromptPageSource, /loading: \(\) => <PromptDetailActionsLoading \/>/)
})

test("loading placeholders provide accessible status semantics", () => {
  assert.match(formLoadingSource, /aria-label="提示词表单加载中"/)
  assert.match(formLoadingSource, /role="status"/)
  assert.match(dynamicLoadingSource, /aria-label="操作区加载中"/)
  assert.match(dynamicLoadingSource, /aria-label="复制按钮加载中"/)
})
