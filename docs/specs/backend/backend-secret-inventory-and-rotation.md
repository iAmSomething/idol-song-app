# Backend Secret Inventory And Rotation Ownership

## Scope

이 문서는 backend runtime과 deploy chain이 의존하는 secret / variable을
GitHub, Railway, Neon 기준으로 inventory 한다.

- secret 값은 적지 않는다.
- 이름, scope, owner role, 사용 경로, rotation / rollback 기준만 적는다.
- audit 기준일은 `2026-03-08`이다.

## Owner Roles

| Role | Responsibility |
| --- | --- |
| `backend platform owner` | Railway deploy/runtime, GitHub backend workflow wiring, readiness/smoke 운영 |
| `database owner` | Neon direct / pooled credential 발급, revoke, rollback window 관리 |
| `web release owner` | Pages build variable, backend public URL, CORS allowlist 동기화 |
| `github repository admin` | GitHub Environment / secret / variable provisioning, access policy 점검 |

## Audit Snapshot (`2026-03-08`)

GitHub CLI와 repository 파일 기준으로 확인한 현재 상태는 아래와 같다.

- GitHub environment 목록에서 확인된 것은 `github-pages`, `preview` 두 개다.
- `production` GitHub environment는 현재 API에서 보이지 않았다.
- `gh secret list`, `gh variable list`, `gh variable list --env preview` 결과는 모두 비어 있었다.
- 따라서 아래 inventory는
  - repository/workflow/runtime contract에서 필요한 이름
  - 그리고 GitHub API에서 실제 확인된 현재 scope 상태
  를 같이 적는다.

즉, 이 문서는 필요한 name contract와 현재 관측된 provisioning 상태를 동시에 보여주는 audit 문서다.

## Inventory

### 1. GitHub Actions / GitHub Environment

| Name | Kind | Expected Scope | Current Audit Status | Used By | Owner | Rotation / Change Trigger | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | secret | `preview`, `production`, scheduled workflow execution path | workflow reference 있음, visible list에서는 이름 미확인 | `weekly-kpop-scan.yml`, `backend-deploy.yml`, parity / shadow / sync scripts | `backend platform owner` + `database owner` | Neon direct URL 교체, credential exposure, role rotation | 이전 direct URL을 rollback window 동안 유지하고 GitHub secret 원복 후 workflow 재실행 |
| `RAILWAY_TOKEN` | secret | `preview`, `production` | workflow reference 있음, visible list에서는 이름 미확인 | `backend-deploy.yml`, `deploy-backend.mjs` | `backend platform owner` | Railway token exposure, maintainer change, periodic rotation | 이전 token을 짧게 보관하고 preview deploy 성공 전까지 revoke 금지 |
| `RAILWAY_PROJECT_ID` | variable | `preview`, `production` | workflow reference 있음, `preview` env variable list는 현재 empty | `backend-deploy.yml` | `backend platform owner` | Railway project 이동 또는 재구성 | 이전 project target으로 즉시 되돌릴 수 있어야 함 |
| `RAILWAY_ENVIRONMENT_ID` | variable | `preview`, `production` | workflow reference 있음, `preview` env variable list는 현재 empty | `backend-deploy.yml` | `backend platform owner` | Railway environment 재생성, target 변경 | 이전 environment id를 유지해 즉시 원복 |
| `RAILWAY_SERVICE_ID` | variable | `preview`, `production` | workflow reference 있음, `preview` env variable list는 현재 empty | `backend-deploy.yml` | `backend platform owner` | service 재생성, split/merge | 이전 service id로 deploy target 원복 |
| `BACKEND_PUBLIC_URL` | variable | `preview`, `production` | workflow reference 있음, `preview` env variable list는 현재 empty | backend live smoke, environment URL, web API target docs | `web release owner` + `backend platform owner` | backend public host 변경 | 이전 URL과 CORS allowlist를 같이 되돌린다 |
| `VITE_API_BASE_URL` | variable | repository variable 또는 `github-pages` environment variable | workflow reference 있음, current visible lists는 empty | `deploy-pages.yml` | `web release owner` | backend public URL 변경, cutover path 변경 | 이전 backend base URL로 Pages rebuild |
| `VITE_PRIMARY_SURFACE_SOURCE` | variable | repository variable 또는 `github-pages` environment variable | workflow reference 있음, current visible lists는 empty | `deploy-pages.yml` | `web release owner` | backend cutover / rollback | 이전 source mode로 Pages rebuild |

### 2. Railway Runtime Configuration

