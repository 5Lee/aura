import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const registerPageSource = readFileSync(
  new URL("../app/(auth)/register/page.tsx", import.meta.url),
  "utf8"
)
const loginPageSource = readFileSync(
  new URL("../app/(auth)/login/page.tsx", import.meta.url),
  "utf8"
)
const registerRouteSource = readFileSync(
  new URL("../app/api/auth/register/route.ts", import.meta.url),
  "utf8"
)
const validateCredentialsRouteSource = readFileSync(
  new URL("../app/api/auth/validate-credentials/route.ts", import.meta.url),
  "utf8"
)
const authOptionsSource = readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8")
const registrationGuardSource = readFileSync(
  new URL("../lib/auth-registration-guard.ts", import.meta.url),
  "utf8"
)
const loginGuardSource = readFileSync(
  new URL("../lib/auth-login-guard.ts", import.meta.url),
  "utf8"
)
const humanVerificationSource = readFileSync(
  new URL("../lib/auth-human-verification.ts", import.meta.url),
  "utf8"
)
const distributedRateLimitSource = readFileSync(
  new URL("../lib/distributed-rate-limit.ts", import.meta.url),
  "utf8"
)
const captchaRouteSource = readFileSync(
  new URL("../app/api/auth/register-captcha/route.ts", import.meta.url),
  "utf8"
)
const loginCaptchaRouteSource = readFileSync(
  new URL("../app/api/auth/login-captcha/route.ts", import.meta.url),
  "utf8"
)
const verificationConfigRouteSource = readFileSync(
  new URL("../app/api/auth/human-verification-config/route.ts", import.meta.url),
  "utf8"
)

test("register page loads human verification config and supports captcha or turnstile submission", () => {
  assert.match(registerPageSource, /\/api\/auth\/human-verification-config/)
  assert.match(registerPageSource, /TurnstileWidget/)
  assert.match(registerPageSource, /registerCaptchaPath/)
  assert.match(registerPageSource, /captcha: normalizedCaptcha/)
  assert.match(registerPageSource, /turnstileToken/)
  assert.match(registerPageSource, /同一 IP 1 分钟内仅允许成功注册一次/)
})

test("login page performs guarded precheck, renders adaptive challenge UX and forwards login proof", () => {
  assert.match(loginPageSource, /\/api\/auth\/validate-credentials/)
  assert.match(loginPageSource, /\/api\/auth\/human-verification-config/)
  assert.match(loginPageSource, /const \[requiresChallenge, setRequiresChallenge\] = useState\(false\)/)
  assert.match(loginPageSource, /TurnstileWidget/)
  assert.match(loginPageSource, /loginProof: precheckResult\.loginProof/)
  assert.match(loginPageSource, /连续输错多次后将启用人机验证/)
})

test("register route validates human verification and claims ip slot before creating an account", () => {
  assert.match(registerRouteSource, /getHumanVerificationProvider/)
  assert.match(registerRouteSource, /verifyTurnstileToken/)
  assert.match(registerRouteSource, /validateRegistrationCaptchaToken/)
  assert.match(registerRouteSource, /claimRegistrationRateLimitSlot/)
  assert.match(registerRouteSource, /releaseRegistrationRateLimitSlot/)
  assert.match(registerRouteSource, /rateLimitSource/)
})

test("login validation route enforces adaptive challenge, rate limits and returns a signed login proof", () => {
  assert.match(validateCredentialsRouteSource, /consumeLoginAttempt/)
  assert.match(validateCredentialsRouteSource, /getLoginGuardState/)
  assert.match(validateCredentialsRouteSource, /recordLoginFailureState/)
  assert.match(validateCredentialsRouteSource, /createLoginProof/)
  assert.match(validateCredentialsRouteSource, /challengeRequired: true/)
  assert.match(validateCredentialsRouteSource, /login_rate_limited/)
})

test("credentials provider requires the precheck proof before final sign-in", () => {
  assert.match(authOptionsSource, /loginProof: \{ label: "登录校验", type: "text" \}/)
  assert.match(authOptionsSource, /validateLoginProof/)
  assert.match(authOptionsSource, /登录校验已失效，请重试/)
})

test("human verification helpers support text captcha fallback and turnstile verification", () => {
  assert.match(humanVerificationSource, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/)
  assert.match(humanVerificationSource, /TURNSTILE_SECRET_KEY/)
  assert.match(humanVerificationSource, /return resolveTurnstileConfig\(\) \? "turnstile" : "captcha"/)
  assert.match(humanVerificationSource, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/)
  assert.match(humanVerificationSource, /createHumanVerificationCaptchaChallenge/)
})

test("registration and login guard libs expose captcha, proof and adaptive rate-limit settings", () => {
  assert.match(registrationGuardSource, /REGISTRATION_RATE_LIMIT_WINDOW_SECONDS = 60/)
  assert.match(registrationGuardSource, /claimRegistrationRateLimitSlot/)
  assert.match(loginGuardSource, /LOGIN_PROOF_TTL_SECONDS = 2 \* 60/)
  assert.match(loginGuardSource, /LOGIN_CHALLENGE_FAILURE_THRESHOLD = 2/)
  assert.match(loginGuardSource, /LOGIN_RATE_LIMIT_MAX_FAILURES = 6/)
  assert.match(loginGuardSource, /LOGIN_ATTEMPT_MAX_REQUESTS = 8/)
  assert.match(loginGuardSource, /const \[latestSuccess, recentFailures\] = await Promise\.all\(\[/)
  assert.match(loginGuardSource, /const filteredFailures = latestSuccess/)
  assert.match(loginGuardSource, /createLoginProof/)
  assert.match(loginGuardSource, /validateLoginProof/)
})

test("captcha routes and runtime config route expose challenge endpoints for both auth flows", () => {
  assert.match(captchaRouteSource, /createRegistrationCaptchaChallenge/)
  assert.match(loginCaptchaRouteSource, /LOGIN_CAPTCHA_COOKIE_NAME/)
  assert.match(loginCaptchaRouteSource, /Content-Type": "image\/svg\+xml; charset=utf-8"/)
  assert.match(verificationConfigRouteSource, /getHumanVerificationClientConfig\(\)/)
  assert.match(verificationConfigRouteSource, /registerCaptchaPath/)
  assert.match(verificationConfigRouteSource, /loginCaptchaPath/)
})

test("distributed rate limit helper supports optional Upstash Redis backing", () => {
  assert.match(distributedRateLimitSource, /UPSTASH_REDIS_REST_URL/)
  assert.match(distributedRateLimitSource, /UPSTASH_REDIS_REST_TOKEN/)
  assert.match(distributedRateLimitSource, /claimDistributedRateLimitSlot/)
  assert.match(distributedRateLimitSource, /incrementDistributedRateLimitCounter/)
  assert.match(distributedRateLimitSource, /clearDistributedRateLimitKeys/)
})
