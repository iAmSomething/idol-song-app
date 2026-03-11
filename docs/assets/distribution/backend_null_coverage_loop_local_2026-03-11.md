# Backend Null Coverage Loop Local Evidence (2026-03-11)

## Scope

- `#568` field-level canonical coverage report
- `#570` recency-aware recheck queue
- `#575` acceptable null vs fake default validation
- `#578` null coverage trend artifact
- `#583` cadence / owner checklist

## Commands

```bash
cd backend
npm run build
node --test ./scripts/lib/canonicalNullCoverage.test.mjs
npm test -- --runInBand ./src/lib/report-bundle.test.ts

source ~/.config/idol-song-app/neon.env
source ../.venv/bin/activate

cd backend
npm run worker:cadence
npm run null:coverage
npm run null:recheck
npm run null:trend
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming

cd ..
python build_backend_json_parity_report.py --bundle-path backend/reports/report_bundle_metadata.json

cd backend
npm run shadow:verify -- --bundle-path ./reports/report_bundle_metadata.json
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
npm run migration:scorecard -- --bundle-path ./reports/report_bundle_metadata.json
```

## Observed Results

- `canonical_null_coverage_report.json`
  - `field_observations=8139`
  - `unresolved_records=3762`
  - `fake_default_records=0`
  - latest Wave 1 floor failures:
    - `releases.title_track`
    - `release_service_links.youtube_mv`
    - `entities.official_youtube`
    - `entities.official_x`
    - `entities.official_instagram`
- `canonical_null_recheck_queue.json`
  - `queue_count=3762`
  - `escalate_review=0`
- `null_coverage_trend_report.json`
  - `baseline_available=false`
  - `critical_regressions=0`
  - initial snapshot only
- `runtime_gate_report.json`
  - `critical_null_coverage=fail`
  - `shadow_to_web_cutover=fail`
  - `web_cutover_to_json_demotion=fail`
- `migration_readiness_scorecard.json`
  - `overall=fail`
  - `score=59.6/100`
  - `catalog_completeness=fail`
- `worker_cadence_report.json`
  - `daily_upcoming=no_scheduled_sample`
  - `catalog_enrichment=no_scheduled_sample`

## Notes

- null-hygiene chain now runs end-to-end and produces bundle-linked artifacts.
- trend report starts from a baseline-only snapshot, so week-over-week delta will become meaningful from the next run onward.
- readiness remains blocked by existing parity / shadow / runtime / coverage gaps; this work adds visibility and repeatable operating artifacts rather than claiming cutover readiness.
