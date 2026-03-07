# Backend Area

이 디렉터리는 backend migration 관련 자산을 둔다.

현재 포함 범위:

- `src/`
  - Fastify read API skeleton
- `reports/`
  - import / dual-write / projection refresh / parity summary artifact
- `sql/migrations/`
  - Neon canonical schema + projection read-model migration
- `sql/README.md`
  - migration apply / verify run note
- `scripts/`
  - plain SQL migration apply / schema verify / projection refresh helper
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

## Release Pipeline Dual-Write

기존 JSON export를 유지한 채 release hydration / service-link / MV review 흐름만 canonical DB에 다시 쓰려면 아래 명령을 사용한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 sync_release_pipeline_to_neon.py
```

기본 보고서 출력:

- `backend/reports/release_pipeline_db_sync_summary.json`

이 명령은 아래 JSON 산출물을 source-of-export로 유지한 채 canonical release-side table만 idempotent upsert 한다.

- `web/src/data/releaseDetails.json`
- `web/src/data/releaseHistory.json`
- `web/src/data/releaseArtwork.json`
- `web/src/data/youtubeChannelAllowlists.json`
- `release_detail_overrides.json`
- `mv_manual_review_queue.json`

## Upcoming Pipeline Dual-Write

기존 upcoming scan JSON export를 유지한 채 canonical DB에 `upcoming_signals`, `upcoming_signal_sources`, manual-review task, tracking state를 같이 쓰려면 아래 명령을 사용한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 sync_upcoming_pipeline_to_neon.py
```

기본 보고서 출력:

- `backend/reports/upcoming_pipeline_db_sync_summary.json`

이 명령은 아래 산출물을 source-of-export로 유지한 채 upcoming-side canonical table을 idempotent upsert 하고, 누락된 기존 signal은 inactive로 내린다.

- `tracking_watchlist.json`
- `upcoming_release_candidates.json`
- `manual_review_queue.json`
- `web/src/data/watchlist.json`
- `web/src/data/upcomingCandidates.json`

## Projection Refresh

canonical table import 또는 dual-write 이후 product-facing read model projection을 다시 만들려면 아래 명령을 사용한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm run migrate:apply
npm run schema:verify
npm run projection:refresh
```

기본 보고서 출력:

- `backend/reports/projection_refresh_summary.json`

현재 refresh 대상:

- `entity_search_documents`
- `calendar_month_projection`
- `entity_detail_projection`
- `release_detail_projection`
- `radar_projection`

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

## Endpoint Shadow Read Report

projection-backed read route를 current shipped web semantics와 직접 비교하려면 아래 명령을 사용한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm run shadow:verify
```

기본 보고서 출력:

- `backend/reports/backend_shadow_read_report.json`

현재 shadow-read scope:

- `/v1/search`
- `/v1/entities/:slug`
- `/v1/releases/lookup` + `/v1/releases/:id`
- `/v1/calendar/month`
- `/v1/radar`

리포트는 clean 여부와 함께 다음 drift category를 surface 한다.

- missing rows or segments
- alias-match differences
- exact-vs-month-only drift
- latest-release or next-upcoming drift
- title-track / MV-state drift
- radar eligibility drift
- field-shape mismatches
