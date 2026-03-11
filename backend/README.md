# Backend Area

이 디렉터리는 backend migration 관련 자산을 둔다.

backend-backed web cutover가 열린 이후에는 committed JSON snapshot을 production truth로 보지 않는다.
cut-over surface의 primary read path는 API이고, committed JSON은 transitional fallback / debug / export 역할만 가진다.

운영 runbook:

- `docs/specs/backend/migration-operations-runbook.md`
- `docs/specs/backend/web-cutover-rollback-drills.md`
- `docs/specs/backend/mobile-adoption-readiness-review.md`
- `docs/specs/backend/backend-secret-inventory-and-rotation.md`

현재 포함 범위:

- `src/`
  - Fastify read API skeleton
- `scripts/verify-deploy-env-contract.ts`
  - preview / production deploy 전에 Railway runtime env + GitHub deploy input completeness/drift를 검증
- `.env.preview.example`, `.env.production.example`
  - preview / production runtime config baseline
- `reports/`
  - import / dual-write / projection refresh / parity summary artifact
  - Pages publish gate가 읽는 backend freshness handoff artifact
  - backup / restore recovery drill artifact
  - secret rotation tabletop artifact
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

## Read API Envelope

- `/v1/*` read endpoint는 공통 success envelope `meta + data`를 사용한다.
- success `meta`에는 최소 `request_id`, `generated_at`, `timezone`, `route`, `source`가 포함된다.
- error는 공통 `meta + error` shape로 내려가고 code는 `invalid_request`, `not_found`, `disallowed_origin`, `rate_limited`, `stale_projection`, `internal_error`를 기본으로 쓴다.
- helper entrypoint는 `backend/src/lib/api.ts`다.
- caller가 `X-Request-Id`를 보내면 backend는 같은 값을 `meta.request_id`와 `X-Request-Id` response header에 그대로 되돌린다.
- caller가 보내지 않으면 backend가 `api-<uuid>` request id를 생성한다.
- runtime 측정 / shadow report도 각 request의 sent/received request id를 artifact에 함께 남긴다.

## Secret Inventory And Rotation Ownership

- canonical inventory:
  - `docs/specs/backend/backend-secret-inventory-and-rotation.md`
- tabletop artifact:
  - `backend/reports/backend_secret_rotation_tabletop_2026-03-08.md`

이 문서는 GitHub / Railway / Neon 기준의 backend secret / variable name contract,
owner role, rotation trigger, rollback baseline, current audit snapshot을 같이 관리한다.

## Public Read Rate Limits

정책 문서는 아래를 기준으로 본다.

- `docs/specs/backend/public-read-rate-limit-policy.md`

현재 runtime은 public read endpoint에 in-memory fixed-window limiter를 붙인다.

- `search`
- `calendarMonth`
- `entityDetail`
- `releaseDetail`
- `radar`

기본 window는 `60초`다.

- development
  - `search 600`, `calendarMonth 300`, `entityDetail 300`, `releaseDetail 300`, `radar 120`
- preview
  - `search 240`, `calendarMonth 180`, `entityDetail 240`, `releaseDetail 240`, `radar 90`
- production
  - `search 180`, `calendarMonth 120`, `entityDetail 180`, `releaseDetail 180`, `radar 60`

over-limit response는 `429 rate_limited`이며 아래 header를 같이 반환한다.

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
- `Retry-After`
- `X-RateLimit-Bucket`

## Normalization Helpers

- import / dual-write Python 경로는 `canonical_normalization.py`를 공통 entrypoint로 사용한다.
- backend read route는 `backend/src/lib/normalization.ts`를 공통 entrypoint로 사용한다.
- release lookup, slug path, search-alias normalization은 ad hoc trim/lower 구현을 새로 만들지 않는다.
- SQL projection의 `projection_normalize_text()`는 위 helper들과 같은 의미론을 유지해야 한다.

## DB Lifecycle

