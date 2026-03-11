# Backend Entity Metadata / Artwork Coverage Local Verification (2026-03-12)

## Scope

- Issue bundle: `#538`, `#539`
- Branch: `codex/dev/538-539-canonical-entity-asset-metadata`

## Commands

```bash
python3 -m unittest \
  test_build_canonical_entity_metadata.py \
  test_build_release_artwork_catalog.py \
  test_import_json_to_neon.py

python3 -m py_compile \
  build_canonical_entity_metadata.py \
  build_release_artwork_catalog.py \
  build_entity_asset_coverage_report.py \
  import_json_to_neon.py \
  sync_release_pipeline_to_neon.py \
  hydrate_release_windows.py

python3 build_canonical_entity_metadata.py
python3 build_release_artwork_catalog.py
python3 build_entity_asset_coverage_report.py

source ~/.config/idol-song-app/neon.env
source .venv/bin/activate

cd backend
npm run build
npm run migrate:apply
npm run schema:verify

cd ..
python3 sync_release_pipeline_to_neon.py \
  --summary-path backend/reports/release_pipeline_db_sync_summary.json

cd backend
npm run projection:refresh
npx tsx --test ./src/route-contract.test.ts

cd ..
git diff --check
```

## Results

- unit tests: `PASS`
- Python compile: `PASS`
- backend TypeScript build: `PASS`
- migration apply:
  - `applied: 0009_entity_metadata_and_artwork_states.sql`
  - `applied: 0010_projection_entity_asset_metadata.sql`
- schema verify: `PASS`
- route contract test: `17/17 PASS`
- diff hygiene: `PASS`

## Coverage Snapshot

- canonical entity rows: `117`
- representative image:
  - `resolved=77`
  - `review_needed=40`
- official links:
  - `youtube resolved=88`
  - `x resolved=110`
  - `instagram resolved=116`
- agency:
  - `resolved=57`
  - `review_needed=60`
- debut year:
  - `resolved=8`
  - `review_needed=109`
- release artwork rows: `1770 / 1770`
- release artwork coverage ratio: `1.0`
- release artwork status: `verified=1770`

## Canonical DB Sync Snapshot

- `canonical_entity_metadata=117`
- `entity_metadata_fields inserted=702`
- `entity_official_links updated=429 inserted=1`
- `release_artwork inserted=1654 updated=116`
- `db_row_counts.release_artwork=1771`
- `db_row_counts.entity_metadata_fields=702`
- `projection row_counts.entity_detail_projection=117`
- `projection row_counts.release_detail_projection=1771`

## Notes

- entity metadata merge logic preserves `*_source_url` on rerun instead of treating provenance strings as URLs.
- projection payloads were redefined in `0010_projection_entity_asset_metadata.sql` so existing Neon environments receive the new field metadata/artwork status shape without checksum drift on already-applied migrations.
