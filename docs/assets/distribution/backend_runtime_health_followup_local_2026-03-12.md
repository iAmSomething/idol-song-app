## Backend Runtime Health Follow-up Local Evidence

- Date: 2026-03-12 (Asia/Seoul)
- Issue: #626
- Branch: `codex/dev/626-fix-worker-cadence-runtime-gate`

## Commands

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/backend
node --test ./scripts/lib/workerCadenceEvidence.test.mjs

source ~/.config/idol-song-app/neon.env
npm run projection:refresh
npm run worker:cadence
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming

cd /Users/gimtaehun/Desktop/idol-song-app
source .venv/bin/activate
python3 build_backend_json_parity_report.py --bundle-path backend/reports/report_bundle_metadata.json

cd /Users/gimtaehun/Desktop/idol-song-app/backend
npm run shadow:verify -- --bundle-path ./reports/report_bundle_metadata.json
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
npm run migration:scorecard -- --bundle-path ./reports/report_bundle_metadata.json
npm run smoke:live -- --base-url https://idol-song-app-production.up.railway.app --target preview
```

## Results

- `worker_cadence_report.json`
  - `topology.daily_upcoming.cadence_status = scheduled_evidence_missing`
  - `topology.daily_upcoming.scheduled_evidence.schedule_reference_at = 2026-03-06T07:34:09.000Z`
  - `topology.daily_upcoming.scheduled_evidence.expected_scheduled_runs_by_now = 6`
  - `topology.daily_upcoming.scheduled_evidence.missed_scheduled_windows = 6`
- `runtime_gate_report.json`
  - `runtime_checks.projection_freshness.status = pass`
  - `runtime_checks.worker_cadence.status = fail`
  - `runtime_checks.worker_cadence.observed.cadence_status = scheduled_evidence_missing`
  - `summary_lines` now identify the blocker as `worker cadence: fail (cadence_status=scheduled_evidence_missing, missed_windows=6)`
- `migration_readiness_scorecard.json`
  - `overall.status = fail`
  - `overall.score_percent = 65.9`
  - `backend_runtime_health.blocker_reasons` includes `worker_cadence=fail`
- `live_backend_smoke_report.json`
  - current preview target (`https://idol-song-app-production.up.railway.app`) returned `502` for `/health`, `/ready`, and all fixture checks
  - this confirms preview/external smoke remains blocked outside the scope of the cadence/freshness fix

## Notes

- The runtime-health blocker is no longer hidden behind `warming_up`.
- Freshness is current; the surviving runtime blocker is missing scheduled GitHub Actions cadence evidence for the daily upcoming workflow.
- Preview live smoke still fails on the currently configured preview target and remains tracked separately under preview rollout work.
- Remaining parity/shadow/catalog blockers are still present but are outside the scope of `#626`.
