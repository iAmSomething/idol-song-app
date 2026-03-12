# Backend MV Query Plan Expansion Local Check (2026-03-12)

## Scope
- broaden `backfill_release_detail_mvs.py` query planning for latest/recent MV recovery work
- keep the change limited to search-plan generation and runtime-safe caps

## Changes Verified
- `QUERY_SUFFIXES` now includes:
  - `official mv`
  - `official music video`
  - `mv`
  - no-suffix fallback
- `pick_title_variants()` now keeps up to two explicit title tracks before falling back to the release title
- `build_queries()` now:
  - uses all name variants for the primary title
  - uses the primary group name for secondary title variants
  - caps the total at `MAX_QUERIES_PER_RELEASE = 12`
- `MAX_RESULTS_PER_QUERY` increased from `8` to `12`

## Local Verification
- `source .venv/bin/activate && python -m unittest test_backfill_release_detail_mvs.py`
- representative expectations covered by tests:
  - `IVE / REVIVE+` includes query variants for `BLACKHOLE` and `BANG BANG`
  - `(G)I-DLE / Mono` includes `official music video` and no-suffix fallbacks
  - `ZEROBASEONE / NEVER SAY NEVER` keeps both title tracks plus release-title fallback order

## Notes
- This change improves MV candidate discovery breadth but does not itself claim readiness-gate closure.
- Full latest/recent backfill rerun should be executed separately after merge because external YouTube queries remain time-consuming.
