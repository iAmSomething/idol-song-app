# Migration Readiness Scorecard

Generated at: 2026-03-10T13:51:35.363Z

## Overall

- status: `fail`
- score: `59.9/100`
- cutover blocked: `true`

## Blockers

- Backend runtime health: worker_cadence=fail; stage_gate:shadow_to_web_cutover=fail; stage_gate:web_cutover_to_json_demotion=fail
- Backend deploy parity: parity_clean=false (latest_verified_release_selection drift=3)
- Web backend-only stability: entity_detail clean_ratio=0.25; release_detail clean_ratio=0
- Catalog completeness: title_track_resolved overall=64.5 pre_2024=62; canonical_mv overall=6.3 pre_2024=3.3

## Category Table

| Category | Weight | Score | Status | Blocker | Primary reason |
| --- | ---: | ---: | --- | --- | --- |
| Backend runtime health | 25 | 52 | fail | yes | worker_cadence=fail |
| Backend deploy parity | 20 | 40 | fail | yes | parity_clean=false (latest_verified_release_selection drift=3) |
| Web backend-only stability | 20 | 51.2 | fail | yes | entity_detail clean_ratio=0.25 |
| Mobile runtime mode | 15 | 100 | pass | yes | - |
| Catalog completeness | 20 | 68.2 | fail | yes | title_track_resolved overall=64.5 pre_2024=62 |

## Summary Lines

- overall readiness: fail (59.9/100)
- Backend runtime health: fail (52/100) [BLOCKER] - worker_cadence=fail
- Backend deploy parity: fail (40/100) [BLOCKER] - parity_clean=false (latest_verified_release_selection drift=3)
- Web backend-only stability: fail (51.2/100) [BLOCKER] - entity_detail clean_ratio=0.25
- Mobile runtime mode: pass (100/100) - no blocker reason
- Catalog completeness: fail (68.2/100) [BLOCKER] - title_track_resolved overall=64.5 pre_2024=62

## Evidence Paths

- runtime_gate_report: `backend/reports/runtime_gate_report.json`
- parity_report: `backend/reports/backend_json_parity_report.json`
- shadow_report: `backend/reports/backend_shadow_read_report.json`
- historical_coverage_report: `backend/reports/historical_release_detail_coverage_report.json`
- fixture_registry: `backend/fixtures/live_backend_smoke_fixtures.json`
- backend_deploy_workflow: `.github/workflows/backend-deploy.yml`
- mobile_runtime_config: `mobile/src/config/runtime.ts`
- mobile_dataset_source: `mobile/src/services/datasetSource.ts`
- mobile_debug_metadata: `mobile/src/config/debugMetadata.ts`
