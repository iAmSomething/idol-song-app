# Canonical Null Hygiene And Enrichment Operating Model

이 문서는 canonical DB의 빈값을 "무조건 없애야 할 결함"으로 보지 않고,
설명 가능한 null만 남기기 위한 운영 기준을 고정한다.

이 문서가 닫는 문제는 아래와 같다.

- `#566`: null hygiene 운영 모델
- `#567`: nullable field taxonomy
- `#569`: provenance / status / source-pointer convention
- `#571`: product-impact wave planning
- `#577`: recency-based SLA
- `#579`: readiness gate 연결 기준
- `#582`: source precedence / overwrite rule

## 1. Core Principles

- 목표는 `null 제거`가 아니라 `설명 가능한 null만 남기기`다.
- 분류되지 않은 null은 기본적으로 `unresolved`로 본다.
- product-critical field는 value만 채우지 않고 `status`, `provenance`, `source_pointer`까지 같이 본다.
- weak source가 strong source를 덮어쓰지 못하게 해야 한다.
- latest / recent / historical catalog는 같은 SLA로 보지 않는다.
- manual override는 운영자가 명시적으로 해제하기 전까지 자동 source보다 우선한다.

## 2. Null Taxonomy

| bucket | 의미 | readiness 해석 |
| --- | --- | --- |
| `required_backfill` | 제품 신뢰, handoff, 식별에 직접 걸리는 값이라 계속 채워야 하는 필드 | coverage floor 미달이면 blocker 후보 |
| `conditional_null` | 현재 정보 조건상 비어 있어도 정상인 필드 | explicit reason이 있으면 허용 |
| `true_optional` | 제품 계약상 없어도 괜찮은 필드 | gate 대상 아님 |
| `unresolved` | 원래 채워져야 하거나, conditional 여부가 아직 증명되지 않은 빈값 | review / retry / queue 대상 |

추가 규칙:

- field family가 taxonomy에 아직 분류되지 않았다면 기본값은 `unresolved`다.
- `conditional_null`은 reason 없이 쓰지 않는다.
- `true_optional`은 product-critical family에 기본값으로 쓰지 않는다.

## 3. Product-Critical Field Families

| table / family | 대표 필드 | 기본 bucket | `conditional_null` 허용 조건 |
| --- | --- | --- | --- |
| `releases + tracks` title-track | `tracks.is_title_track`, `releases.title_track_status`, `releases.title_track_provenance` | `required_backfill` | compilation / instrumental / trackless release처럼 title-track 개념이 성립하지 않는 경우 |
| `release_service_links` MV | `service = youtube_mv`, `url`, `status`, `provenance` | `required_backfill` | 공식 MV가 없다고 first-party evidence로 확인된 경우 |
| `release_service_links` YouTube Music / Spotify | `service = youtube_music|spotify`, `url`, `status`, `provenance` | `required_backfill` | 플랫폼 미유통, 지역 제한, object 부재가 확인된 경우 |
| `entities` official links | `official_youtube_url`, `official_x_url`, `official_instagram_url`, `official_site_url` | `required_backfill` | 해당 채널/계정이 실제로 존재하지 않거나 아직 미개설인 경우 |
| `entities` representative image | `representative_image_url`, `badge_image_url`, `badge_source_url` | `required_backfill` | defensible first-party asset가 아직 없고 임의 이미지 사용이 더 위험한 경우 |
| `entities` agency | `agency_name` | `required_backfill` | 독립/무소속으로 확인됐지만 canonical agency 개념을 두지 않는 경우 |
| `entities` debut year | `debut_year` | `required_backfill` | pre-debut project / survival-derived entity처럼 official debut이 아직 없는 경우 |
| `upcoming_signals` date family | `scheduled_date`, `scheduled_month`, `date_precision` | `conditional_null` | month-only / unknown precision이 source evidence에 명시된 경우 |
| `upcoming_signals` release metadata | `release_format`, `confidence_score` | `conditional_null` | source에서 형식이 드러나지 않는 경우 |
| descriptive notes | `releases.notes`, low-signal memo 계열 | `true_optional` | 기본 허용 |

## 4. Field Family Context Contract

product-critical family는 아래 3가지를 같이 가져간다.

| family | required context | source pointer example |
| --- | --- | --- |
| title-track | `status`, `provenance`, optional `review_task_id` | official tracklist URL, override key, review task key |
| service links | `status`, `provenance` | canonical platform URL, MusicBrainz relation URL, candidate URL, override key |
| official links | `status`, `provenance` | official profile URL, allowlist row key |
| representative image | `status`, `provenance`, optional `badge_kind` | channel/avatar URL, first-party asset page |
| agency / debut year | `status`, `provenance` | company page URL, trusted structured row key |
| upcoming date family | `date_precision`, `tracking_status`, `latest_seen_at` | source article URL, scan evidence URL |

규칙:

- `provenance`는 free-form 설명문이 아니라 machine-friendly short string을 우선한다.
- `source_pointer`는 가능한 한 stable URL이나 internal row key여야 한다.
- `missing`과 `unresolved`를 구분해야 한다. 값이 비어 있어도 `conditional_null`이면 unresolved backlog로 세지지 않는다.

## 5. Status Conventions

field family별로 완전히 같은 enum을 강제하지는 않지만, 의미는 아래 중 하나로 읽혀야 한다.