- API runtime은 `backend/src/lib/db.ts`의 `createDbPool()`을 공용 entrypoint로 사용한다.
- `buildApp()`가 pool을 직접 만들었든 주입받았든, shutdown은 `app.close()` 한 곳으로 수렴시키고 내부에서 `closeDbPool()`까지 처리한다.
- `backend/src/server.ts`는 `SIGINT`, `SIGTERM`에서 `app.close()`를 호출해 Fastify와 DB pool을 함께 정리한다.
- later worker / one-off script / test가 pool을 직접 만들면 종료 시 `closeDbPool()` 또는 `pool.end()`를 명시적으로 호출해야 한다.

## Health / Readiness

- `/health`
  - liveness 전용
  - process가 뜨고 route stack이 응답 가능한지만 본다
- `/ready`
  - deploy / rollback / production health 판단용
  - DB reachability에 더해 projection freshness와 dependency artifact 상태를 같이 본다
  - `status`는 `ready`, `degraded`, `not_ready` 중 하나다
  - `ready`
    - DB reachable
    - projection freshness healthy
    - parity / shadow / runtime gate artifact 모두 healthy
  - `degraded`
    - DB는 reachable
    - 하지만 projection freshness가 review 구간이거나 dependency artifact가 missing / unclean
  - `not_ready`
    - DB unreachable
    - 또는 projection freshness가 not-ready 구간
- `/ready`는 `Cache-Control: no-store`를 사용한다.

## Runtime-Fatal Failure Policy

- request-scoped read API error와 process-level fatal failure는 구분한다.
- request-scoped failure는 `backend/src/app.ts`의 error envelope를 따른다.
- process-level fatal failure는 `backend/src/runtime-failures.ts`가 담당한다.
- `uncaughtException`과 `unhandledRejection`은 recoverable 상태로 취급하지 않는다.
- 위 두 failure class는 structured fatal log를 먼저 남긴 뒤 같은 graceful shutdown 경로로 들어간다.
- runtime-fatal path의 종료 코드는 항상 `1`이다.
- shutdown이 `5초` 안에 끝나지 않으면 `Graceful shutdown timed out; forcing process exit`를 남기고 강제 종료한다.
- verification은 `backend/src/runtime-failures.test.ts`에서 `uncaughtException`, `unhandledRejection`, forced-timeout path를 각각 spawn 기반으로 확인한다.

## Structured Logging Policy

- 정책 문서:
  - `docs/specs/backend/structured-backend-logging-policy.md`
- 현재 runtime baseline:
  - development: `debug`
  - preview: `info`
  - production: `info`
- Fastify automatic request logging은 끄고, public read route는 `request completed` summary 한 줄로만 남긴다.
- `GET /health` success와 healthy `GET /ready`는 routine log에서 제외한다.
- degraded / not_ready `GET /ready`는 readiness snapshot 요약을 warn level로 남긴다.
- startup failure는 `failure_class=bootstrap`, runtime-fatal path는 `failure_class=uncaughtException|unhandledRejection` 구조를 따른다.
- request body, remote IP, raw cookie/authorization header는 routine log 필드에 포함하지 않는다.
- logger redaction은 `authorization`, `cookie`, `set-cookie`, `x-forwarded-for` 계열 header path에 고정한다.

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

preview에서 달라지면 안 되는 것:

- endpoint shape
- field type / enum domain
- date precision / MV / service-link semantics
- `LOG_LEVEL` baseline (`info`)

## Temporary Tunnel Fallback For Mobile External QA

stable public preview backend가 unavailable일 때만 임시 fallback으로 local backend를 HTTPS tunnel 뒤에 둔다.

예시:

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

cd backend
npm run build
PORT=3213 APP_TIMEZONE=Asia/Seoul npm run start

cloudflared tunnel --url http://127.0.0.1:3213
```

그 다음 mobile 쪽에서는 `mobile/.env.preview.tunnel.example`을 복사하고,
`EXPO_PUBLIC_API_BASE_URL`를 실제 tunnel URL로 바꾼 뒤 preview dev client를 붙인다.

규칙:

- tunnel은 임시 QA fallback일 뿐 production/preview deploy 대체가 아니다.
- sign-off 기본 경로는 `https://api.idol-song-app.example.com` 같은 stable public preview backend다.
- debug metadata에서 `Backend target = Temporary tunnel backend`를 확인해야 한다.

