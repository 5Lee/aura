import { expect, test } from "@playwright/test"

import {
  ensureValidPlaywrightMcp,
  openInlineHtml,
  resolveE2EUrl,
} from "./helpers/playwright-helpers.js"

test("resolves urls using the shared helper", () => {
  expect(resolveE2EUrl("/login", "http://localhost:3000")).toBe("http://localhost:3000/login")
})

test("validates .mcp.json playwright server config", async () => {
  const server = await ensureValidPlaywrightMcp()

  expect(server.command).toBe("npx")
  expect(server.args.length).toBeGreaterThan(0)
})

test("launches a page fixture and reads inline html", async ({ page }) => {
  await openInlineHtml(page, "<html><body><h1>Aura Playwright Smoke</h1></body></html>")

  const html = await page.content()
  expect(html).toContain("Aura Playwright Smoke")
})
