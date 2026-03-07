# Phased Rollout Plan

## 1. 목적

이 문서는 현재 JSON-first 파이프라인을 backend-backed persistence와 shared read API로
점진적으로 전환하는 rollout plan을 정의한다.

핵심 목표는 두 가지다.

1. 현재 배포 중인 웹 제품을 깨뜨리지 않고 전환한다.
2. static JSON snapshot을 점진적으로 source-of-truth에서 transitional artifact로 강등한다.

## 2. 현재 생산 경로

현재 production-like delivery path는 아래와 같다.

1. Python job이 JSON 산출물을 재생성한다.
2. GitHub Actions가 갱신된 JSON을 `main`에 커밋한다.
3. GitHub Pages가 `web/src/data/*.json`을 읽는 웹 앱을 배포한다.

즉, 지금은 저장소와 committed JSON snapshot이 사실상 production data 역할을 같이 하고 있다.

## 3. 전환 원칙

### 3.1 Big-bang cutover 금지

- backend migration은 한 번에 전체 전환하지 않는다.
- surface 또는 data domain 단위로 나눠서 옮긴다.

### 3.2 Coexistence 허용

- 전환 중에는 같은 정보가 JSON과 backend에 동시에 존재할 수 있다.
- 이 기간에는 parity check가 필수다.

### 3.3 Web 우선 안정성

- 현재 웹은 migration 동안 계속 shipping surface다.
- backend 실패가 즉시 web outage로 이어지면 안 된다.

### 3.4 Canonical semantics 선고정

- entity type, alias, date precision, title-track, official link, MV state 의미론이 먼저 고정돼야 한다.
- 의미론이 흔들리면 import, API, client parity 전부 흔들린다.

### 3.5 Rollback 가능성 유지

- risky stage마다 surface-level 또는 pipeline-level rollback 경로가 있어야 한다.
- emergency 시 JSON source fallback이 가능한 기간을 유지한다.

## 4. Prerequisites

아래 세 문서가 rollout 기준점이다.

1. [canonical-backend-data-model.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/canonical-backend-data-model.md)
2. [runtime-and-service-boundaries.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/runtime-and-service-boundaries.md)
3. [shared-read-api-contracts.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/shared-read-api-contracts.md)

이 중 하나라도 잠겨 있지 않으면 rollout phase는 설계만 가능하고 구현 시작은 보류한다.

## 5. Phase Summary

| phase | name | main purpose | web read source |
| --- | --- | --- | --- |
| 0 | Contract Freeze | semantics 고정 | JSON only |
| 1 | Canonical Database Bootstrap | schema + baseline import | JSON only |
| 2 | Pipeline Dual-Write | pipeline이 DB와 JSON을 함께 갱신 | JSON only |
| 3 | Read API Shadow Mode | API를 shadow로 운영 | JSON only |
| 4 | Surface-by-Surface Web Cutover | surface별 API cutover | mixed |
| 5 | JSON Snapshot Demotion | JSON 정본 역할 제거 | API primary |
| 6 | Mobile Adoption Readiness | cross-platform adoption 준비 | API primary |

## 6. Phase Detail

### 6.1 Phase 0. Contract Freeze

목적:

- data movement 전에 의미론을 고정한다.

필수 입력:

- canonical data model 확정
- runtime / service boundary 확정
- shared read API contract 확정

주요 작업:

- entity type semantics 고정
- alias normalization과 lookup key 고정
- exact vs month-only vs unknown date precision 고정
- title-track / double-title 표현 고정
- official link, channel allowlist, MV state 의미론 고정

종료 게이트:

- 웹과 향후 API가 같은 필드 의미를 쓸 수 있다.
- import와 projection 설계가 더 이상 의미론 추정에 의존하지 않는다.

rollback:

- 설계 단계이므로 별도 rollback 없음

### 6.2 Phase 1. Canonical Database Bootstrap