## Backend Deploy Path

repo-level backend deploy entrypoint는 아래 workflow다.

- `.github/workflows/backend-deploy.yml`

역할 분리:

- `preview`
  - `main`에 backend 관련 변경이 들어오면 자동 deploy
  - 같은 workflow를 `workflow_dispatch`로 수동 재실행할 수도 있음
- `production`
  - `workflow_dispatch`에서 `target=production`일 때만 deploy
  - preview rehearsal이 끝난 뒤 명시적으로 승격하는 용도

GitHub Environment baseline:

- `preview`
- `production`

각 GitHub Environment에 아래 값을 같은 이름으로 넣는다.

- secret: `RAILWAY_TOKEN`
- variable: `RAILWAY_PROJECT_ID`
- variable: `RAILWAY_ENVIRONMENT_ID`
- variable: `RAILWAY_SERVICE_ID`
- variable: `BACKEND_PUBLIC_URL`

deploy helper는 아래 스크립트다.

- `backend/scripts/deploy-backend.mjs`
- `backend/scripts/run-live-smoke-checks.mjs`
- `backend/scripts/verify-deploy-env-contract.ts`
- `backend/fixtures/live_backend_smoke_fixtures.json`

deploy 전에 environment contract를 먼저 확인한다.

- target example contract:
  - `backend/.env.preview.example`
  - `backend/.env.production.example`
- pre-deploy gate:
  - `cd backend && npm run deploy:env:verify -- --target preview`
  - `cd backend && npm run deploy:env:verify -- --target production`

검사 항목:

- GitHub deploy input presence
- preview / production example key-set drift
- shared invariant drift (`APP_TIMEZONE`, DB timeout, `LOG_LEVEL`)
- target-specific runtime env drift (`APP_ENV`, `PORT`, `WORKER_CADENCE_LABEL`, `WEB_ALLOWED_ORIGINS`)
- secret shape validation (`DATABASE_URL`, `DATABASE_URL_POOLED`)

secret raw value는 report/log에 남기지 않고 presence와 URL shape만 남긴다.

deploy workflow는 Railway deploy 직후 canonical fixture registry를 읽는 같은 live smoke contract를 preview / production 모두에 적용한다.

- `/health`
- `/ready`
- `/v1/search?q=최예나`
- `/v1/calendar/month?month=2026-03`
- `/v1/entities/yena`
- `/v1/releases/lookup?entity_slug=ive&title=REVIVE%2B&date=2026-02-23&stream=album` -> `/v1/releases/:id`
- `/v1/radar`

`/ready`는 현재 deploy smoke 기준으로 `ready` 또는 `degraded`를 허용하고, `database.status=ready`는 필수로 본다. fixture smoke는 known-good calendar / radar / entity / release detail payload가 `404/not_found` 또는 invalid shape로 내려오면 즉시 non-zero로 끝나고 deploy workflow도 실패한다.

artifact:

- preview: `backend/reports/live_backend_smoke_preview.json`
- production: `backend/reports/live_backend_smoke_production.json`
- preview freshness handoff: `backend/reports/backend_freshness_handoff_preview.json`
- production freshness handoff: `backend/reports/backend_freshness_handoff_production.json`
- repo-tracked Pages gate artifact: `backend/reports/backend_freshness_handoff.json`

Pages publish path는 repo에 커밋된 `backend/reports/backend_freshness_handoff.json`을 읽어 아래를 같이 검증한다.

- latest release pipeline sync summary가 존재하는지
- latest upcoming pipeline sync summary가 존재하는지
- projection refresh가 위 sync들 뒤에 실행됐는지
- artifact target URL / env가 `VITE_API_BASE_URL`, `VITE_BACKEND_TARGET_ENV`와 일치하는지
- handoff artifact가 과도하게 오래되지 않았는지

manual smoke 예시:

```bash
cd backend
npm run smoke:live -- --target preview --base-url https://preview.example.com --report-path ./reports/live_backend_smoke_preview.json
```

fixture registry를 바꿔서 deploy gate를 재현하고 싶으면 `--fixtures-path`로 다른 JSON을 넘기면 된다.