| semantic status | 의미 |
| --- | --- |
| `canonical` | strong source로 확정된 값 |
| `manual_override` | 운영자가 고정한 값. 명시적 해제 전까지 가장 우선 |
| `relation_match` / `seed_verified` | structured source나 curated seed로 확인된 값 |
| `needs_review` | 후보는 있으나 human review가 필요한 상태 |
| `unresolved` | 채워야 하지만 아직 확정하지 못한 상태 |
| `conditional_null` | evidence상 비어 있어도 정상인 상태 |
| `no_link` | 플랫폼/자산이 없다고 확인된 negative canonical 상태 |
| `true_optional` | 제품적으로 비어 있어도 되는 상태 |

추가 규칙:

- `no_link`, `unresolved`, `needs_review`는 positive canonical value를 덮어쓰지 않는다.
- `manual_override`는 clear action 없이는 자동 source에 밀리지 않는다.
- `conditional_null`은 `unresolved`를 덮을 수 있지만, 근거가 있어야 한다.

## 6. Source Precedence And Overwrite Rules

### 6.1 Precedence Tiers

| tier | source class | 예시 |
| --- | --- | --- |
| 1 | operator-fixed | manual override, curated canonical fix |
| 2 | first-party exact | official channel / official site / official tracklist / canonical platform object |
| 3 | structured trusted exact | MusicBrainz relation, verified allowlist, deterministic platform object |
| 4 | curated seed | reviewed seed file, historical allowlist, backfill bundle |
| 5 | heuristic candidate | search-derived candidate, fuzzy alias match, scoring model candidate |
| 6 | negative state | `needs_review`, `unresolved`, `no_link`, placeholder |

### 6.2 Overwrite Matrix

- higher tier는 lower tier를 덮을 수 있다.
- 같은 tier에서는 아래 순서를 따른다.
  - more exact identifier
  - newer corroboration timestamp
  - stronger status (`canonical` > `seed_verified` > `needs_review`)
- `manual_override`는 tier 비교를 건너뛰고 sticky하다.
- tier 6은 tier 1~5의 populated value를 덮지 못한다.
- weaker fill은 overwrite 대신 review task를 만든다.
- source가 바뀌어도 provenance와 previous source pointer는 audit trail에 남겨야 한다.

## 7. Backfill Waves

| wave | 목적 | field family |
| --- | --- | --- |
| Wave 1 | trust / handoff / release-detail usability | title-track, canonical MV, YouTube Music, Spotify, official YouTube, official social/site |
| Wave 2 | identity / search / discovery quality | representative image, agency, debut year |
| Wave 3 | explanatory completeness | notes, lower-signal metadata, non-critical context |

운영 규칙:

- 같은 리소스라면 항상 Wave 1을 먼저 채운다.
- Wave 2는 Wave 1 regression을 만들면서 진행하지 않는다.
- Wave 3는 readiness blocker를 해소한 뒤에만 공격적으로 진행한다.

## 8. Cohorts And SLAs

### 8.1 Cohort Definition

- `latest`
  - 최근 12개월 release
  - 또는 앞으로 90일 내 upcoming / release-adjacent entity
- `recent`
  - 12개월 초과, 36개월 이하 release
- `historical`
  - 36개월 초과 release
  - 운영 shorthand로는 `pre-2024` slice를 별도 본다

### 8.2 Coverage Floors

| cohort | Wave 1 floor | Wave 2 floor | regression budget |
| --- | --- | --- | --- |
| `latest` | title-track `95%`, canonical MV `80%`, YT Music/Spotify `85%`, official links `100%` | representative image `95%`, agency `95%`, debut year `90%` | week-over-week `-2pp` 초과 시 blocker |
| `recent` | title-track `85%`, canonical MV `55%`, YT Music/Spotify `70%`, official links `95%` | representative image `85%`, agency `85%`, debut year `80%` | week-over-week `-5pp` 초과 시 needs review |
| `historical` | title-track `75%`, canonical MV `20%`, service links는 regression-only | representative image / agency / debut year는 regression-only | quarter-over-quarter `-3pp` 초과 시 needs review |

해석:

- `latest`는 aggressive backfill 대상이다.
- `historical`은 느린 개선을 허용하되, 이미 채운 coverage가 내려가면 안 된다.
- trend artifact가 없으면 readiness는 최소 `needs_review`다.

## 9. Readiness And Runtime Gate Mapping

critical null hygiene는 아래 artifact를 기준으로 읽는다.

- future machine-readable coverage artifact:
  - `backend/reports/canonical_null_coverage_report.json`
- future trend artifact:
  - `backend/reports/null_coverage_trend_report.json`
- current supporting artifact:
  - `backend/reports/historical_release_detail_coverage_report.json`

gate 규칙:

- `latest` cohort Wave 1 family 중 하나라도 floor 미달이면 readiness blocker
- `recent` cohort Wave 1 family가 floor 미달이면 기본 `needs_review`, 두 개 이상 미달이면 blocker
- `historical` cohort는 floor 자체보다 regression budget 위반을 먼저 본다
- trend artifact가 없거나 stale이면 runtime gate는 `needs_review`
- `conditional_null` / `true_optional`은 coverage denominator에서 제외한다

## 10. What This Document Does Not Do

- 개별 MV / title-track / agency backfill 자체를 구현하지 않는다
- null coverage report generator를 직접 구현하지 않는다
- review queue UI를 정의하지 않는다

이 문서는 앞으로의 enrichment와 gate가 같은 언어로 읽히게 만드는 기준 문서다.
