# Backend Worker Cadence Warm-up Local Evidence

- date: 2026-03-11
- issue: #530
- branch: `codex/dev/530-worker-cadence-warmup`

## Commands

```bash
cd backend
node --test ./scripts/lib/workerCadenceEvidence.test.mjs
npm run worker:cadence
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
npm run runtime:gate
npm run migration:scorecard
```

## Observed worker cadence evidence

- `daily_upcoming`
  - `cadence_status=scheduled_evidence_missing`
  - `first_expected_run_at=2026-03-07T00:00:00.000Z`
  - `expected_scheduled_runs_by_now=5`
  - `observed_scheduled_runs=0`
  - `missed_scheduled_windows=5`
- `catalog_enrichment`
  - `cadence_status=warming_up`
  - `first_expected_run_at=2026-03-15T01:00:00.000Z`
  - `warmup_deadline_at=2026-03-16T01:00:00.000Z`
  - `expected_scheduled_runs_by_now=0`

## Runtime / readiness interpretation

- `runtime_gate_report.json`
  - worker cadence summary line: `worker cadence: fail (cadence_status=scheduled_evidence_missing, missed_windows=5)`
- `migration_readiness_scorecard.json`
  - backend runtime blocker reasons keep `worker_cadence=fail`
  - previous null-style reading is gone; summary now points to `scheduled_evidence_missing`

## Notes

- This issue does not make runtime health pass.
- It replaces the null-based cadence failure with schedule-aware evidence:
  - warm-up when the first scheduled window has not matured
  - explicit missing evidence when scheduled windows have elapsed without a sample
