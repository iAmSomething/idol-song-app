# Backend Enrichment Progress Controls Local Verification

- Date: 2026-03-12
- Scope: `#664`

## What changed

- Added `--max-rows` to `build_release_details_musicbrainz.py`
- Added `--max-rows` to `backfill_release_detail_mvs.py`
- Added `--progress-every` to both scripts
- Progress logs now go to `stderr` only so JSON `stdout` remains machine-readable

## Verification

```bash
python3 -m py_compile build_release_details_musicbrainz.py backfill_release_detail_mvs.py test_build_release_details_musicbrainz.py test_backfill_release_detail_mvs.py
source .venv/bin/activate
python -m unittest test_build_release_details_musicbrainz.py test_backfill_release_detail_mvs.py
```

- Result: `20` tests passed

## Scoped smoke checks

Builder smoke was run with temp output paths and `--skip-acquisition`:

```bash
python build_release_details_musicbrainz.py --skip-acquisition --cohorts latest,recent --max-rows 3 --progress-every 2
```

- `execution_scope.selected_rows = 3`
- `execution_scope.scoped_rows_total = 815`
- `execution_scope.max_rows = 3`
- `execution_scope.progress_every = 2`
- stderr preview:
  - `processing 3/815 scoped rows`
  - `1/3 &TEAM / Blind Love / 2023-05-07 / song`
  - `2/3 &TEAM / First Howling : WE / 2023-06-14 / album`
  - `3/3 &TEAM / First Howling : NOW / 2023-11-15 / album`

Backfill smoke was run with temp copies of `releaseDetails` / `release_detail_overrides` and patched query fetch:

```bash
python backfill_release_detail_mvs.py --cohorts latest,recent --max-rows 3 --progress-every 2
```

- `execution_scope.selected_rows = 3`
- `execution_scope.scoped_rows_total = 815`
- `execution_scope.max_rows = 3`
- `execution_scope.progress_every = 2`
- stderr preview:
  - `processing 3/815 scoped rows`
  - `1/3 &TEAM / Blind Love / 2023-05-07 / song`
  - `2/3 &TEAM / First Howling : WE / 2023-06-14 / album`
  - `3/3 &TEAM / First Howling : NOW / 2023-11-15 / album`

## Notes

- No runtime snapshot files were intentionally mutated during smoke verification.
- The new controls are for targeted reruns only; default full-pass behavior is unchanged.
