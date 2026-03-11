# Migration Readiness Scorecard

Generated at: 2026-03-11T08:31:07.905Z

## Overall

- status: `fail`
- score: `59.6/100`
- cutover blocked: `true`

## Blockers

- Backend runtime health: worker_cadence=fail; stage_gate:shadow_to_web_cutover=fail; stage_gate:web_cutover_to_json_demotion=fail
- Backend deploy parity: parity_clean=false (latest_verified_release_selection drift=0)
- Web backend-only stability: entity_detail clean_ratio=0.5; release_detail clean_ratio=0
- Catalog completeness: title_track_resolved overall=64.5 pre_2024=62; canonical_mv overall=6.3 pre_2024=3.3; releases.title_track latest 29.1% < 95.0%; release_service_links.youtube_mv latest 10.2% < 80.0%; entities.official_youtube latest 75.3% < 100.0%; entities.official_x latest 97.8% < 100.0%; entities.official_instagram latest 98.9% < 100.0%; releases.title_track recent 0.0% < 85.0%; release_service_links.youtube_mv recent 0.0% < 55.0%; entities.official_youtube recent 72.2% < 95.0%

## Category Table

| Category | Weight | Score | Status | Blocker | Primary reason |
| --- | ---: | ---: | --- | --- | --- |
| Backend runtime health | 25 | 42 | fail | yes | worker_cadence=fail |
| Backend deploy parity | 20 | 40 | fail | yes | parity_clean=false (latest_verified_release_selection drift=0) |
| Web backend-only stability | 20 | 57.5 | fail | yes | entity_detail clean_ratio=0.5 |
| Mobile runtime mode | 15 | 100 | pass | yes | - |
| Catalog completeness | 20 | 72.9 | fail | yes | title_track_resolved overall=64.5 pre_2024=62 |

## Summary Lines

- overall readiness: fail (59.6/100)
- Backend runtime health: fail (42/100) [BLOCKER] - worker_cadence=fail
- Backend deploy parity: fail (40/100) [BLOCKER] - parity_clean=false (latest_verified_release_selection drift=0)
- Web backend-only stability: fail (57.5/100) [BLOCKER] - entity_detail clean_ratio=0.5
- Mobile runtime mode: pass (100/100) - no blocker reason
- Catalog completeness: fail (72.9/100) [BLOCKER] - title_track_resolved overall=64.5 pre_2024=62
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
