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

## Font Strategy (Offline-Stable)

- 不使用 `next/font/google`，避免构建阶段请求 `fonts.googleapis.com` / `fonts.gstatic.com`。
- 当前采用本地优先字体栈（`styles/design-tokens.css`）：
  - Sans: `Inter` -> `PingFang SC` -> `Hiragino Sans GB` -> `Microsoft YaHei` -> `Noto Sans CJK SC` -> `sans-serif`
  - Mono: `JetBrains Mono` -> `SFMono-Regular` -> `Menlo` -> `Monaco` -> `Consolas` -> `monospace`
- 性能影响：
  - 优点：构建链路在弱网/离线场景稳定，不会因为字体下载失败中断。
  - 代价：首屏字体可能由系统 fallback 呈现，跨设备字形一致性略低于远程托管字体。
  - 若后续需要统一字形，可引入 `next/font/local` + 项目内字体文件（不依赖外网）。

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