목적:

- Neon에 canonical schema를 만들고 baseline shadow source를 backfill한다.

주요 작업:

- 첫 schema migration 실행
- 현재 JSON dataset import
- import audit report 생성
  - row count
  - duplicate candidate
  - unresolved mapping
  - missing foreign key candidate

입력 데이터:

- `artistProfiles.json`
- `youtubeChannelAllowlists.json`
- verified release history / latest release outputs
- `upcoming_release_candidates.json`
- review queue outputs
- curated override outputs

종료 게이트:

- core row count가 기존 JSON baseline과 대략 맞는다.
- entity slug / alias / release unique key 충돌 규칙이 안정적이다.
- repeat import를 수행해도 idempotent하게 수렴한다.

rollback:

- web은 계속 JSON만 읽는다.
- DB bootstrap이 깨져도 shipped surface는 영향받지 않는다.

### 6.3 Phase 2. Pipeline Dual-Write

목적:

- 현재 JSON outputs를 유지하면서 pipeline이 canonical DB도 함께 갱신하게 만든다.

주요 작업:

- scan job이 canonical upcoming tables를 쓴다.
- hydration / release detail job이 canonical release tables를 쓴다.
- projection export job이 JSON snapshot도 계속 생성한다.
- DB state와 JSON export 사이 parity check를 추가한다.

필수 parity 대상:

- alias set
- latest verified release
- upcoming count
- exact vs month-only separation
- title-track flag
- official links / channel allowlist
- MV state / override 상태

종료 게이트:

- 반복 실행에서 parity drift가 허용 범위 안에 있다.
- 주 3회 스캔 cadence와 import 성능이 유지된다.
- manual review queue가 DB write 이후에도 의미 손실 없이 유지된다.

rollback:

- DB write path를 끄고 JSON-only pipeline으로 되돌린다.

### 6.4 Phase 3. Read API Shadow Mode

목적:

- Fastify read API를 띄우되 web은 아직 JSON만 읽게 둔다.

주요 작업:

- calendar/search/entity/release/radar shadow endpoint 제공
- 현재 웹 selector 결과와 API payload 비교
- latency, error rate, freshness baseline 수집

운영 규칙:

- API는 internal / shadow consumer만 사용
- product UI는 여전히 JSON source 유지

종료 게이트:

- major surface parity가 허용 범위 안에 있다.
- p95 latency와 error rate가 기본 목표를 충족한다.
- refresh 이후 projection lag가 허용 범위 안에 있다.

rollback:

- web은 이미 JSON only라 user-facing rollback 필요 없음
- shadow API 비활성화만 하면 된다

### 6.5 Phase 4. Surface-by-Surface Web Cutover

목적:

- 웹 앱을 surface별로 backend read로 전환한다.

권장 순서:

1. search
2. entity detail
3. release detail
4. calendar month
5. radar

이 순서를 택하는 이유:

- search / entity / release는 validation value가 크고 blast radius가 상대적으로 작다.
- calendar / radar는 파생 로직과 freshness 요구가 더 무거워 뒤로 보낸다.

필수 요구사항:

- JSON / API source toggle이 가능해야 한다.
- surface 단위 rollback이 가능해야 한다.
- parity issue가 있으면 특정 surface만 JSON으로 되돌릴 수 있어야 한다.

surface별 종료 게이트:

- QA pass
- accepted parity gap 문서화
- latency와 freshness가 허용 범위 안
- error fallback이 실제 동작

rollback:

- 해당 surface만 JSON source로 전환

### 6.6 Phase 5. JSON Snapshot Demotion

목적:

- committed JSON을 더 이상 main source-of-truth로 취급하지 않는다.

주요 작업:

- `web/src/data/*.json` 직접 의존 제거
- JSON을 export / debug / emergency fallback artifact로 축소
- GitHub Actions에서 "production data commit" 책임 축소

종료 게이트:

