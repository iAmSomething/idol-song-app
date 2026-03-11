# Runtime Artifact Retention Report

- generated_at: 2026-03-11T18:26:28.738Z
- retention_policy_version: v1

## Summary

- runtime-facing canonical groups: 3
- runtime-facing canonical files: 26
- duplicate files detected: 0
- retention status: canonical only

## Duplicate Inventory

- No runtime-facing suffix duplicates detected.

## Canonical Groups

### Repo root pipeline scripts

- canonical_count: 9
- duplicate_count: 0
- archival_rule: Delete suffix copies from repo root; use docs/assets/distribution or /tmp for comparison outputs.
- canonical: build_release_details_musicbrainz.py
- canonical: build_manual_review_queue.py
- canonical: build_release_change_log.py
- canonical: build_release_history_musicbrainz.py
- canonical: build_release_rollup_from_history.py
- canonical: build_tracking_watchlist.py
- canonical: scan_upcoming_candidates.py
- canonical: build_canonical_entity_metadata.py
- canonical: build_release_artwork_catalog.py

### Repo root runtime-facing generated data

- canonical_count: 9
- duplicate_count: 0
- archival_rule: Keep one canonical file per artifact; archive dated evidence in docs/assets/distribution.
- canonical: tracking_watchlist.json
- canonical: upcoming_release_candidates.json
- canonical: manual_review_queue.json
- canonical: manual_review_queue.csv
- canonical: canonical_entity_metadata.json
- canonical: verified_release_history_mb.json
- canonical: verified_release_history_mb.csv
- canonical: group_latest_release_since_2025-06-01_mb.json
- canonical: group_latest_release_since_2025-06-01_mb.csv

### Web runtime data exports

- canonical_count: 8
- duplicate_count: 0
- archival_rule: Suffix copies are forbidden in web/src/data because import/build paths must stay canonical.
- canonical: web/src/data/artistProfiles.json
- canonical: web/src/data/releaseArtwork.json
- canonical: web/src/data/releaseDetails.json
- canonical: web/src/data/releaseHistory.json
- canonical: web/src/data/releases.json
- canonical: web/src/data/upcomingCandidates.json
- canonical: web/src/data/watchlist.json
- canonical: web/src/data/youtubeChannelAllowlists.json

## Retention Rules

- Canonical runtime-facing files live only at documented repo-root paths and web/src/data exports.
- Suffix copies are not allowed in runtime-facing directories, even if they are untracked.
- Human review bundles and dated evidence belong in docs/assets/distribution, backend/reports, or /tmp, not beside canonical files.
- Import/build/runtime checks must reference canonical paths only.
