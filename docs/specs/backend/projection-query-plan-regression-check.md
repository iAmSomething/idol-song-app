# Projection Query-Plan Regression Check

## 목적

projection-backed read endpoint가 schema 변경이나 projection 재정의 이후에도
"필수 인덱스가 살아 있고, index-backed lookup path가 아직 가능한가"를 반복 가능하게 검증한다.

이 check는 latency benchmark를 대체하지 않는다.
대신 release 직전이나 schema 변경 직후에
"핵심 lookup query가 index path를 잃지 않았는가"를 빠르게 gate하는 용도다.

## 보호 대상 Query

현재 baseline은 아래 6개 query를 critical query로 본다.

1. `search_context_entity_by_slug`
   - `entity_search_documents where entity_slug = any($1::text[])`
   - search exact-match 결과에 owner entity row를 다시 hydrate할 때 사용
2. `entity_detail_by_slug`
   - `entity_detail_projection where entity_slug = $1`
3. `release_detail_by_id`
   - `release_detail_projection where release_id = $1::uuid`
4. `release_lookup_by_legacy_key`
   - `release_detail_projection where entity_slug + normalized_release_title + release_date + stream`
5. `calendar_month_by_key`
   - `calendar_month_projection where month_key = $1`
6. `radar_default_projection`
   - `radar_projection where projection_key = 'default'`

## Regression Signal

이 check는 두 층으로 regression을 본다.

1. projection index inventory
   - required index가 catalog에서 사라졌는지
2. EXPLAIN JSON probe
   - `enable_seqscan=off` 상태에서도 expected index path를 찾을 수 있는지

아래는 failure signal로 본다.

- required projection index missing
- baseline probe에서 expected index name이 plan에 없음
- baseline probe에서 target relation에 `Seq Scan`이 남음
- controlled degraded scenario에서도 checker가 degraded를 감지하지 못함

## Controlled Degraded Scenario

failure detection 증명은 실제 schema를 망가뜨리지 않고,
"같은 relation을 읽지만 supporting index를 타지 못하게 만드는 degraded predicate"로 만든다.

- baseline probe:
  - 원래 route query
  - `enable_seqscan=off`
- degraded scenario:
  - indexed column에 함수/캐스트를 걸어 supporting index를 못 타게 만든 variant query
  - `enable_seqscan=off`

예:

- `release_id = $1::uuid` -> `release_id::text = $1::text`
- `entity_slug = $1` -> `projection_normalize_text(entity_slug) = projection_normalize_text($1)`

degraded scenario에서는 protected query가 expected index path를 잃는 것이 정상이다.
이게 감지되지 않으면 checker 자체가 믿을 수 없다고 본다.

## 실행

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm run plan:verify
```

artifact 기본 경로:

- `backend/reports/query_plan_regression_report.json`

## 통과 기준

- required projection index missing count = `0`
- protected query baseline pass count = total query count
- controlled degraded scenario detected count >= `1`

## Artifact 최소 포함 항목

- generated timestamp
- representative sample inputs
- required projection index inventory
- query별
  - expected index name
  - default plan node summary
  - baseline probe result
  - degraded scenario result
- overall summary lines

## 운영 메모

- 이 check는 projection row count가 작아도 동작하도록 baseline 판정을 `actual default plan`이 아니라
  `enable_seqscan=off` probe 기준으로 둔다.
- planner cost나 row estimate 숫자보다 "expected index path exists / does not exist"를 더 강한 gate로 본다.
- full release gate에서는 이 report를 runtime latency, parity, shadow report와 같이 읽는다.