- web이 안정적으로 API primary read를 사용한다.
- backend refresh pipeline과 projection refresh가 일상 운영 수준으로 안정적이다.
- emergency fallback 외에는 JSON snapshot이 운영에 필요하지 않다.

rollback:

- transitional window 동안만 JSON export fallback 허용

### 6.7 Phase 6. Mobile Adoption Readiness

목적:

- future cross-platform client가 같은 backend contract를 소비할 수 있게 만든다.

주요 작업:

- mobile이 shared read contract만으로 화면 구성이 가능한지 검증
- client별 duplicated domain logic 제거
- review/admin write API 필요 범위 확인

종료 게이트:

- shared API contract가 모바일 구현 시작 가능한 수준으로 안정적이다.

rollback:

- mobile 착수 자체를 보류하고 web 운영만 유지

## 7. Cross-Phase Success Metrics

### 7.1 Data parity

- alias search parity
- entity official link parity
- latest verified release parity
- release detail track / title-track parity
- release detail MV state parity
- exact vs month_only separation parity
- nearest upcoming parity

### 7.2 Freshness / runtime

- scheduled job 종료 후 projection refresh lag
- API read latency
- API error rate
- dual-write drift count

### 7.3 Operational quality

- import idempotency
- unresolved review backlog growth
- rollback execution time

## 8. Recommended Ownership Split

| layer | primary responsibility |
| --- | --- |
| workers / pipeline | canonical write model update, projection refresh, parity report 생성 |
| Fastify API | shared read contract 제공 |
| web app | presentation, local UI state, feature flag switch |
| GitHub Pages | transitional static delivery path |

권장 금지사항:

- alias normalization을 클라이언트마다 각각 재구현
- `releases.json`, `watchlist.json`를 canonical truth처럼 다루기
- DB timezone에 맞춰 제품 날짜 의미를 재정의하기

## 9. Rollout Gates Matrix

| from | to | required evidence |
| --- | --- | --- |
| 0 -> 1 | contract freeze -> bootstrap | canonical model, runtime boundary, read API contract 확정 |
| 1 -> 2 | bootstrap -> dual-write | import audit, repeatable backfill, stable lookup key |
| 2 -> 3 | dual-write -> shadow API | parity reports, stable worker cadence |
| 3 -> 4 | shadow API -> web cutover | endpoint parity, latency baseline, error baseline |
| 4 -> 5 | web cutover -> JSON demotion | surface QA, rollback drill, freshness pass |
| 5 -> 6 | JSON demotion -> mobile readiness | stable shared read contracts, operational confidence |

## 10. Risks To Watch

1. `releases.json` 또는 `watchlist.json`를 계속 canonical truth처럼 취급하는 drift
2. alias normalization을 import/API/client에서 제각각 구현하는 drift
3. API cutover 중 `exact | month_only | unknown` semantics 손실
4. DB timezone 설정이 제품 KST date semantics를 오염시키는 문제
5. dual-write 중 projection refresh 순서가 꼬여 stale read를 내는 문제
6. review / override resolution이 DB만 갱신하고 projection export에 반영되지 않는 문제

## 11. Non-Goals

- immediate mobile app implementation
- full admin panel delivery
- auth/personalization 선행 구축
- migration readiness와 무관한 기능 확장

## 12. Acceptance Checklist

- JSON-first에서 backend-backed read로 가는 단계가 명확하다.
- coexistence 기간과 cutover checkpoint가 명시돼 있다.
- 각 phase에 gate와 rollback이 있다.
- 현재 shipped web experience를 보호하는 경로가 있다.
- 후속 이슈 `#155`, `#156`, `#157`를 바로 시작할 수 있을 정도로 sequencing이 분명하다.

## 13. References

- Parent epic: `#146`
- Canonical model: [canonical-backend-data-model.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/canonical-backend-data-model.md)
- Existing mobile docs umbrella: `#61`
