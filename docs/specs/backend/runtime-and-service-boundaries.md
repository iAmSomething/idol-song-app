# Runtime And Service Boundaries

## 1. 목적

이 문서는 backend migration의 target runtime과 service boundary를 고정한다.
목표는 schema, import, read API 구현이 같은 운영 가정을 공유하도록 만드는 것이다.

이 문서가 답해야 하는 질문은 아래다.

1. 데이터 정본은 어디에 저장되는가
2. 읽기 API는 어떤 런타임이 담당하는가
3. scan / hydration / import 같은 batch work는 어디서 도는가
4. migration 동안 무엇이 GitHub 기반으로 남는가

## 2. Runtime Decision

초기 target stack은 아래로 고정한다.

| concern | chosen runtime |
| --- | --- |
| database | `Neon Postgres` |
| read API | `TypeScript + Fastify` |
| scheduled jobs / workers | `Railway Cron + worker service` |
| transitional web delivery | `GitHub Pages` |

이 조합을 택한 이유:

- relational source-of-truth가 먼저 필요하다
- scheduled scan / hydration / enrichment work가 핵심이다
- web과 future mobile이 함께 읽을 단순한 shared read API가 필요하다
- 초기 운영 복잡도는 낮게 유지해야 한다

## 3. Architecture Baseline

### 3.1 Neon Postgres

역할:

- canonical source-of-truth storage
- relational schema
- projection / read table 또는 view storage
- import / worker / API가 함께 의존하는 single data plane

가이드:

- product semantics는 app/domain layer에서 유지한다
- DB timezone default로 제품 날짜 의미를 정의하지 않는다

### 3.2 Fastify API Service

역할:

- shared read endpoints 제공
- health / readiness endpoint 제공
- web과 future mobile이 같은 read contract를 소비하도록 고정

v1 비목표:

- heavy write API
- admin workflow 전반
- auth-heavy personalization

### 3.3 Railway Worker / Cron Service

역할:

- upcoming scan
- release hydration
- MV resolution
- projection refresh
- baseline import / backfill
- review queue refresh

원칙:

- worker는 canonical write model과 projection refresh를 담당한다
- API service는 product read concern만 담당한다
- 두 서비스가 같은 코드 저장소를 쓸 수는 있지만 runtime responsibility는 분리한다

### 3.4 GitHub Actions / Pages During Transition

역할:

- 현재 shipping path 유지
- JSON snapshot export와 Pages deploy 유지
- backend-backed read가 안정화될 때까지 fallback 역할 유지

원칙:

- JSON snapshot은 transitional artifact다
- long-term source-of-truth는 아니다

## 4. Service Boundary Split

### 4.1 Database Boundary

DB에 두는 것:

- canonical entity / alias / official link / channel data
- verified release / track / service link / artwork data
- upcoming signal / evidence source data
- tracking state / review task / override data
- projection / read model

DB에 두지 않는 것:

- UI-local state
- browser persistence
- purely ephemeral selector state

### 4.2 API Boundary

API가 책임지는 것:

- calendar, search, entity detail, release detail, radar read contract
- health / readiness / version info
- consumer-safe read payload shaping

API가 책임지지 않는 것:

- scan job orchestration
- enrichment scheduling
- ad hoc admin write flow
- JSON export generation

### 4.3 Worker Boundary

worker가 책임지는 것:

- external source ingest
- canonical write
- projection refresh
- import audit
- parity report 생성

worker가 책임지지 않는 것:

- end-user read traffic
- browser-specific shaping
- client-side fallback state

### 4.4 GitHub Boundary During Migration

GitHub가 계속 맡는 것:

- repository-hosted source code
- current Pages delivery
- transitional JSON artifact shipping

GitHub가 점진적으로 내려놓는 것:

- production truth 역할
- product read source 역할

## 5. File / Blob Storage Decision

v1에서는 dedicated blob storage를 도입하지 않는다.

