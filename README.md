# K-pop Release Calendar

This repo tracks K-pop release activity in two layers:

- verified release history for the web calendar
- weekly-scanned future comeback candidates for the broader watchlist

## Local commands

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install requests

python build_tracking_watchlist.py
python scan_upcoming_candidates.py

cp tracking_watchlist.json web/src/data/watchlist.json
cp upcoming_release_candidates.json web/src/data/upcomingCandidates.json

cd web
npm install
npm run dev
```

## Weekly GitHub Action

`.github/workflows/weekly-kpop-scan.yml` runs every Monday `00:00 UTC`, which is Monday `09:00 KST`.

The workflow:

- rebuilds the tracking watchlist
- scans future comeback candidates
- syncs refreshed JSON into the web app
- runs a production build
- commits data updates back to the repository if anything changed
