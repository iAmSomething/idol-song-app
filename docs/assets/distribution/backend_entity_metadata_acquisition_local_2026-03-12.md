# Backend Entity Metadata Acquisition Local 2026-03-12

## Scope

- Issue bundle: `#623`, `#631`
- Goal:
  - latest/recent entity cohort의 official YouTube / X / Instagram coverage를 끌어올린다.
  - `agency_name`에 dependable acquisition path를 추가하고 latest/recent coverage를 materially increase 한다.
  - canonical DB / projection / gate artifact를 같은 run bundle로 재생성한다.

## Commands

```bash
python3 -m unittest test_build_canonical_entity_metadata.py test_build_entity_metadata_acquisition.py
python3 -m py_compile build_entity_metadata_acquisition.py build_canonical_entity_metadata.py test_build_canonical_entity_metadata.py test_build_entity_metadata_acquisition.py
python3 build_entity_metadata_acquisition.py
python3 build_canonical_entity_metadata.py
python3 build_entity_asset_coverage_report.py

source ~/.config/idol-song-app/neon.env
source .venv/bin/activate
python3 import_json_to_neon.py --summary-path backend/reports/json_to_neon_import_summary.json

cd backend
npm run build
npm run projection:refresh
npm run worker:cadence
npm run null:coverage
npm run null:recheck
npm run null:trend
npm run gap:workbenches
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming

cd ..
python3 build_backend_json_parity_report.py \
  --bundle-path backend/reports/report_bundle_metadata.json \
  --report-path backend/reports/backend_json_parity_report.json

cd backend
npm run shadow:verify -- --bundle-path ./reports/report_bundle_metadata.json
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
npm run migration:scorecard -- --bundle-path ./reports/report_bundle_metadata.json

cd ..
git diff --check
```

## Acquisition Output

- `entity_metadata_acquisition.json`
  - row count: `101`
  - resolved field counts:
    - `official_youtube`: `98`
    - `official_x`: `2`
    - `official_instagram`: `1`
    - `agency_name`: `21`

## Canonical Entity Coverage

- overall canonical metadata:
  - `official_youtube`: `116 / 117`
  - `official_x`: `112 / 117`
  - `official_instagram`: `117 / 117`
  - `agency_name`: `78 / 117`
- remaining unresolved official YouTube:
  - `CSR`

## Latest / Recent Cohort Result

- `entities.official_youtube`
  - latest: `89 / 89` (`100%`)
  - recent: `18 / 18` (`100%`)
- `entities.official_x`
  - latest: `89 / 89` (`100%`)
  - recent: `18 / 18` (`100%`)
- `entities.official_instagram`
  - latest: `89 / 89` (`100%`)
  - recent: `18 / 18` (`100%`)
- `entities.agency_name`
  - latest: `68 / 89` (`76.4%`)
  - recent: `9 / 18` (`50.0%`)

## Notable Delta

- previous working baseline before this bundle:
  - `official_youtube`
    - latest: `67 / 89`
    - recent: `13 / 18`
  - `official_x`
    - latest: `87 / 89`
  - `official_instagram`
    - latest: `88 / 89`
  - `agency_name`
    - latest: `53 / 89`
    - recent: `3 / 18`
- current bundle moved latest/recent social floors to `100%` and agency coverage to:
  - latest: `53 -> 68`
  - recent: `3 -> 9`

## Downstream Artifacts

- `backend/reports/canonical_null_coverage_report.json`
  - unresolved records: `2388`
- `backend/reports/runtime_gate_report.json`
  - `critical null coverage` latest/recent social floors: pass
  - runtime report still blocked by release title-track / MV coverage and parity/shadow drift outside this issue scope
- `backend/reports/migration_readiness_scorecard.json`
  - score: `74.2 / 100`

## Notes

- official link parity is still not clean because backend official-link export currently includes additional canonical YouTube channel rows that the web parity baseline does not model yet.
- this bundle intentionally did not try to solve release-side blockers (`title_track`, `youtube_mv`) because those belong to separate child issues.
