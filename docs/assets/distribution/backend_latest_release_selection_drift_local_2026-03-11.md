# Backend Latest Release Selection Drift Local Log (2026-03-11)

## Scope

- issue: `#532`
- goal: remove `latest verified release selection` drift from backend parity

## Commands

```bash
python3 -m unittest test_latest_verified_release_selection.py
python3 -m py_compile latest_verified_release_selection.py build_tracking_watchlist.py build_backend_json_parity_report.py map_latest_releases_musicbrainz.py build_release_history_musicbrainz.py build_release_rollup_from_history.py test_latest_verified_release_selection.py

source .venv/bin/activate
python build_release_rollup_from_history.py
python build_tracking_watchlist.py
cp tracking_watchlist.json web/src/data/watchlist.json

set -a
source ~/.config/idol-song-app/neon.env
set +a

python sync_upcoming_pipeline_to_neon.py --summary-path backend/reports/upcoming_pipeline_db_sync_summary.json
(cd backend && npm run projection:refresh)
python build_backend_json_parity_report.py --report-path backend/reports/backend_json_parity_report.json
```

## Before

- parity drift count: `3`
- mismatches:
  - `BLACKPINK album`: `DEADLINE 2026-02-26` vs DB `2026-02-27`
  - `H1-KEY album`: `Lovestruck 2025-06-26` vs DB `LOVECHAPTER 2026-03-05`
  - `LE SSERAFIM song`: `SPAGHETTI 2025-10-24` vs DB `Pearlies (My oyster is the world) 2025-10-24`

## After

- parity summary line:
  - `latest verified release selection: clean (tracking mismatches=0, stream mismatches=0)`
- source rollup / watchlist / web data:
  - `BLACKPINK -> DEADLINE / 2026-02-27 / album`
  - `H1-KEY -> LOVECHAPTER / 2026-03-05 / album`
  - `LE SSERAFIM -> Pearlies (My oyster is the world) / 2025-10-24 / song`
- backend read verification:
  - `/v1/search?q=BLACKPINK` latest release -> `DEADLINE / 2026-02-27 / album`
  - `/v1/search?q=H1-KEY` latest release -> `LOVECHAPTER / 2026-03-05 / album`
  - `/v1/search?q=LE%20SSERAFIM` latest release -> `Pearlies (My oyster is the world) / 2025-10-24 / song`
  - `/v1/entities/blackpink`, `/v1/entities/h1-key`, `/v1/entities/le-sserafim` latest release matched the same values

## Rule Locked

- latest verified release selection now uses:
  1. exact `release_date` descending
  2. same date: `album` before `song`
  3. same date + same stream: normalized `release_title` ascending
