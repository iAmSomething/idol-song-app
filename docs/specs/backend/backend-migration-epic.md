# Backend Migration Epic

## 1. 목적

이 문서는 현재 JSON-first 제품을 backend-backed source-of-truth로 옮기기 위한 상위 migration epic을 정의한다.
핵심 목적은 web을 깨뜨리지 않으면서 향후 cross-platform client가 함께 사용할 수 있는
shared backend platform 방향을 고정하는 것이다.

이 문서는 세부 설계 문서를 대체하지 않는다.
대신 아래를 묶는 parent plan 역할을 한다.

1. 왜 backend migration이 필요한지
2. 어떤 시스템 경계로 옮길지
3. 어떤 child issue가 어떤 역할을 맡는지
4. 어떤 순서로 구현을 시작해야 하는지

## 2. Problem Statement

현재 제품은 아래 특성을 가진다.

- Python batch job이 JSON snapshot을 생성한다.
- GitHub Actions가 refreshed JSON을 `main`에 커밋한다.
- GitHub Pages가 `web/src/data/*.json`을 직접 읽는 웹 앱을 배포한다.
- 일부 도메인 의미론은 JSON shape와 web selector 안에 암묵적으로 들어 있다.

이 방식은 초기 shipping에는 유리했지만, 아래 단계부터는 한계가 뚜렷하다.

- tracked entity 범위를 `group` 밖으로 확장
- alias / Korean-searchable mapping 일관화
- exact vs month-only scheduling을 durable하게 유지
- official links, YouTube allowlists, MV overrides, review queue를 장기 보관
- web과 future mobile이 같은 source-of-truth를 공유

## 3. Product Decision Summary

- 이것은 big-bang backend rewrite가 아니다.
- web은 migration 동안 계속 shipping surface다.
- backend는 data integrity, scheduled enrichment, shared read API를 우선 최적화한다.
- auth / personalization / admin panel은 지금 우선순위가 아니다.
- JSON snapshot은 점진적으로 source-of-truth에서 transitional artifact로 강등한다.

## 4. Target Outcome

최종적으로는 아래 상태를 목표로 한다.

### 4.1 Canonical write model

- entity, alias, official links, YouTube channels
- verified releases, tracks, artwork, service links
- upcoming signals and source evidence
- tracking state, review tasks, curated overrides

### 4.2 Shared read model

- calendar
- search
- entity detail
- release detail
- radar / tracking rollups

### 4.3 Shared platform consumption

- current web
- future mobile
- internal review / operator workflow

## 5. Target Architecture At A High Level

### 5.1 Write side

- batch workers가 canonical tables를 갱신한다
- import / scan / hydration / override resolution이 모두 canonical model을 기준으로 기록된다
- projection refresh는 worker responsibility다

### 5.2 Read side

- Fastify read API가 shared read contract를 제공한다
- web / future mobile은 같은 read semantics를 소비한다
- projection table 또는 materialized view는 consumer-facing query cost를 낮춘다

### 5.3 Transitional delivery

- GitHub Pages + committed JSON은 migration 동안 fallback / transitional delivery path 역할을 유지한다
- API cutover는 surface별로 분리한다

## 6. What Gets Locked In This Epic

이 epic에서 잠그는 것은 세부 구현이 아니라 migration fundamentals다.

잠금 대상:

- backend adoption은 incremental이어야 한다
- canonical write model과 read projection은 분리한다
- exact / month_only / unknown date precision을 first-class field로 유지한다
- alias, official links, channel allowlists, MV overrides는 durable storage를 가진다
- `releases.json`, `watchlist.json`, `releaseDetails.json`는 projection으로 취급한다
- web cutover는 surface별로 하며 rollback 가능해야 한다

세부 설계 delegated item:

- runtime / service boundary detail
- read API contract detail
- actual schema migration DDL
- actual import worker / API code

## 7. Child Issue Map

| issue | role | deliverable |
| --- | --- | --- |
| `#144` | canonical model | canonical write model / projection read model / JSON mapping |
| `#147` | architecture | runtime, service boundary, deployment shape |
| `#148` | API contract | calendar/search/entity/release shared read contract |
| `#145` | rollout | phased cutover, rollback, parity gate |
| `#155` | schema impl | first Neon schema migration skeleton |
| `#157` | import impl | first JSON-to-Neon backfill |
| `#156` | read impl | first Fastify read API skeleton |

현재 상태:

- `#144` 완료
- `#145` 완료
- `#147` 완료
- `#148` 완료
- `#155`, `#156`, `#157` 진행 전

## 8. Dependency Order

권장 dependency는 아래와 같다.

1. parent epic direction 확정
2. canonical model 확정
3. runtime / service boundary 확정
4. shared read API contract 확정
5. schema migration skeleton
6. JSON-to-Neon baseline import
7. Fastify read API skeleton
8. dual-write / shadow-read / surface cutover

### 8.1 Why this order

- schema는 canonical model 없이는 고정할 수 없다
- API는 runtime boundary와 read contract 없이는 흔들린다
- import는 schema와 lookup key 없이는 repeatable하지 않다
- web cutover는 import, projection, API가 안정화되기 전에는 위험하다

## 9. Implementation Starting Point

실구현 시작 순서는 아래로 고정한다.

### Step 1. `#148`

- shared read contract
- surface별 payload와 parity target 확정

### Step 2. `#155`

- first schema migration skeleton
- canonical table creation baseline

### Step 3. `#157`

- baseline import/backfill
- import audit report

### Step 4. `#156`

- Fastify read API skeleton
- shadow endpoint base

## 10. Non-Goals

- immediate mobile app implementation
- admin panel full delivery
- auth / personalization 선행 구축
- unrelated feature expansion

## 11. Success Criteria

- backend migration에 대한 parent epic과 child responsibilities가 명확하다
- data model / runtime / API / rollout / implementation issue가 구분된다
- 현재 web shipping path를 보존하면서 backend migration을 시작할 수 있다
- 후속 구현 이슈가 re-debate 없이 바로 착수 가능하다

## 12. Verification Guide

parent epic 검증은 아래 기준으로 본다.

- child issue breakdown이 implementation-ready인가
- architecture, schema, API, pipeline, rollout concern이 섞이지 않았는가
- current web path를 보호하는 incremental migration path가 있는가
- cross-platform adoption readiness까지 이어지는가

## 13. References

- Canonical model: [canonical-backend-data-model.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/canonical-backend-data-model.md)
- Runtime baseline: [runtime-and-service-boundaries.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/runtime-and-service-boundaries.md)
- Shared read contract: [shared-read-api-contracts.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/shared-read-api-contracts.md)
- Rollout plan: [phased-rollout-plan.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/phased-rollout-plan.md)
- Readiness rubric: [migration-readiness-scorecard.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/migration-readiness-scorecard.md)
- Existing mobile docs umbrella: `#61`
