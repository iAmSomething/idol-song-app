# Preview / Staging Backend Path

## 1. 목적

이 문서는 backend migration 동안 사용할 preview/staging 경로를 고정한다.
목표는 local-only 검증과 production-facing cutover 사이에 하나의 rehearsal 환경을 두는 것이다.

이 경로는 아래 작업을 production에 닿지 않고 연습하기 위한 용도다.

- schema migration apply / rerun
- JSON import / dual-write
- projection refresh
- Fastify read API smoke check
- shadow-read / parity verification
- worker cadence / freshness rehearsal

## 2. Topology

preview/staging backend는 아래 3개 런타임으로 구성한다.

| concern | preview/staging path |
| --- | --- |
| canonical DB | `Neon preview branch` 또는 `preview 전용 database` |
| read API | `preview Fastify service` |
| worker / cron | `preview worker service` |

원칙:

- preview는 production과 같은 payload contract를 유지한다.
- preview는 production과 다른 data volume, cadence, log level을 가질 수 있다.
- preview는 production source-of-truth를 직접 수정하지 않는다.
- production cutover 전 rehearsal은 기본적으로 preview에서 끝낸다.

## 3. Naming Baseline

preview 자원 이름은 운영자가 즉시 구분할 수 있게 아래 형태를 권장한다.

| asset | recommended name |
| --- | --- |
| Neon branch / DB | `idol-song-app-preview` |
| Fastify service | `idol-song-api-preview` |
| worker service | `idol-song-worker-preview` |
| env file | `~/.config/idol-song-app/neon.preview.env` |

별도 vendor naming이 필요하면 바꿀 수 있지만, `preview` 접미사는 유지한다.

## 4. Environment Separation

### 4.1 Local

용도:

- schema 작성
- importer / sync 스크립트 개발
- API contract 구현

특성:

- 개발자 개인 Neon dev branch 또는 isolated dev DB
- 로컬 Fastify
- 로컬 worker script 실행

### 4.2 Preview / Staging

용도:

- migration rehearsal
- projection freshness rehearsal
- shadow-read / parity rehearsal
- pre-production smoke check

특성:

- production과 분리된 preview DB path
- preview API service
- preview worker cadence
- production과 같은 field contract

### 4.3 Production

용도:

- user-facing canonical read path
- scheduled refresh
- rollback-ready operation

특성:

- production DB
- production API service
- production worker cadence

## 5. What May Differ In Preview

preview에서 달라져도 되는 것:

- dataset size
- 실험용 entity / release seed 일부
- worker cadence
- log verbosity
- rate-limit threshold
- alert threshold
- deploy frequency

preview에서 달라지면 안 되는 것:

- endpoint path
- top-level response envelope
- field name
- field type
- enum domain
- date precision semantics
- title-track / MV / service-link meaning
- request-id propagation policy (`X-Request-Id` echo)
- `429 rate_limited` envelope / header contract
- fallback / error contract

즉 preview는 데이터 품질이나 시점은 production보다 느슨할 수 있지만, payload shape와 제품 의미론은 production과 동일해야 한다.

## 6. Config Baseline

preview와 production은 최소 아래 구성을 분리한다.

| key | preview | production |
| --- | --- | --- |
| `APP_ENV` | `preview` | `production` |
| `DATABASE_URL` | preview direct Neon URL | production direct Neon URL |
| `DATABASE_URL_POOLED` | preview pooled URL | production pooled URL |
| `PORT` | preview service port | production service port |
| `APP_TIMEZONE` | `Asia/Seoul` | `Asia/Seoul` |
| `WEB_ALLOWED_ORIGINS` | preview web consumer origin list | production extra web consumer origin list |
| `LOG_LEVEL` | `debug` 또는 `info` | `info` 또는 `warn` |
| `WORKER_CADENCE_LABEL` | preview cadence label | production cadence label |

운영 규칙:

- preview secret은 production secret과 별도로 관리한다.
- preview API는 production DB URL을 읽지 않는다.
- preview worker는 production cron과 다른 cadence를 가져도 된다.
- timezone rule은 preview/production 모두 `Asia/Seoul`로 고정한다.
- production 기본 web origin은 `https://iamsomething.github.io`이고, preview/prod에서 추가 origin이 필요하면 `WEB_ALLOWED_ORIGINS`로만 연다.

