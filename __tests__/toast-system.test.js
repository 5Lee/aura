import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const toasterSource = readFileSync(new URL("../components/ui/toaster.tsx", import.meta.url), "utf8")
const loginSource = readFileSync(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8")
const registerSource = readFileSync(
  new URL("../app/(auth)/register/page.tsx", import.meta.url),
  "utf8"
)
const promptFormSource = readFileSync(
  new URL("../components/prompts/prompt-form.tsx", import.meta.url),
  "utf8"
)
const promptActionsSource = readFileSync(
  new URL("../components/prompts/prompt-detail-actions.tsx", import.meta.url),
  "utf8"
)
const rootLayoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")

test("toaster supports success/error/info variants with default duration", () => {
  assert.match(toasterSource, /export type ToastType = "success" \| "error" \| "info"/)
  assert.match(toasterSource, /export const DEFAULT_TOAST_DURATION = 3000/)
  assert.match(toasterSource, /success: "border-success/)
  assert.match(toasterSource, /error: "border-destructive/)
  assert.match(toasterSource, /info: "border-info/)
})

test("auth flows use toast feedback for success and failure", () => {
  assert.match(loginSource, /useToast/)
  assert.match(loginSource, /type: "success"/)
  assert.match(loginSource, /type: "error"/)
  assert.match(loginSource, /type: "info"/)

  assert.match(registerSource, /useToast/)
  assert.match(registerSource, /router\.push\("\/login\?registered=true"\)/)
  assert.match(registerSource, /type: "error"/)
})

test("prompt CRUD flows emit toast notifications for create, edit and delete", () => {
  assert.match(promptFormSource, /type: "success"/)
  assert.match(promptFormSource, /type: "error"/)
  assert.match(promptActionsSource, /type: "success"/)
  assert.match(promptActionsSource, /type: "error"/)
  assert.match(promptActionsSource, /type: "info"/)
})

test("root layout mounts global toast provider", () => {
  assert.match(rootLayoutSource, /AppProviders/)
  assert.match(rootLayoutSource, /<AppProviders>\{children\}<\/AppProviders>/)
})
