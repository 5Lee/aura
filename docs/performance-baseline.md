# Lighthouse Performance Baseline

Phase 1 performance baseline is managed through Lighthouse CI with budgets in `lighthouserc.json`.

## Budget Targets

- LCP (`largest-contentful-paint`) <= 2500ms
- FID proxy (`max-potential-fid`) <= 100ms
- CLS (`cumulative-layout-shift`) <= 0.1
- Overall performance score >= 0.80 (warning threshold)

## Monitoring

- CI workflow: `.github/workflows/lighthouse-ci.yml`
- Triggered on `main` push, `main` pull requests, and weekly schedule
- Audits key pages:
  - `/`
  - `/browse`

## Local Run

```bash
npm run test:perf
```

## Network-Limited Fallback

- 默认 `npm run test:perf` 使用本地 `@lhci/cli`（`tools/testing/lhci-cli-lite`），不会触发 `npx` 临时下载。
- E2E 测试使用 `npm run test:e2e`（本地 `@playwright/test` lite 包）。
- 若需要完整在线 Lighthouse CLI，可手动运行：

```bash
npx --yes @lhci/cli@0.15.1 autorun --config=./lighthouserc.json
```
