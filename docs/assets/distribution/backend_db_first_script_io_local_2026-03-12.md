# Backend DB-first Script IO Local Verification (2026-03-12)

## Goal

`#640` 범위에서 남아 있던 collection / enrichment script가 `web/src/data` committed runtime snapshot을 primary input/output으로 요구하지 않는지 확인했다.

## Commands

```bash
python3 -m py_compile \
  non_runtime_dataset_paths.py \
  youtube_channel_allowlists.py \
  build_entity_metadata_acquisition.py \
  build_canonical_entity_metadata.py \
  build_release_artwork_catalog.py \
  build_release_details_musicbrainz.py \
  backfill_release_detail_mvs.py \
  build_mv_manual_review_queue.py \
  build_historical_manual_review_queue.py \
  hydrate_release_windows.py \
  build_entity_asset_coverage_report.py \
  import_json_to_neon.py \
  test_non_runtime_dataset_paths.py

source .venv/bin/activate
python -m unittest \
  test_non_runtime_dataset_paths.py \
  test_build_entity_metadata_acquisition.py \
  test_build_canonical_entity_metadata.py \
  test_build_release_artwork_catalog.py \
  test_youtube_channel_allowlists.py \
  test_build_release_details_musicbrainz.py

cd backend
node --test ./scripts/lib/nonRuntimeWebSnapshotExport.test.mjs ./scripts/lib/runtimeArtifactRetention.test.mjs
npm run export:web-snapshots -- --source-workflow catalog-enrichment-refresh.yml --cadence-profile weekly-enrichment
```

## Primary path resolution

대표 runtime-facing dataset는 아래 root snapshot을 primary로 사용한다.

- `artistProfiles.json -> artist_profiles_seed.json`
- `teamBadgeAssets.json -> team_badge_assets.json`
- `youtubeChannelAllowlists.json -> youtube_channel_allowlists.json`
- `releaseDetails.json -> release_detail_catalog.json`
- `releaseArtwork.json -> release_artwork_catalog.json`
- `releaseHistory.json -> verified_release_history_mb.json`
- `releases.json -> group_latest_release_since_2025-06-01_mb.json`
- `watchlist.json -> tracking_watchlist.json`
- `upcomingCandidates.json -> upcoming_release_candidates.json`

secondary mirror는 아래 두 경로로만 유지한다.

- `backend/exports/non_runtime_web_snapshots/*`
- `web/src/data/*`

## Web runtime snapshot absence check

`web/src/data`의 아래 파일을 임시로 치운 상태에서 대표 스크립트를 실행했다.

- `artistProfiles.json`
- `teamBadgeAssets.json`
- `youtubeChannelAllowlists.json`
- `releaseDetails.json`
- `releaseArtwork.json`
- `releaseHistory.json`
- `releases.json`
- `watchlist.json`
- `upcomingCandidates.json`

실행 스크립트:

```bash
python build_canonical_entity_metadata.py
python build_release_details_musicbrainz.py --skip-acquisition
python build_release_artwork_catalog.py
python build_mv_manual_review_queue.py
python build_entity_asset_coverage_report.py
```

관찰 결과:

- `build_canonical_entity_metadata.py` input:
  - `artist_profiles_input_json = artist_profiles_seed.json`
  - `team_badge_assets_input_json = team_badge_assets.json`
  - `youtube_allowlists_input_json = youtube_channel_allowlists.json`
- `build_release_details_musicbrainz.py` input:
  - `release_snapshot_input_json = group_latest_release_since_2025-06-01_mb.json`
  - `release_history_input_json = verified_release_history_mb.json`
  - `release_detail_input_json = release_detail_catalog.json`
- `build_release_artwork_catalog.py` input:
  - `input_json = verified_release_history_mb.json`

즉 정상 collection / enrichment 실행이 committed `web/src/data` runtime snapshot 없이도 계속된다.

## Result

- PASS: remaining audited scripts now treat root canonical snapshot as primary input/output
- PASS: web runtime JSON is kept as secondary mirror only
- PASS: export workflow reads root canonical snapshot instead of `web/src/data` for mirrored artifacts
