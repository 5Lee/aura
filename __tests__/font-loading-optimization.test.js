import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const layoutSource = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8"
)
const designTokenSource = readFileSync(
  new URL("../styles/design-tokens.css", import.meta.url),
  "utf8"
)

const collectSourceFiles = (dirPath, files = []) => {
  for (const entry of readdirSync(dirPath)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") {
      continue
    }

    const fullPath = path.join(dirPath, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      collectSourceFiles(fullPath, files)
      continue
    }

    if (/\.(ts|tsx|js|jsx|css)$/.test(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

test("root layout avoids network-bound google font imports", () => {
  assert.doesNotMatch(layoutSource, /next\/font\/google/)
})

test("body keeps tailwind typography baseline class", () => {
  assert.match(layoutSource, /<body className="font-sans antialiased">/)
})

test("design tokens define local-first font variables and fallback stacks", () => {
  assert.match(designTokenSource, /--font-inter: 'Inter';/)
  assert.match(designTokenSource, /--font-jetbrains-mono: 'JetBrains Mono';/)
  assert.match(designTokenSource, /--font-family-sans: var\(--font-inter\), 'PingFang SC'/)
  assert.match(designTokenSource, /--font-family-mono: var\(--font-jetbrains-mono\), 'SFMono-Regular'/)
})

test("app and component source do not reference network font endpoints", () => {
  const projectRoot = new URL("..", import.meta.url)
  const targetDirs = ["app", "components", "styles"]
  const sourceFiles = targetDirs.flatMap((dir) =>
    collectSourceFiles(path.join(projectRoot.pathname, dir))
  )

  for (const filePath of sourceFiles) {
    const source = readFileSync(filePath, "utf8")
    assert.doesNotMatch(source, /next\/font\/google/, `${filePath} uses next/font/google`)
    assert.doesNotMatch(source, /fonts\.googleapis\.com/, `${filePath} references fonts.googleapis.com`)
    assert.doesNotMatch(source, /fonts\.gstatic\.com/, `${filePath} references fonts.gstatic.com`)
  }
})
