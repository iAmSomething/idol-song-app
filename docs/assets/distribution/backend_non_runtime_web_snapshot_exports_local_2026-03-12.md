# Backend Non-Runtime Web Snapshot Exports Local Verification (2026-03-12)

## Goal

Confirm scheduled workflow helpers no longer need to commit `web/src/data/*.json` directly and can export the generated snapshots into an explicit non-runtime location.

## Commands

```bash
cd backend
node --test ./scripts/lib/nonRuntimeWebSnapshotExport.test.mjs
npm run export:web-snapshots -- --source-workflow weekly-kpop-scan.yml --cadence-profile daily-upcoming

cd ..
source .venv/bin/activate
python3 hydrate_release_windows.py --today 2026-03-12 --group YENA --dry-run --upcoming-path upcoming_release_candidates.json --watchlist-path tracking_watchlist.json
GIT_DIR=/Users/gimtaehun/.gitdirs/idol-song-app.git \
GIT_WORK_TREE=/Users/gimtaehun/Desktop/idol-song-app \
python3 build_release_change_log.py \
  --upcoming-path upcoming_release_candidates.json \
  --releases-path group_latest_release_since_2025-06-01_mb.json \
  --output-path /tmp/idol-song-app-release-change-log.json
git diff --check
```

## Results

- export manifest created at `backend/exports/non_runtime_web_snapshots/manifest.json`
- exported file count: `9`
- exported files:
  - `artistProfiles.json`
  - `releaseArtwork.json`
  - `releaseChangeLog.json`
  - `releaseDetails.json`
  - `releaseHistory.json`
  - `releases.json`
  - `upcomingCandidates.json`
  - `watchlist.json`
  - `youtubeChannelAllowlists.json`
- `hydrate_release_windows.py` accepted root-path overrides without reintroducing workflow `cp` steps
- `build_release_change_log.py` accepted root input overrides and external output path
- `git diff --check` passed
