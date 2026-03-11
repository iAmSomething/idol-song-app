# Migration Runtime Gates

## 1. 목적

이 문서는 staged cutover에서 runtime evidence를 어떻게 해석할지 고정한다.
parity와 shadow verification만으로는 충분하지 않고, 실제 운영에 가까운 runtime 상태가 같이 기준이 되어야 한다.

이 문서가 다루는 gate는 아래 네 가지다.

- API latency
- API error rate
- projection freshness
- worker cadence
- historical catalog completeness

## 2. Runtime Gate Principles

- runtime gate는 parity / shadow verification을 대체하지 않는다.
- runtime gate는 cutover go/no-go를 위한 운영 증거다.
- preview나 local rehearsal에서도 같은 판정 규칙을 쓴다.
- 환경별로 데이터 양이나 cadence는 달라도 payload contract는 달라지지 않는다.

## 3. Evidence Sources

runtime gate는 아래 산출물을 기본 입력으로 사용한다.

| evidence | source |
| --- | --- |
| API latency / error sample | `backend/reports/read_api_runtime_measurements.json` |
| worker cadence sample | `backend/reports/worker_cadence_report.json` |
| projection freshness sample | `backend/reports/projection_refresh_summary.json` |
| report bundle metadata | `backend/reports/report_bundle_metadata.json` |
| parity dependency | `backend/reports/backend_json_parity_report.json` |
| shadow dependency | `backend/reports/backend_shadow_read_report.json` |
| historical catalog completeness | `backend/reports/historical_release_detail_coverage_report.json` |
| critical null coverage | `backend/reports/canonical_null_coverage_report.json`, `backend/reports/null_coverage_trend_report.json` |
| combined decision | `backend/reports/runtime_gate_report.json` |

## 4. Gate Status Semantics

모든 gate는 아래 셋 중 하나로 판정한다.

- `pass`
  - 다음 phase 논의로 올려도 되는 상태
- `needs_review`
  - 즉시 rollback 수준은 아니지만, 증거가 더 필요하거나 표본이 약한 상태
- `fail`
  - 해당 phase advance를 막는 상태

## 5. Gate Definitions

### 5.1 API Latency

기준:

- 대표 endpoint 케이스별 `p95 latency`
- 최소 표본 수

초기 기준:

- `pass`: worst-case `p95 <= 750ms` 그리고 케이스별 sample count `>= 5`
- `needs_review`: worst-case `p95 <= 1200ms`
- `fail`: 그 외

해석:

- `pass`여도 parity / shadow가 깨져 있으면 cutover는 막힌다
- `needs_review`는 표본 수 부족이나 경계치 근처 latency를 뜻한다

### 5.2 API Error Rate

기준:

- 전체 요청 기준 error rate
- 최소 총 요청 수

초기 기준:

- `pass`: overall error rate `<= 1%` 그리고 total request count `>= 40`
- `needs_review`: overall error rate `<= 3%`
- `fail`: 그 외

해석:

- `needs_review`는 표본이 부족하거나 간헐적 실패가 있는 상태다
- transport error와 unexpected status를 같이 본다

### 5.3 Projection Freshness

기준:

- latest projection refresh summary의 `generated_at`
- 현재 시점과의 lag

초기 기준:

- `pass`: lag `<= 20분`
- `needs_review`: lag `<= 60분`
- `fail`: 그 외

해석:

- freshness는 특히 `calendar`와 `radar` 같은 파생 surface에서 중요하다
- stale projection이면 endpoint 자체가 살아 있어도 cutover 근거로는 약하다

### 5.4 Worker Cadence

기준:

- `daily_upcoming` fast path와 `catalog_enrichment` slow path가 같이 기록된 `worker_cadence_report.json`
- runtime gate는 `daily_upcoming` path를 freshness primary evidence로 사용
- scheduled run failure rate
- last successful scheduled run age

초기 기준:

- `pass`: daily fast path scheduled failure rate `<= 10%` 그리고 last success age `<= 30시간`
- `needs_review`: daily fast path scheduled failure rate `<= 25%` 그리고 last success age `<= 48시간`
- `fail`: 그 외

해석:

- fast path는 daily cadence를 전제로 하므로, 마지막 성공 run이 하루를 크게 넘기면 freshness trust가 떨어진다
- slow path는 historical enrichment / readiness evidence용으로 separate cadence를 가진다
- preview에서는 cadence가 production보다 낮아도 되지만, rehearsal 직전에는 같은 순서로 한 번 이상 검증한다

