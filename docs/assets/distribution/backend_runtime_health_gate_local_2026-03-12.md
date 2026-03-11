## Backend Runtime Health Gate Local Evidence

- Date: 2026-03-12 (Asia/Seoul)
- Issue: #600
- Branch: `codex/dev/600-runtime-health-gate`

## Commands

```bash
source ~/.config/idol-song-app/neon.env
cd /Users/gimtaehun/Desktop/idol-song-app/backend
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
```

## Results

- `runtime_gate_report.json`
  - `projection_freshness.status = pass`
  - `worker_cadence.status = needs_review`
  - `worker_cadence.observed.cadence_status = warming_up`
- `worker_cadence_report.json`
  - `daily_upcoming.cadence_status = warming_up`
  - `daily_upcoming.scheduled_evidence.status = warming_up`
  - `daily_upcoming.scheduled_evidence.expected_scheduled_runs_by_now = 0`
  - `daily_upcoming.scheduled_evidence.missed_scheduled_windows = 0`
  - `daily_upcoming.scheduled_evidence.schedule_reference_at = 2026-03-11T13:45:16.000Z`
- `migration_readiness_scorecard.json`
  - `backend_runtime_health.blocker_reasons`
    - `stage_gate:shadow_to_web_cutover=fail`
    - `stage_gate:web_cutover_to_json_demotion=fail`
  - projection freshness and worker cadence fail reasons are no longer present

## Notes

- The runtime-health cutover blocker from stale projection freshness and incorrect scheduled-evidence math is resolved.
- Remaining readiness blockers are outside `#600` scope.
