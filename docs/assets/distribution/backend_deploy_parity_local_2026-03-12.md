# Backend Deploy Parity Local Check (2026-03-12)

## Scope
- Issue: #602
- Goal: clear backend deploy parity drift for YouTube allowlists, title-track/service-link state, and release-scope review counts

## Changes
- Added migration `0008_release_service_link_no_mv_status.sql` so canonical `release_service_links` accepts `no_mv`.
- Updated `build_backend_json_parity_report.py` to:
  - compare release-scope review counts against `mv_candidate` ownership only
  - derive `youtube_mv` status counts from the same source service-link map used for deploy parity
  - resolve override-only / adjacent release-detail source rows for sparse duplicate releases

## Local verification
- `python3 -m py_compile build_backend_json_parity_report.py import_json_to_neon.py sync_release_pipeline_to_neon.py`
- `cd backend && npm run migrate:apply`
- `cd backend && npm run schema:verify`
- `python3 sync_release_pipeline_to_neon.py --summary-path backend/reports/release_pipeline_db_sync_summary.json`
- `python3 build_backend_json_parity_report.py --report-path backend/reports/backend_json_parity_report.json`
- `cd backend && npm run migration:scorecard`
- `git diff --check`

## Result
- `backend_json_parity_report.json`: `clean=true`
- `youtube_allowlists.clean = true`
- `title_tracks_and_double_title.clean = true`
- `release_service_links.clean = true`
- `review_required_counts.clean = true`
- `migration_readiness_scorecard.json`:
  - `backend_deploy_parity.status = pass`
  - `backend_deploy_parity.blocker_reasons = []`

## Notes
- Overall scorecard remains `fail` because runtime/null/historical completeness gates are still open, but deploy parity is no longer a blocker.
