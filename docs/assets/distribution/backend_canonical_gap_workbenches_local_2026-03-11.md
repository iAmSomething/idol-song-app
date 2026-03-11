# Backend Canonical Gap Workbenches Local Note (2026-03-11)

## Scope

- `#572` prioritized service-link gap queues
- `#573` cohort-based title-track gap queue
- `#574` entity-identity null workbench

## Commands

```bash
cd backend
npm run build
node --test ./scripts/lib/canonicalGapWorkbenches.test.mjs

set -a
source ~/.config/idol-song-app/neon.env
set +a

npm run gap:workbenches
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming

cd ..
source .venv/bin/activate
python build_backend_json_parity_report.py --bundle-path backend/reports/report_bundle_metadata.json

cd backend
npm run shadow:verify -- --bundle-path ./reports/report_bundle_metadata.json
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
```

## Artifact Snapshot

- `service_link_gap_queues.json`
  - total `5155`
  - `spotify=1693`
  - `youtube_music=1718`
  - `youtube_mv=1744`
  - tier_1 rows
    - `spotify=817`
    - `youtube_music=841`
    - `youtube_mv=860`
- `title_track_gap_queue.json`
  - total `1694`
  - double-title candidates `63`
- `entity_identity_workbench.json`
  - entities `117`
  - field rows `324`
  - identity-critical rows `155`

## Notes

- report bundle now stamps the three new workbench artifacts alongside null coverage / cadence artifacts.
- runtime gate remains `fail`, but the new workbench artifacts are included in the bundle and `bundle_consistency` is `pass`.
- parity/shadow drift is still pre-existing migration work:
  - parity: YouTube allowlist / title-track / service-link / review-count drift remain
  - shadow: entity detail / release detail shape drift remain