manual dry-run 예시:

```bash
BACKEND_DEPLOY_TARGET=preview \
RAILWAY_TOKEN=dummy \
RAILWAY_PROJECT_ID=project-id \
RAILWAY_ENVIRONMENT_ID=environment-id \
RAILWAY_SERVICE_ID=service-id \
node backend/scripts/deploy-backend.mjs --dry-run
```

web API origin guidance:

- preview rehearsal web/local build는 preview backend public URL을 `VITE_API_BASE_URL`에 넣는다.
- production Pages build는 production backend public URL을 repo variable `VITE_API_BASE_URL`에 넣는다.
- browser access를 열려면 backend 쪽 `WEB_ALLOWED_ORIGINS`도 해당 consumer origin과 같이 맞춰야 한다.

## Web CORS / Allowed Origins

- backend는 browser cross-origin read를 명시적으로 허용한다.
- 기본 production web origin은 `https://iamsomething.github.io`다.
- `APP_ENV=development`에서는 위 origin에 더해 `localhost/127.0.0.1`의 Vite 기본 포트(`4173`, `5173`)를 허용한다.
- `APP_ENV=preview`와 `APP_ENV=production`에서는 기본적으로 `https://iamsomething.github.io`만 허용하고, 추가 web consumer가 있으면 `WEB_ALLOWED_ORIGINS`에 comma-separated origin list로 넣는다.
- `WEB_ALLOWED_ORIGINS`에는 full page URL이 아니라 origin을 넣는 것이 원칙이지만, 실수로 path가 붙어도 loader가 origin만 추출한다.
- `Origin` 헤더가 없는 서버-사이드/CLI 요청은 그대로 허용한다.
- 허용되지 않은 browser origin은 `403 disallowed_origin`으로 명시적으로 거절한다.
- allowed origin request는 `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Max-Age`, `Vary: Origin`을 명시적으로 반환한다.

## Read Timeout Policy

backend runtime은 DB read를 indefinite wait로 두지 않는다.

- `DB_CONNECTION_TIMEOUT_MS`
  - pooled/direct DB 연결 확보 budget
  - 기본값: `3000`
- `DB_READ_TIMEOUT_MS`
  - read query / statement / lock wait budget
  - 기본값: `5000`

timeout으로 분류되는 DB read 오류는 read API에서 `504 timeout`으로 surface된다.

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

dry-run 예시:

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 import_json_to_neon.py --dry-run --summary-path /tmp/idol-song-app-import-dry-run.json
```

dry-run에서는 DB write를 commit하지 않고, summary에 아래 필드를 함께 남긴다.

- `mode=dry_run`, `dry_run`, `db_row_counts_before`, `db_row_counts_after`, `db_unchanged`
- `operation_counts`
- `table_counts`
  - table별 `payload_rows`, `db_rows_before`, `db_rows_after`, `projected_db_rows_after`, `insert_candidates`, `update_candidates`
- `dry_run_focus.table_counts`
  - insert/update/payload 기준으로 실제 review가 필요한 table만 따로 요약
- `anomalies`
  - `counts`: duplicate / dropped / missing-FK / unresolved / stale review task count
  - `by_table`: table별 duplicate / dropped / missing-FK sample count
  - `samples`: missing-FK sample, unresolved mapping, unresolved review link 샘플
- `dry_run_focus.anomalies`
  - non-zero anomaly count와 non-zero table bucket만 별도로 요약
- `dry_run_review`
  - dry-run이 보장하는 것과 보장하지 않는 것, 먼저 볼 review 순서

stdout 요약도 dry-run일 때는 `db_unchanged`와 `dry_run_focus`를 같이 출력해서,
artifact를 열기 전에도 insert/update 집중 구간과 anomaly 존재 여부를 바로 볼 수 있다.

## Backup / Restore Recovery Drill

recovery rehearsal 기준 문서는 아래를 본다.

- `docs/specs/backend/neon-backup-restore-recovery-drill.md`

현재 baseline drill command:

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm run build
npm run recovery:drill -- --report-path ./reports/neon_backup_restore_drill_2026-03-08.json
```

