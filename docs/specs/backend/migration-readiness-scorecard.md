# Migration Readiness Scorecard

이 문서는 backend migration readiness를 판단할 때 쓰는 공통 rubric을 고정한다.
목표는 "구현이 어느 정도 됐다"가 아니라 "cutover를 안전하게 진행해도 되는가"를
같은 기준으로 판단하게 만드는 것이다.

이 scorecard는 아래 원칙을 따른다.

- merged PR 개수로 readiness를 추정하지 않는다.
- blocker-grade category 하나라도 `fail`이면 overall은 자동으로 `fail`이다.
- payload coverage만 높고 runtime / parity / shadow / MV completeness가 낮으면 ready로 보지 않는다.
- PM / dev / operator가 같은 artifact를 보고 같은 blocker를 읽을 수 있어야 한다.

## 1. Overall Rule

- overall score는 `0.0 ~ 1.0` ratio로 계산하고, 화면/문서에는 `0 ~ 100`으로 표시한다.
- category status 점수는 아래 mapping을 쓴다.
  - `pass = 1.0`
  - `needs_review = 0.6`
  - `fail = 0.0`
- overall threshold
  - `pass`: weighted ratio `>= 0.85`
  - `needs_review`: weighted ratio `>= 0.60`
  - `fail`: weighted ratio `< 0.60`
- 단, blocker-grade category 중 하나라도 `fail`이면 weighted ratio와 관계없이 overall은 `fail`이다.

## 2. Category Weights

| category | weight | blocker | primary evidence |
| --- | ---: | --- | --- |
| backend runtime health | 25 | yes | `backend/reports/runtime_gate_report.json` |
| backend deploy parity | 20 | yes | `backend/reports/backend_json_parity_report.json`, canonical smoke registry, backend deploy workflow |
| web backend-only stability | 20 | yes | `backend/reports/backend_shadow_read_report.json` |
| mobile runtime mode | 15 | yes | `mobile/src/config/runtime.ts`, `mobile/src/services/datasetSource.ts`, `mobile/src/config/debugMetadata.ts` |
| catalog completeness | 20 | yes | `backend/reports/historical_release_detail_coverage_report.json`, `backend/reports/canonical_null_coverage_report.json`, `backend/reports/null_coverage_trend_report.json` |

## 3. Category Semantics

### 3.1 Backend Runtime Health

이 category는 backend service가 cutover candidate로서 기본 운영 조건을 충족하는지 본다.

입력:

- `api_latency`
- `api_error_rate`
- `projection_freshness`
- `worker_cadence`

status score는 runtime gate report의 sub-check status를 그대로 사용한다.

blocker rule:

- 위 sub-check 중 하나라도 `fail`이면 blocker
- `shadow_to_web_cutover` 또는 `web_cutover_to_json_demotion` stage gate가 `fail`이면 blocker

### 3.2 Backend Deploy Parity

이 category는 "deploy pipeline이 실제로 같은 canonical state를 안전하게 publish하는가"를 본다.

입력:

- `backend_json_parity_report.clean`
- canonical smoke fixture registry completeness
- preview / production deploy workflow가 canonical smoke를 hard gate로 거는지

score logic:

- parity clean: `60%`
- fixture registry complete: `20%`
- workflow hard gate configured: `20%`

blocker rule:

- parity가 clean이 아니면 blocker

### 3.3 Web Backend-Only Stability

이 category는 shipped web surface가 backend-only response를 믿고 넘어갈 정도로 stable한지 본다.

입력:

- `backend_shadow_read_report.json`
- surface coverage: `search`, `calendar_month`, `radar`, `entity_detail`, `release_detail`

score logic:

- `search`: `15%`
- `calendar_month`: `20%`
- `radar`: `10%`
- `entity_detail`: `25%`
- `release_detail`: `30%`

각 surface는 `clean_cases / total_cases` ratio를 사용한다.

blocker rule:

- `entity_detail`, `release_detail`, `calendar_month`, `radar` 중 하나라도 `1.0` clean ratio가 아니면 blocker

### 3.4 Mobile Runtime Mode

이 category는 mobile이 release profile에서 backend-api를 primary mode로 쓰고 있는지 본다.

입력:

- `mobile/src/config/runtime.ts`
- `mobile/src/services/datasetSource.ts`
- `mobile/src/config/debugMetadata.ts`

검증 항목:

- preview profile default가 `backend-api`
- production profile default가 `backend-api`
- dataset selection이 backend primary를 유지
- bundled-static normal mode가 development에만 남아 있음

blocker rule:

- preview 또는 production default가 `backend-api`가 아니면 blocker
- dataset selection이 backend primary가 아니면 blocker

### 3.5 Catalog Completeness

이 category는 migration 이후 shared release detail / title-track / MV contract가 실사용 가능한지 본다.

입력:

- `historical_release_detail_coverage_report.json`
- `canonical_null_coverage_report.json`
- `null_coverage_trend_report.json`
- policy baseline: `docs/specs/backend/canonical-null-hygiene-operating-model.md`

score logic:

- detail payload ratio: `20%`
- detail trusted ratio: `20%`
- title-track resolved ratio: `20%`
- canonical MV ratio: `20%`
- critical null-hygiene ratio: `20%`

target:

- detail payload: `100%`
- detail trusted: `100%`
- title-track resolved: `85%`
- canonical MV: `35%`

pre-2024 blocker floor:

- title-track resolved: `75%`
- canonical MV: `20%`

latest / recent critical null blocker floor:

- latest Wave 1 family:
  - title-track `95%`
  - canonical MV `80%`
  - YouTube Music / Spotify `85%`
  - official links `100%`
- recent Wave 1 family:
  - title-track `85%`
  - canonical MV `55%`
  - YouTube Music / Spotify `70%`
  - official links `95%`

regression budget:

- latest: week-over-week `-2pp` 초과 시 blocker
- recent: week-over-week `-5pp` 초과 시 `needs_review`
- historical: quarter-over-quarter `-3pp` 초과 시 `needs_review`

blocker rule:

- overall 또는 pre-2024 title-track ratio가 floor보다 낮으면 blocker
- overall 또는 pre-2024 canonical MV ratio가 floor보다 낮으면 blocker
- latest Wave 1 family 중 하나라도 floor 미달이면 blocker
- recent Wave 1 family가 두 개 이상 floor 미달이면 blocker
- trend artifact가 없거나 stale면 최대 `needs_review`

## 4. Artifact Contract

scorecard generator는 두 산출물을 남긴다.

- machine-readable: `backend/reports/migration_readiness_scorecard.json`
- human-readable: `backend/reports/migration_readiness_scorecard.md`

JSON에는 아래가 들어가야 한다.

- `rubric`
- `evidence_paths`
- `overall`
- `categories`
- `summary_lines`

Markdown에는 아래가 들어가야 한다.

- overall status / score / cutover blocked
- blocker list
- category table
- summary lines
- evidence path list

## 5. Current Interpretation Rule

현재 scorecard는 아래 질문에 답하는 artifact다.

1. 지금 cutover를 선언해도 되는가
2. blocker가 runtime인지 parity인지 web surface drift인지 catalog completeness인지
3. mobile이 아직 bundled-static primary인지, 아니면 backend-primary 단계로 올라왔는지

이 문서는 blocker를 "고치는 문서"가 아니라 blocker를 "같이 읽는 기준"이다.
