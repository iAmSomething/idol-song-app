# Backend Area

이 디렉터리는 backend migration 관련 자산을 둔다.

현재 포함 범위:

- `src/`
  - Fastify read API skeleton
- `reports/`
  - JSON-to-Neon import summary artifact
- `sql/migrations/`
  - Neon baseline schema migration
- `sql/README.md`
  - migration apply / verify run note
- `scripts/`
  - plain SQL migration apply / schema verify helper
- `requirements-import.txt`
  - Python importer dependency note

## 로컬 실행

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm install
npm run build
PORT=3000 APP_TIMEZONE=Asia/Seoul npm run start
```

원칙:

- ORM이나 무거운 migration framework는 도입하지 않는다.
- 정본 schema는 plain SQL로 관리한다.
- apply / verify 도구는 SQL 실행 보조에만 사용한다.

## JSON Baseline Import

schema baseline이 적용된 뒤 current JSON snapshot을 canonical table로 backfill하려면 아래 순서를 사용한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 import_json_to_neon.py
```

기본 보고서 출력:

- `backend/reports/json_to_neon_import_summary.json`

입력 우선순위:

- entity / alias / official link: `web/src/data/artistProfiles.json`
- channel allowlist: `web/src/data/youtubeChannelAllowlists.json`
- release baseline: `web/src/data/releaseHistory.json`
- release detail / service / track / MV state: `web/src/data/releaseDetails.json`
- artwork: `web/src/data/releaseArtwork.json`
- upcoming / review / override state:
  - `web/src/data/upcomingCandidates.json`
  - `web/src/data/watchlist.json`
  - `release_detail_overrides.json`
  - `manual_review_queue.json`
  - `mv_manual_review_queue.json`

## Backend vs JSON Parity Report

import 이후 또는 projection refresh 이후 현재 backend state와 shipped JSON baseline을 비교하려면 아래 명령을 사용한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 build_backend_json_parity_report.py
```

기본 보고서 출력:

- `backend/reports/backend_json_parity_report.json`

현재 parity scope:

- alias / search coverage
- official links / YouTube allowlist coverage
- latest verified release selection
- upcoming counts / nearest upcoming / exact vs month-only separation
- title-track / double-title 표현
- YouTube Music / YouTube MV service-link state
- review-required counts