이 drill은 current Neon database 안에 isolated `recovery_backup_*`, `recovery_restore_*` schema를 만들고,
restored schema search path로 backend를 한 번 띄운 뒤 representative read smoke를 수행한다.
`/ready`는 restored schema에서 별도 projection/parity/shadow artifact를 다시 만들지 않는 한 `not_ready`일 수 있으므로,
이 drill에서는 success gate가 아니라 diagnostic snapshot으로만 기록한다.

artifact:

- `backend/reports/neon_backup_restore_drill_2026-03-08.json`

## Query Plan Regression Check

projection-backed exact lookup query의 index path regression은 아래 command로 확인한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm run plan:verify
```

artifact:

- `backend/reports/query_plan_regression_report.json`

이 check는 required projection index inventory와 `enable_seqscan=off` baseline probe를 함께 본다.
또한 planner에서 index path를 의도적으로 끈 controlled degraded scenario를 같이 실행해서,
checker가 degraded 상태를 실제로 감지하는지도 증명한다.
preview / production backend deploy workflow도 deploy 전에 같은 check를 실행하고 artifact를 업로드한다.

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

scheduled workflow는 두 cadence로 나뉜다.

- fast path: `.github/workflows/weekly-kpop-scan.yml`
  - daily upcoming/news freshness, DB sync, projection refresh, parity/shadow/runtime/freshness artifact
- slow path: `.github/workflows/catalog-enrichment-refresh.yml`
  - weekly release history/detail/title/MV enrichment, historical coverage, readiness artifact

두 workflow 모두 `DATABASE_URL`이 설정돼 있으면 dual-write 뒤에 아래 verification chain을 같은 run 안에서 이어서 실행한다.

- `npm run projection:refresh`
- `npm run worker:cadence`
- `npm run report:bundle`
- `python build_backend_json_parity_report.py`
- `npm run shadow:verify`
- `npm run runtime:gate`
- `npm run migration:scorecard`

그래서 canonical write가 끝난 뒤 projection과 backend-vs-JSON evidence, readiness artifact도 같은 bundle metadata 기준으로 같이 최신화된다.

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
- `backend/reports/report_bundle_metadata.json`을 같이 넘기면 derived bundle id를 stamp 한다.

현재 parity scope:

- alias / search coverage
- official links / YouTube allowlist coverage
- latest verified release selection
- upcoming counts / nearest upcoming / exact vs month-only separation
- title-track / double-title 표현
- YouTube Music / YouTube MV service-link state
- review-required counts

latest verified release selection rule은 source import / tracking-state / projection / read route에서 아래 순서를 공통으로 사용한다.

- exact `release_date` desc
- same date면 `album` stream 우선, 그다음 `song`
- same date + same stream이면 normalized `release_title` asc

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
npm run worker:cadence
```

기본 보고서 출력:

- `backend/reports/worker_cadence_report.json`

이 report는 아래 topology를 함께 기록한다.

- `daily_upcoming`: current freshness primary path
- `catalog_enrichment`: slower historical enrichment path

3. combined runtime gate report

```bash
cd backend
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
```

기본 보고서 출력:

- `backend/reports/report_bundle_metadata.json`
- `backend/reports/runtime_gate_report.json`
- `backend/reports/historical_release_detail_coverage_report.json`
- `backend/reports/historical_release_detail_coverage_summary.md`

4. migration readiness scorecard

```bash
cd backend
npm run migration:scorecard -- --bundle-path ./reports/report_bundle_metadata.json
```

기본 보고서 출력:

- `backend/reports/migration_readiness_scorecard.json`
- `backend/reports/migration_readiness_scorecard.md`

gate 정의와 stage mapping은 아래 문서를 따른다.

- `docs/specs/backend/migration-runtime-gates.md`
- `docs/specs/backend/migration-readiness-scorecard.md`

## Web Cutover Rollback Drill Evidence

surface-local rollback rehearsal과 timing 기록은 아래 문서를 기준으로 본다.

- plan: `docs/specs/backend/web-cutover-rollback-drills.md`
- local evidence: `backend/reports/web_cutover_rollback_drill_2026-03-08.md`