## 7. Rehearsal Sequence

preview rehearsal은 아래 순서를 기본 루틴으로 쓴다.

### 7.1 Schema

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

cd backend
npm run migrate:apply
npm run schema:verify
```

### 7.2 Baseline Import

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 import_json_to_neon.py
```

### 7.3 Dual-write Rehearsal

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

python3 sync_release_pipeline_to_neon.py
python3 sync_upcoming_pipeline_to_neon.py
```

### 7.4 Projection Refresh

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

cd backend
npm run projection:refresh
```

### 7.5 API Smoke

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

cd backend
npm run build
PORT=3213 npm run start
```

최소 smoke 대상:

- `/health`
- `/ready`
- `/v1/search`
- `/v1/entities/:slug`
- `/v1/releases/lookup`
- `/v1/releases/:id`
- `/v1/calendar/month`
- `/v1/radar`
- `/v1/review/upcoming`
- `/v1/review/mv`

### 7.6 Shadow / Parity

```bash
set -a
source ~/.config/idol-song-app/neon.preview.env
set +a

python3 build_backend_json_parity_report.py

cd backend
npm run shadow:verify
```

필수 산출물:

- `backend/reports/backend_json_parity_report.json`
- `backend/reports/backend_shadow_read_report.json`

## 8. Worker Cadence Guidance

preview cadence는 production보다 짧거나 수동 위주여도 된다.
다만 rehearsal 단계에서는 아래 3가지를 반드시 확인해야 한다.

- dual-write 후 projection refresh 순서가 안정적인지
- preview API가 stale projection을 읽지 않는지
- shadow/parity 리포트가 preview에서도 재현 가능한지

권장 규칙:

- preview cron은 production보다 보수적으로 적게 돌려도 된다
- cutover rehearsal 직전에는 production cadence와 같은 순서로 한 번 이상 실행한다
- preview worker failure는 production alert와 분리된 채널로 본다

## 9. Exit Criteria For Using Preview Before Cutover

특정 surface를 production-facing cutover 후보로 올리기 전, preview에서 아래가 먼저 만족되어야 한다.

1. schema verify가 clean이다
2. import 또는 dual-write rerun이 idempotent하다
3. projection refresh가 stable하다
4. endpoint smoke check가 clean이다
5. parity report에서 허용되지 않은 drift가 없다
6. shadow-read report에서 해당 surface drift가 허용 범위 안이다
7. rollback path가 문서화되어 있다

## 10. Non-goals

preview deploy automation 자체는 `.github/workflows/backend-deploy.yml`에서 맡고, 이 문서는 rehearsal topology와 운영 규칙만 다룬다.

## 11. Repository Deploy Path

repo-level deploy path는 아래로 고정한다.

- preview backend deploy:
  - trigger: `main`의 backend 관련 변경 push 또는 manual dispatch
  - workflow: `.github/workflows/backend-deploy.yml`
  - GitHub Environment: `preview`
- production backend deploy:
  - trigger: manual dispatch only
  - workflow: `.github/workflows/backend-deploy.yml`
  - GitHub Environment: `production`

GitHub Environment baseline:

- secret: `RAILWAY_TOKEN`
- variable: `RAILWAY_PROJECT_ID`
- variable: `RAILWAY_ENVIRONMENT_ID`
- variable: `RAILWAY_SERVICE_ID`
- variable: `BACKEND_PUBLIC_URL`

배포 helper는 `backend/scripts/deploy-backend.mjs`를 사용한다.

web API origin 연결 규칙:

- preview rehearsal은 preview backend public URL을 web/local `VITE_API_BASE_URL`에 넣는다.
- production Pages는 production backend public URL을 repository variable `VITE_API_BASE_URL`에 넣는다.
- backend browser allowlist는 `WEB_ALLOWED_ORIGINS`에서 별도로 관리한다.

- preview를 production과 완전히 동일한 traffic 복제로 만드는 것
- full infra-as-code hardening
- mobile preview build 구현
- preview를 장기 정본으로 승격하는 것

## 11. Acceptance Checklist

- preview DB / API / worker path가 문서로 정의된다
- preview와 production의 contract invariant가 분리 없이 고정된다
- schema/import/projection/API/shadow rehearsal 경로가 한 문서에서 보인다
- migration 작업이 local + production 두 환경에만 의존하지 않는다
