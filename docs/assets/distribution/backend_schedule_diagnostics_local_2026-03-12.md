## Backend schedule diagnostics local verification (2026-03-12)

### Commands

```bash
node --test ./backend/scripts/lib/workerCadenceEvidence.test.mjs

cd backend
npm run worker:cadence
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
npm run build
cd ..

git diff --check
```

### Key observations

- `backend/reports/workflow_schedule_diagnostics.json` is generated alongside `worker_cadence_report.json`.
- Repo-level diagnostics captured:
  - `default_branch = main`
  - `actions_enabled = true`
  - `allowed_actions = all`
  - `default_workflow_permissions = read`
- Workflow-level diagnostics captured:
  - `daily_upcoming.cadence_status = scheduled_evidence_missing`
  - `daily_upcoming.observed_scheduled_runs = 0`
  - `daily_upcoming.expected_scheduled_runs_by_now = 6`
  - `daily_upcoming.missed_scheduled_windows = 6`
  - `catalog_enrichment.cadence_status = warming_up`
- Actionable hint emitted:
  - `scheduled_delivery_missing`
  - Suggested next actions include checking default-branch schedule registration and re-enabling the workflow in GitHub Actions.
- `backend/reports/report_bundle_metadata.json` now includes `workflow_schedule_diagnostics` in `source_reports`.
