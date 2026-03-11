# Migration Readiness Scorecard

Generated at: 2026-03-11T16:50:09.148Z

## Overall

- status: `fail`
- score: `85.5/100`
- cutover blocked: `true`

## Blockers

- Backend runtime health: stage_gate:shadow_to_web_cutover=fail; stage_gate:web_cutover_to_json_demotion=fail
- Catalog completeness: title_track_resolved overall=67.9 pre_2024=65.2; canonical_mv overall=8.6 pre_2024=6.4; releases.title_track latest 75.5% < 95.0%; release_service_links.youtube_mv latest 26.4% < 80.0%; entities.official_youtube latest 75.3% < 100.0%; entities.official_x latest 97.8% < 100.0%; entities.official_instagram latest 98.9% < 100.0%; releases.title_track recent 68.9% < 85.0%; release_service_links.youtube_mv recent 1.8% < 55.0%; entities.official_youtube recent 72.2% < 95.0%

## Category Table

| Category | Weight | Score | Status | Blocker | Primary reason |
| --- | ---: | ---: | --- | --- | --- |
| Backend runtime health | 25 | 60 | fail | yes | stage_gate:shadow_to_web_cutover=fail |
| Backend deploy parity | 20 | 100 | pass | yes | - |
| Web backend-only stability | 20 | 100 | pass | yes | - |
| Mobile runtime mode | 15 | 100 | pass | yes | - |
| Catalog completeness | 20 | 77.3 | fail | yes | title_track_resolved overall=67.9 pre_2024=65.2 |

## Summary Lines

- overall readiness: fail (85.5/100)
- Backend runtime health: fail (60/100) [BLOCKER] - stage_gate:shadow_to_web_cutover=fail
- Backend deploy parity: pass (100/100) - no blocker reason
- Web backend-only stability: pass (100/100) - no blocker reason
- Mobile runtime mode: pass (100/100) - no blocker reason
- Catalog completeness: fail (77.3/100) [BLOCKER] - title_track_resolved overall=67.9 pre_2024=65.2
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
