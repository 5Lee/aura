import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const loginPageSource = readFileSync(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8")
const registerPageSource = readFileSync(new URL("../app/(auth)/register/page.tsx", import.meta.url), "utf8")
const passwordFieldSource = readFileSync(
  new URL("../components/auth/password-field.tsx", import.meta.url),
  "utf8"
)
const captchaPreviewButtonSource = readFileSync(
  new URL("../components/auth/captcha-preview-button.tsx", import.meta.url),
  "utf8"
)
const authFormNoticeSource = readFileSync(
  new URL("../components/auth/auth-form-notice.tsx", import.meta.url),
  "utf8"
)
const inlineNoticeSource = readFileSync(
  new URL("../components/ui/inline-notice.tsx", import.meta.url),
  "utf8"
)

test("auth pages use richer interaction building blocks for password and captcha entry", () => {
  assert.match(loginPageSource, /AuthExperiencePanel/)
  assert.match(registerPageSource, /AuthExperiencePanel/)
  assert.match(loginPageSource, /PasswordField/)
  assert.match(registerPageSource, /PasswordField/)
  assert.match(loginPageSource, /CaptchaPreviewButton/)
  assert.match(registerPageSource, /CaptchaPreviewButton/)
  assert.match(loginPageSource, /captchaInputRef\.current\?\.focus\(\)/)
  assert.match(registerPageSource, /captchaInputRef\.current\?\.focus\(\)/)
})

test("password visibility and captcha refresh controls remain accessible", () => {
  assert.match(passwordFieldSource, /type=\{visible \? "text" : "password"\}/)
  assert.match(passwordFieldSource, /aria-label=\{visible \? "隐藏密码" : "显示密码"\}/)
  assert.match(captchaPreviewButtonSource, /type="button"/)
  assert.match(captchaPreviewButtonSource, /看不清？换一张/)
  assert.match(captchaPreviewButtonSource, /aria-label=\{`\$\{alt\}，点击刷新`\}/)
})

test("auth pages consolidate failure feedback into inline notices instead of stacked error toasts", () => {
  assert.match(loginPageSource, /AuthFormNotice/)
  assert.match(registerPageSource, /AuthFormNotice/)
  assert.match(authFormNoticeSource, /return <InlineNotice className=\{className\} message=\{message\} tone=\{tone\} \/>/)
  assert.match(inlineNoticeSource, /role=\{tone === "error" \|\| tone === "warning" \? "alert" : "status"\}/)
  assert.doesNotMatch(loginPageSource, /title: "登录失败"/)
  assert.doesNotMatch(registerPageSource, /title: "注册失败"/)
  assert.doesNotMatch(registerPageSource, /useToast/)
  assert.match(loginPageSource, /title: "登录成功"/)
})
