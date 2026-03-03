import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const promptApiRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/route.ts", import.meta.url),
  "utf8"
)

test("prompt detail API enforces private prompt read access control", () => {
  assert.match(promptApiRouteSource, /const session = await getServerSession\(authOptions\)/)
  assert.match(promptApiRouteSource, /const isOwner = session\?\.user\?\.id === prompt\.authorId/)
  assert.match(promptApiRouteSource, /if \(!prompt\.isPublic && !isOwner\)/)
  assert.match(promptApiRouteSource, /\{ error: "请先登录" \}/)
  assert.match(promptApiRouteSource, /\{ error: "无权限查看此提示词" \}/)
})
