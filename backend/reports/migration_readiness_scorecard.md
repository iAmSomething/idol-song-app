# Migration Readiness Scorecard

Generated at: 2026-03-13T00:12:56.266Z

## Overall

- status: `fail`
- score: `64.2/100`
- cutover blocked: `true`

## Blockers

- Backend runtime health: worker_cadence=fail; stage_gate:shadow_to_web_cutover=fail; stage_gate:web_cutover_to_json_demotion=fail
- Backend deploy parity: parity_clean=false (latest_verified_release_selection drift=1)
- Web backend-only stability: entity_detail clean_ratio=0.25; calendar_month clean_ratio=0.67; radar clean_ratio=0
- Catalog completeness: title_track_resolved overall=71.3 pre_2024=66.2; canonical_mv overall=9.7 pre_2024=0; migration_priority_slice title_track=0 canonical_mv=0; releases.title_track latest 75.3% < 95.0%; release_service_links.youtube_mv latest 26.6% < 80.0%; releases.title_track recent 69.3% < 85.0%; release_service_links.youtube_mv recent 1.8% < 55.0%

## Category Table

| Category | Weight | Score | Status | Blocker | Primary reason |
| --- | ---: | ---: | --- | --- | --- |
| Backend runtime health | 25 | 52 | fail | yes | worker_cadence=fail |
| Backend deploy parity | 20 | 40 | fail | yes | parity_clean=false (latest_verified_release_selection drift=1) |
| Web backend-only stability | 20 | 61.6 | fail | yes | entity_detail clean_ratio=0.25 |
| Mobile runtime mode | 15 | 100 | pass | yes | - |
| Catalog completeness | 20 | 79.4 | fail | yes | title_track_resolved overall=71.3 pre_2024=66.2 |

## Summary Lines

- overall readiness: fail (64.2/100)
- Backend runtime health: fail (52/100) [BLOCKER] - worker_cadence=fail
- Backend deploy parity: fail (40/100) [BLOCKER] - parity_clean=false (latest_verified_release_selection drift=1)
- Web backend-only stability: fail (61.6/100) [BLOCKER] - entity_detail clean_ratio=0.25
- Mobile runtime mode: pass (100/100) - no blocker reason
- Catalog completeness: fail (79.4/100) [BLOCKER] - title_track_resolved overall=71.3 pre_2024=66.2
- bundle consistency: pass

## Evidence Paths

- runtime_gate_report: `backend/reports/runtime_gate_report.json`
- parity_report: `backend/reports/backend_json_parity_report.json`
- shadow_report: `backend/reports/backend_shadow_read_report.json`
- historical_coverage_report: `backend/reports/historical_release_detail_coverage_report.json`
- canonical_null_coverage_report: `backend/reports/canonical_null_coverage_report.json`
- null_coverage_trend_report: `backend/reports/null_coverage_trend_report.json`
- bundle_report: `reports/report_bundle_metadata.json`
- fixture_registry: `backend/fixtures/live_backend_smoke_fixtures.json`
- backend_deploy_workflow: `.github/workflows/backend-deploy.yml`
- mobile_runtime_config: `mobile/src/config/runtime.ts`
- mobile_dataset_source: `mobile/src/services/datasetSource.ts`
- mobile_debug_metadata: `mobile/src/config/debugMetadata.ts`
