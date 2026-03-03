# Unified Quality Gate

Phase 2 Week 3 uses a single CI workflow to gate merge readiness for `main`.

## Gate Matrix

| Stage | Command | Purpose |
|---|---|---|
| Typecheck | `npm run typecheck` | Validate TypeScript correctness |
| Lint | `npm run lint` | Enforce style and static quality rules |
| Test | `npm test` | Verify functional regressions (unit + workflow tests) |
| Build | `npm run build` | Confirm production build is reproducible |

Workflow file: `.github/workflows/quality-gate.yml`

## Fast Failure定位

- Each gate stage runs as an explicitly named CI step:
  - `Stage 1 - Typecheck`
  - `Stage 2 - Lint`
  - `Stage 3 - Test`
  - `Stage 4 - Build`
- When a stage fails, GitHub Actions immediately reports the failing stage name.

## Branch Protection Recommendation

To require gate pass before merge, set branch protection for `main`:

1. GitHub repository settings -> Branches -> Branch protection rules.
2. Add/Update rule for `main`.
3. Enable **Require status checks to pass before merging**.
4. Select the `Quality Gate` workflow check as required.
