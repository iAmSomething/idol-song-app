# Backend Area

이 디렉터리는 backend migration 관련 자산을 둔다.

backend-backed web cutover가 열린 이후에는 committed JSON snapshot을 production truth로 보지 않는다.
cut-over surface의 primary read path는 API이고, committed JSON은 transitional fallback / debug / export 역할만 가진다.

운영 runbook:

- `docs/specs/backend/migration-operations-runbook.md`
- `docs/specs/backend/web-cutover-rollback-drills.md`
- `docs/specs/backend/mobile-adoption-readiness-review.md`

현재 포함 범위:

- `src/`
  - Fastify read API skeleton
- `.env.preview.example`, `.env.production.example`
  - preview / production runtime config baseline
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

## DB Lifecycle

- API runtime은 `backend/src/lib/db.ts`의 `createDbPool()`을 공용 entrypoint로 사용한다.
- `buildApp()`가 pool을 직접 만들었든 주입받았든, shutdown은 `app.close()` 한 곳으로 수렴시키고 내부에서 `closeDbPool()`까지 처리한다.
- `backend/src/server.ts`는 `SIGINT`, `SIGTERM`에서 `app.close()`를 호출해 Fastify와 DB pool을 함께 정리한다.
- later worker / one-off script / test가 pool을 직접 만들면 종료 시 `closeDbPool()` 또는 `pool.end()`를 명시적으로 호출해야 한다.

## Preview / Staging Baseline

preview rehearsal은 production과 분리된 DB / API / worker 경로를 기준으로 진행한다.

- env template:
  - `backend/.env.preview.example`
  - `backend/.env.production.example`
- topology / rehearsal runbook:
  - `docs/specs/backend/preview-staging-backend-path.md`

권장 secret 파일:

- preview: `~/.config/idol-song-app/neon.preview.env`
- production: `~/.config/idol-song-app/neon.env`

preview에서 달라져도 되는 것:

- dataset size
- worker cadence
- log level

preview에서 달라지면 안 되는 것:

- endpoint shape
- field type / enum domain
- date precision / MV / service-link semantics

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

## Runtime Gate Evidence

cutover go/no-go에 필요한 runtime evidence는 아래 세 단계로 만든다.

1. read API latency / error sample

```bash
cd backend
npm run runtime:measure -- --base-url http://127.0.0.1:3213 --iterations 5
```

기본 보고서 출력:

- `backend/reports/read_api_runtime_measurements.json`

2. worker cadence sample

```bash
cd backend
npm run worker:cadence -- --workflow weekly-kpop-scan.yml --limit 12
```

기본 보고서 출력:

- `backend/reports/worker_cadence_report.json`

3. combined runtime gate report

```bash
cd backend
npm run runtime:gate
```

기본 보고서 출력:

- `backend/reports/runtime_gate_report.json`

gate 정의와 stage mapping은 아래 문서를 따른다.

- `docs/specs/backend/migration-runtime-gates.md`

## Web Cutover Rollback Drill Evidence

surface-local rollback rehearsal과 timing 기록은 아래 문서를 기준으로 본다.

- plan: `docs/specs/backend/web-cutover-rollback-drills.md`
- local evidence: `backend/reports/web_cutover_rollback_drill_2026-03-08.md`