현재 기준:

- cover / badge / representative asset은 외부 canonical URL 또는 기존 curated URL을 계속 사용한다
- JSON export는 repo artifact 또는 debug artifact로 유지할 수 있다
- DB는 metadata와 canonical link를 저장하고 binary asset hosting은 맡지 않는다

향후 승격 조건:

- 이미지 hotlink 안정성이 심각하게 떨어질 때
- API가 signed asset delivery를 직접 관리해야 할 때
- moderation / asset rewrite flow가 필요해질 때

## 6. Environment Boundaries

### 6.1 Local

- isolated dev DB path on Neon
- local Fastify runtime
- local worker / import script execution

용도:

- schema iteration
- import dry-run
- API contract validation

### 6.2 Preview / Staging

- preview branch 또는 separate preview DB path
- preview API service
- preview worker execution path

용도:

- schema / import / API integration validation
- shadow endpoint check
- parity / freshness rehearsal

운영 baseline:

- preview env template는 `backend/.env.preview.example`
- production env template는 `backend/.env.production.example`
- rehearsal runbook은 `preview-staging-backend-path.md`

### 6.3 Production

- production Neon branch or database
- production API service
- production cron worker
- transitional Pages delivery until cutover complete

용도:

- user-facing read path
- scheduled canonical refresh
- projection refresh and rollback-ready operation

## 7. Timezone Rule

### 7.1 Storage

- DB timestamp는 UTC 저장을 기본으로 한다

### 7.2 Product semantics

- release date와 upcoming semantics는 `Asia/Seoul` 기준으로 해석한다
- DB default timezone에 제품 의미를 맡기지 않는다

### 7.3 Implementation rule

- worker import / scan / hydration에서 KST semantic date를 명시적으로 계산한다
- API는 already-resolved product date semantics를 노출한다
- client는 storage timezone을 재해석하지 않는다

## 8. Operational Guidance

### 8.1 Keep the initial architecture small

- API와 worker는 논리적으로 분리하되, 초기에는 같은 repo / 같은 vendor stack을 써도 된다
- service boundary를 문서와 deploy shape로 분리하고, 코드 분리는 나중에 해도 된다

### 8.2 Optimize for scheduled work first

- 이 제품은 high-write user transaction보다 scheduled ingest / enrichment 정확도가 더 중요하다
- 따라서 queue-heavy microservice 분해보다 predictable cron + worker가 우선이다

### 8.3 Read API before write/admin API

- current product need는 shared read contract다
- operator tooling은 later phase로 미룬다

## 9. Why This Fits The Current Product

이 조합이 현재 제품에 맞는 이유는 아래와 같다.

1. source-of-truth가 relational이어야 alias, upcoming precision, override, review state를 durable하게 관리할 수 있다
2. worker-heavy 제품이라 scheduled runtime이 핵심이고, Railway cron + worker가 이 요구에 맞다
3. client surface는 복잡한 write보다 read contract 공유가 더 시급하므로 Fastify read API가 적합하다
4. Pages를 당장 제거하지 않아도 되므로 migration risk를 낮출 수 있다

## 10. Non-Goals

- immediate admin panel
- auth / personalization stack 선도입
- event-driven microservice decomposition
- dedicated blob infra 선도입

## 11. Acceptance Checklist

- database / API / worker / GitHub boundary가 명확하다
- local / preview / production 환경 경계가 명확하다
- file/blob storage 결정을 포함해 초기 infra 범위가 고정된다
- timezone responsibility가 명시된다
- follow-on schema / API / import issue가 이 문서를 baseline으로 참조할 수 있다

## 12. References

- Parent epic: [backend-migration-epic.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/backend-migration-epic.md)
- Canonical model: [canonical-backend-data-model.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/canonical-backend-data-model.md)
- Rollout plan: [phased-rollout-plan.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/phased-rollout-plan.md)