| Name | Kind | Scope | Used By | Owner | Rotation / Change Trigger | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_ENV` | variable | Railway preview / production service env | backend config loader | `backend platform owner` | preview/prod role 변경 | 기존 env mode로 즉시 원복 |
| `DATABASE_URL` | secret | Railway preview / production service env | direct DB read / migrate / refresh path | `database owner` + `backend platform owner` | Neon direct credential rotation | 이전 direct URL을 rollback window 동안 유지 |
| `DATABASE_URL_POOLED` | secret | Railway preview / production service env | pooled runtime read path | `database owner` + `backend platform owner` | Neon pooled credential rotation | 이전 pooled URL을 rollback window 동안 유지 |
| `PORT` | variable | Railway preview / production service env | Fastify bind | `backend platform owner` | platform routing change | 이전 port로 원복 |
| `APP_TIMEZONE` | variable | Railway preview / production service env | runtime date semantics | `backend platform owner` | policy change only | `Asia/Seoul` 이외 변경은 rollback 대상 |
| `WEB_ALLOWED_ORIGINS` | variable | Railway preview / production service env | CORS allowlist | `web release owner` + `backend platform owner` | new web consumer origin, backend host change | 이전 origin list로 원복하고 web build와 같이 맞춤 |

### 3. Neon Source Of Truth

| Name | Kind | Scope | Consumed By | Owner | Rotation / Change Trigger | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- |
| preview direct connection string | secret | Neon preview branch / project | GitHub `DATABASE_URL`, Railway `DATABASE_URL` | `database owner` | credential rotation, branch recreation | 이전 direct credential 유지 후 GitHub/Railway 순차 원복 |
| preview pooled connection string | secret | Neon preview branch / project | Railway `DATABASE_URL_POOLED` | `database owner` | credential rotation, pooler host change | 이전 pooled credential 유지 |
| production direct connection string | secret | Neon production branch / project | GitHub `DATABASE_URL`, Railway `DATABASE_URL` | `database owner` | credential rotation, branch recreation | revoke 전 production smoke와 rollback window 필수 |
| production pooled connection string | secret | Neon production branch / project | Railway `DATABASE_URL_POOLED` | `database owner` | credential rotation, pooler host change | 이전 pooled credential 유지 |

## Rotation Baselines

### A. `DATABASE_URL` / `DATABASE_URL_POOLED`

1. Neon에서 replacement direct / pooled credential을 발급한다.
2. preview Railway env의 `DATABASE_URL`, `DATABASE_URL_POOLED`를 먼저 교체한다.
3. preview GitHub secret `DATABASE_URL`도 같은 replacement direct URL로 맞춘다.
4. preview backend deploy + live smoke + `/ready` + representative read를 통과시킨다.
5. production도 같은 순서로 교체한다.
6. rollback window 동안 이전 credential은 유지한다.
7. preview / production 검증이 끝난 뒤 이전 credential을 revoke 한다.

Rollback:

1. GitHub `DATABASE_URL`을 이전 값으로 되돌린다.
2. Railway `DATABASE_URL`, `DATABASE_URL_POOLED`도 이전 값으로 되돌린다.
3. backend deploy를 다시 실행한다.
4. `/ready`, representative read smoke, Pages API access를 다시 확인한다.

### B. `RAILWAY_TOKEN`

1. Railway에서 replacement project token을 발급한다.
2. GitHub backend deploy environment에 새 token을 넣는다.
3. preview deploy를 한 번 성공시켜 deploy path가 끊기지 않는지 확인한다.
4. success 확인 후 이전 token revoke 일정을 잡는다.

Rollback:

1. GitHub environment secret를 이전 token으로 원복한다.
2. preview deploy를 재실행한다.
3. 새 token은 원인 파악 전 revoke 하지 않는다.

### C. `BACKEND_PUBLIC_URL` / `WEB_ALLOWED_ORIGINS` / `VITE_API_BASE_URL`

1. backend public host 변경 시 `BACKEND_PUBLIC_URL`을 먼저 바꾼다.
2. backend 쪽 `WEB_ALLOWED_ORIGINS`에 실제 consumer origin만 추가한다.
3. web Pages build의 `VITE_API_BASE_URL`도 같은 host로 맞춘다.
4. preflight, live smoke, browser read를 같이 확인한다.

Rollback:

1. `BACKEND_PUBLIC_URL`과 `VITE_API_BASE_URL`을 이전 값으로 원복한다.
2. `WEB_ALLOWED_ORIGINS`도 이전 목록으로 되돌린다.
3. backend와 web을 각각 다시 배포한다.

## Audit Expectations

이 문서는 rotation-ready baseline이지만, 아래 두 가지는 실제 platform audit에서 계속 확인해야 한다.

1. GitHub `preview`, `production`, `github-pages` scope에 필요한 secret / variable 이름이 실제로 존재하는가
2. Railway preview / production service env가 `.env.preview.example`, `.env.production.example`과 동일한 이름 계약을 유지하는가

즉, repo 문서만 맞다고 끝나는 것이 아니라 platform provisioning drift를 계속 확인해야 한다.
