import assert from "node:assert/strict"
import test from "node:test"
import { existsSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const loginSource = readFileSync(resolve(rootDir, "app/(auth)/login/page.tsx"), "utf8")
const registerSource = readFileSync(resolve(rootDir, "app/(auth)/register/page.tsx"), "utf8")
const middlewareSource = readFileSync(resolve(rootDir, "middleware.ts"), "utf8")
const editPageSource = readFileSync(resolve(rootDir, "app/(dashboard)/prompts/[id]/edit/page.tsx"), "utf8")
const promptFormSource = readFileSync(resolve(rootDir, "components/prompts/prompt-form.tsx"), "utf8")
const mobileNavSource = readFileSync(resolve(rootDir, "components/layout/mobile-nav-sheet.tsx"), "utf8")

test("favicon exists and avoids homepage 404 noise", () => {
  const faviconPath = resolve(rootDir, "public/favicon.ico")
  assert.equal(existsSync(faviconPath), true)
  assert.ok(statSync(faviconPath).size > 0)
})

test("login form uses custom validation flow and prechecks credentials without 401 callback noise", () => {
  assert.match(loginSource, /<form onSubmit=\{handleSubmit\} noValidate className="w-full">/)
  assert.match(loginSource, /fetch\("\/api\/auth\/validate-credentials"/)
  assert.match(loginSource, /if \(!precheckResult\.ok\)/)
})

test("register redirect relies on login-page success notice to avoid duplicate toasts", () => {
  assert.match(registerSource, /router\.push\("\/login\?registered=true"\)/)
  assert.doesNotMatch(registerSource, /title: "注册成功"/)
  assert.match(loginSource, /title: "注册已完成"/)
})

test("protected pages redirect from middleware before dashboard shell renders", () => {
  assert.match(middlewareSource, /"\/dashboard\/:path\*"/)
  assert.match(middlewareSource, /"\/prompts\/:path\*"/)
  assert.match(middlewareSource, /"\/collections\/:path\*"/)
  assert.match(middlewareSource, /"\/billing\/:path\*"/)
  assert.match(middlewareSource, /"\/support\/:path\*"/)
  assert.match(middlewareSource, /"\/branding\/:path\*"/)
  assert.match(middlewareSource, /"\/sla\/:path\*"/)
  assert.match(middlewareSource, /"\/sso\/:path\*"/)
  assert.match(middlewareSource, /"\/compliance\/:path\*"/)
  assert.match(middlewareSource, /loginUrl\.searchParams\.set\("callbackUrl", callbackUrl\)/)
})

test("edit prompt keeps original tags when user does not change them", () => {
  assert.match(editPageSource, /tags: prompt\.tags\.map\(\(promptTag\) => promptTag\.tag\.name\)\.join\(", "\)/)
  assert.match(promptFormSource, /const \[tags, setTags\] = useState\(initialData\?\.tags \|\| ""\)/)
})

test("mobile nav overlay no longer uses unnamed button control", () => {
  assert.match(mobileNavSource, /<div\s+className="absolute inset-0 bg-foreground\/35 backdrop-blur-\[1px\]"/)
  assert.doesNotMatch(mobileNavSource, /<button\s+type="button"\s+className="absolute inset-0 bg-foreground\/35/)
})
