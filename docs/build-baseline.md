# Production Build Baseline

Last verified: 2026-03-03

## Goal

Keep `npm run build` reproducible in offline or restricted-network environments.

## Applied Stabilization

- Removed `next/font/google` usage from `app/layout.tsx` to avoid runtime fetches to `fonts.googleapis.com`.
- Kept typography tokens by defining local-first CSS font variables in `styles/design-tokens.css`.

## Minimal Reproduction Steps

```bash
rm -rf .next
npm ci --ignore-scripts
npm run db:generate
npm run build
```

Expected result:

- Next.js production build completes successfully without `ENOTFOUND fonts.googleapis.com`.

## Verification Snapshot (2026-03-03)

- `npm ci --ignore-scripts --no-audit --no-fund` ✅
- `npm run db:generate` ✅
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅
