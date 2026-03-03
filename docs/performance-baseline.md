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
npx --yes @lhci/cli@0.15.1 autorun --config=./lighthouserc.json
```