### 5.5 Report Bundle Consistency

기준:

- `report_bundle_metadata.json`
- parity / shadow / runtime / readiness artifact에 stamp된 `report_bundle.bundle_id`
- historical coverage report의 `generated_at`

초기 기준:

- `pass`: derived artifact가 같은 `bundle_id`를 공유하고, historical coverage timestamp도 bundle reference와 일치
- `fail`: stale artifact 조합, bundle drift, missing bundle metadata

해석:

- runtime/parity/shadow/readiness는 latest file wins가 아니라 같은 bundle metadata를 기준으로 읽는다
- daily fast path와 slow enrichment path는 각각 자기 cadence에서 새 bundle을 만든다

### 5.6 Historical Catalog Completeness

기준:

- `historical_release_detail_coverage_report.json`의 `cutover_gates`
- 전체 카탈로그와 `pre-2024` slice 각각의 coverage

초기 기준:

- detail payload `100% / 100%`
- detail trusted `85% / 50%`
- title-track resolved `80% / 60%`
- canonical MV `65% / 35%`

해석:

- historical catalog completeness는 read API가 technically 살아 있어도 release-detail cutover를 막을 수 있는 데이터 품질 gate다
- 특히 `pre-2024` coverage가 크게 비어 있으면 migration / web / mobile readiness를 `pass`로 보지 않는다

### 5.7 Critical Null Coverage

기준:

- `canonical_null_coverage_report.json`
- `null_coverage_trend_report.json`
- policy baseline: `docs/specs/backend/canonical-null-hygiene-operating-model.md`

초기 기준:

- `latest` cohort Wave 1 floor
  - title-track `95%`
  - canonical MV `80%`
  - YouTube Music / Spotify `85%`
  - official links `100%`
- `recent` cohort Wave 1 floor
  - title-track `85%`
  - canonical MV `55%`
  - YouTube Music / Spotify `70%`
  - official links `95%`
- regression budget
  - latest week-over-week `-2pp`
  - recent week-over-week `-5pp`
  - historical quarter-over-quarter `-3pp`

해석:

- `conditional_null`과 `true_optional`은 denominator에서 제외한다
- trend artifact가 없거나 stale이면 `needs_review`를 넘기지 못한다
- latest cohort에서 하나라도 floor 미달이면 cutover 근거로는 `fail`이다

## 6. Stage Gate Mapping

### 6.1 Shadow API -> Web Cutover

필수:

- parity dependency `pass`
- shadow dependency `pass`
- historical catalog completeness dependency `pass`
- critical null coverage dependency `pass`
- report bundle consistency dependency `pass`
- runtime gates가 모두 `pass` 또는 일부 `needs_review`

판정:

- 하나라도 `fail`이면 전체 gate는 `fail`
- `fail`은 없지만 `needs_review`가 있으면 전체 gate는 `needs_review`
- 전부 `pass`면 전체 gate는 `pass`

### 6.2 Web Cutover -> JSON Demotion

필수:

- parity dependency `pass`
- shadow dependency `pass`
- historical catalog completeness dependency `pass`
- critical null coverage dependency `pass`
- report bundle consistency dependency `pass`
- freshness `pass`
- worker cadence `pass`
- latency / error rate가 최소 `needs_review` 이상

판정 규칙은 동일하다.

즉 JSON demotion은 shadow -> cutover보다 freshness와 cadence를 더 엄격하게 본다.

## 7. Repeatable Commands

### 7.1 Read API latency / error sample

```bash
cd backend
npm run runtime:measure -- --base-url http://127.0.0.1:3213 --iterations 5
```

### 7.2 Worker cadence sample

```bash
cd backend
npm run worker:cadence
npm run null:coverage
npm run null:recheck
npm run null:trend
```

### 7.3 Combined gate report

```bash
cd backend
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
```

## 8. Review Rules

- `pass`
  - 해당 phase를 advance 후보로 올릴 수 있다
- `needs_review`
  - sample size, latency headroom, cadence evidence를 보강한 뒤 다시 실행한다
- `fail`
  - cutover advance를 멈추고 rollback / repair를 우선한다

## 9. Non-goals

- enterprise observability stack 선도입
- distributed tracing 의무화
- end-user analytics 결합
- mobile 전용 runtime gate 별도 정의
