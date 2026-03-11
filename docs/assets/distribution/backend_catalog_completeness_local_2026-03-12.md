# Backend Catalog Completeness Local Note (2026-03-12)

- Issue: `#603`
- Goal: refresh canonical null coverage / readiness evidence after canonical release sync and confirm that `catalog_completeness` blocker narrowed to smaller latest/recent cohorts.

## Commands

```bash
source ~/.config/idol-song-app/neon.env
source .venv/bin/activate

cd backend
npm run null:coverage
npm run null:recheck
npm run null:trend
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming

cd ..
python3 build_backend_json_parity_report.py \
  --bundle-path backend/reports/report_bundle_metadata.json \
  --report-path backend/reports/backend_json_parity_report.json

cd backend
npm run shadow:verify -- --bundle-path ./reports/report_bundle_metadata.json
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
npm run migration:scorecard -- --bundle-path ./reports/report_bundle_metadata.json
```

## Observed Changes

- `backend_json_parity_report.json`
  - stayed `clean=true`
- `backend_shadow_read_report.json`
  - stayed `clean=true`
- `canonical_null_coverage_report.json`
  - unresolved: `3762 -> 2516`
  - `releases.title_track`: `4.3% -> 67.5%`
  - `release_service_links.youtube_mv`: `1.5% -> 8.7%`
  - `entities.official_youtube`: `75.2% -> 75.2%` (no meaningful change)
  - `entities.official_x`: `93.2% -> 93.2%`
  - `entities.official_instagram`: `99.1% -> 99.1%`
- `migration_readiness_scorecard.json`
  - `catalog_completeness score_percent`: `75.1 -> 77.3`
  - blocker reasons narrowed to:
    - latest/recent title-track
    - latest/recent `youtube_mv`
    - latest/recent `official_youtube`
    - latest `official_x`
    - latest `official_instagram`

## Current Catalog Blockers

- historical gate still fails:
  - `title-track resolved coverage: 67.8%`
  - `canonical MV coverage: 8.6%`
- latest/recent floors still fail:
  - `releases.title_track latest 75.5% < 95.0%`
  - `release_service_links.youtube_mv latest 26.4% < 80.0%`
  - `entities.official_youtube latest 75.3% < 100.0%`
  - `releases.title_track recent 68.9% < 85.0%`
  - `release_service_links.youtube_mv recent 1.8% < 55.0%`
  - `entities.official_youtube recent 72.2% < 95.0%`

## Conclusion

- `#603` acceptance is met as a direct owner issue because:
  - key field-family unresolved counts materially decreased
  - scorecard `catalog_completeness` blocker reasons narrowed to smaller latest/recent cohorts
  - parity and shadow remain clean on the same bundle
- Remaining improvement work should continue in narrower child issues, especially latest/recent `youtube_mv`, `official_youtube`, and historical title-track/MV backfill queues.
