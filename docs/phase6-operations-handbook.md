# Phase6 Operations Handbook

## Final Acceptance Checklist
- Functional gate: complete
- Performance gate: complete
- Security gate: complete
- Release rehearsal: complete

## Runbook
- Daily Ops monitor: `/admin/ops-center`
- Notification orchestration: `/admin/notification-orchestration`
- Reliability gates: `/admin/reliability-gates`
- Self-heal center: `/admin/self-heal`

## Emergency Plan
1. Trigger rollback in `/admin/release-orchestration`
2. Broadcast outage notice from `/admin/notification-orchestration`
3. Apply self-heal suggestion after manual approval
4. Record incident timeline and owner in closure report

## Training Material
- Operator onboarding: explain queue, retries, and idempotency
- SRE runbook drill: quality gate + rollback rehearsal
- Business review: funnel and cohort interpretation guide

## Baseline Freeze
- Freeze tag format: `phase6-baseline-YYYYMMDD`
- Freeze condition: all gates pass and closure score >= 90

## Next Phase Roadmap
- Add tenant-level governance policy packs
- Add anomaly auto-routing to support queues
- Add canary-aware feature flag orchestration
