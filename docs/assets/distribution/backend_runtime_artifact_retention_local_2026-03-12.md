# Backend Runtime Artifact Retention Local Note (2026-03-12)

## Goal

- close `#540`
- replace hard-coded duplicate artifact detection with a real scanner
- remove scanner double-counting in repo-root groups and widen runtime-facing canonical scope
- document canonical retention policy for runtime-facing JSON / pipeline scripts
- remove in-scope suffix duplicates from canonical runtime-facing paths

## Local checks

```bash
cd backend
node --test ./scripts/lib/runtimeArtifactRetention.test.mjs ./scripts/lib/backendGapAudit.test.mjs
npm run artifact:retention
npm run gap:audit
cd ..
git diff --check
```

## Observed duplicate inventory before cleanup

- `build_release_details_musicbrainz 2.py`
- `web/src/data/artistProfiles 2.json`
- `web/src/data/releaseArtwork 2.json`
- `web/src/data/releaseDetails 2.json`

## Observed duplicate inventory after cleanup

- duplicate count: `0`

## Notes

- gap audit now reads the runtime artifact scanner instead of a hard-coded file list.
- scanner now covers `hydrate_release_windows.py`, `upcoming_release_candidates.csv`, and `web/src/data/unresolved.json`.
- canonical retention policy is documented in `docs/specs/backend/runtime-artifact-retention-policy.md`.
- scope intentionally excludes mobile asset/doc duplicates and user scratch files outside runtime-facing import/build paths.
