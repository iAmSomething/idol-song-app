# Public Read API Contract v1

## Status
- Version: `v1`
- Audience: web consumer, mobile consumer, backend operator
- Canonical status: current stable public reference
- Scope date: `2026-03-11`

## Purpose

이 문서는 현재 backend read surface의 정식 public contract를 고정한다.
web과 mobile은 이 문서를 기준으로 payload 의미를 해석하고, backend route 구현 파일을 직접 읽지 않아도 된다.

이 문서가 다루는 것은 endpoint path, query/param contract, stable field semantics, compatibility rule이다.
구현 중간 상태나 route 내부 detail은 여기서 계약으로 승격하지 않는다.

## Versioning Rule

- public read base path는 `/v1`
- `v1` 안에서 허용되는 변화:
  - optional field 추가
  - 기존 enum에 additive value 추가
  - non-breaking metadata 추가
  - internal provenance/debug field의 optional 확장
- `v1` 안에서 허용되지 않는 변화:
  - path/param rename
  - required field 삭제
  - field type 변경
  - `date_precision`, `date_status`, `service_link.status`, `mv.status` 의미 변경
  - stable identifier rename (`entity_slug`, `release_id`, `upcoming_signal_id`)
- 위와 같은 breaking change가 필요하면 새 path version(`v2`)을 연다.

## Common Envelope

모든 `/v1/*` success response는 아래 envelope를 사용한다.

```json
{
  "meta": {
    "request_id": "api-uuid",
    "generated_at": "2026-03-11T02:30:00.000Z",
    "timezone": "Asia/Seoul",
    "route": "/v1/search",
    "source": "projection"
  },
  "data": {}
}
```

Error response는 `meta + error` shape를 사용한다.

공통 규칙:
- `meta.request_id`
  - observability field
  - caller가 `X-Request-Id`를 보내면 같은 값이 echo된다
- `meta.generated_at`
  - freshness 판단용
  - shape는 stable, exact timestamp 값은 non-deterministic
- `meta.timezone`
  - product semantics timezone
  - 현재 `Asia/Seoul`
- `meta.route`
  - request path
  - stable metadata
- `meta.source`
  - current implementation detail 성격이 강한 metadata
  - client logic 분기 기준으로 쓰지 않는다

## Shipping Endpoint Matrix

| Endpoint | Consumer class | Stability |
| --- | --- | --- |
| `GET /health` | operator / liveness | stable ops contract |
| `GET /ready` | operator / deploy gate | stable ops contract |
| `GET /v1/calendar/month` | web + mobile | stable public contract |
| `GET /v1/search` | web + mobile | stable public contract |
| `GET /v1/entities/:slug` | web + mobile | stable public contract |
| `GET /v1/releases/:id` | web + mobile | stable public contract |
| `GET /v1/releases/lookup` | transition helper | stable transitional helper |
| `GET /v1/radar` | web + mobile | stable public contract |
| `GET /v1/entities/:slug/channels` | operator/debug | stable operator contract |
| `GET /v1/review/upcoming` | operator | stable operator contract |
| `GET /v1/review/mv` | operator | stable operator contract |

## Stable Identifier Contract

- `entity_slug`
  - public team/artist identifier
  - path-safe and durable across read surfaces
- `release_id`
  - stable UUID
  - release detail primary key
- `upcoming_signal_id`
  - stable UUID/string id for canonical representative upcoming row
- `review_task_id`
  - operator review queue id

## Public Consumer Endpoints

### `GET /v1/calendar/month?month=YYYY-MM`

Purpose:
- calendar tab
- monthly dashboard

Stable query contract:
- required `month`
- format `YYYY-MM`

Stable semantics:
- `days[].exact_upcoming` contains only `date_precision = exact`
- `month_only_upcoming` is separate from day cells
- `nearest_upcoming` is selected from future exact-date rows only
- `scheduled_month` is always `YYYY-MM`
- source summary is server-derived and action-ready

Stable data blocks:
- `summary`
- `nearest_upcoming`
- `days`
- `month_only_upcoming`
- `verified_list`
- `scheduled_list`

### `GET /v1/search?q=...`

Purpose:
- unified search for teams, releases, upcoming signals

Stable query contract:
- required `q`
- optional `limit`
- blank query is invalid

Stable semantics:
- alias normalization is server-side
- result segments are always present: `entities`, `releases`, `upcoming`
- match reasons are stable semantic enums:
  - entity: `display_name_exact`, `alias_exact`, `alias_partial`, `partial`
  - release: `release_title_exact`, `entity_exact_latest_release`, `release_title_partial`
  - upcoming: `entity_exact`, `headline_exact`, `partial`

### `GET /v1/entities/:slug`

Purpose:
- team / artist detail page

Stable semantics:
- one aggregate payload per entity
- clients do not reconstruct official links or latest/next selections locally
- `recent_albums` is already ordered and surface-ready
- `source_timeline` is already normalized for display

Stable data blocks:
- `identity`
- `official_links`
- `youtube_channels`
- `tracking_state`
- `next_upcoming`
- `latest_release`
- `recent_albums`
- `source_timeline`
- `artist_source_url`

### `GET /v1/releases/:id`

Purpose:
- release detail page

Stable semantics:
- title-track resolution is server-side
- service-link status is server-side
- MV canonical / unresolved / review state is server-side

Stable data blocks:
- `release`
- `detail_metadata`
- `title_track_metadata`
- `artwork`
- `service_links`
- `tracks`
- `mv`
- `credits`
- `charts`
- `notes`

### `GET /v1/releases/lookup`

Purpose:
- legacy route / transition helper

Stable query contract:
- required: `entity_slug`, `title`, `date`, `stream`
- `stream` domain currently `album | song`

Stable semantics:
- helper resolves legacy exact key to canonical `release_id`
- response includes `canonical_path`

Compatibility note:
- helper is transitional but still public and stable while web/mobile migration paths rely on it

### `GET /v1/radar`

Purpose:
- radar landing surfaces

Stable data blocks:
- `featured_upcoming`
- `weekly_upcoming`
- `change_feed`
- `long_gap`
- `rookie`

Stable semantics:
- server owns radar eligibility and selection logic
- empty state still returns same block shape with `null`/`[]`

## Operator / Ops Endpoints

### `GET /health`

Stable semantics:
- liveness only
- success shape is intentionally small:
  - `status`
  - `service`
  - `now`

### `GET /ready`

Stable semantics:
- deploy / rollback gate
- `status` domain is `ready | degraded | not_ready`
- `database.status` domain is `ready | not_ready`
- `Cache-Control: no-store`

### `GET /v1/entities/:slug/channels`

Purpose:
- operator/debug inspection of team channel allowlists

Stable blocks:
- `entity`
- `channels`
- `summary`

### `GET /v1/review/upcoming`
### `GET /v1/review/mv`

Purpose:
- operator review queues

Stable semantics:
- queue item shape is stable at block level
- embedded `evidence_payload` is operator-facing and may expand additively

## Stable Vs Transitional / Internal Detail

### Stable contract

- endpoint path and query/param names
- block names under `data`
- identifier fields
- timezone semantics
- `date_precision`
- `date_status`
- search `match_reason`
- release service-link `status`
- release MV `status`
- radar block names

### Transitional or internal detail

- `meta.generated_at` concrete value
- `meta.request_id` concrete value
- `meta.source`
- `provenance` strings
- operator payload internals under `evidence_payload`
- summary text wording such as `evidence_summary`

Rule:
- clients may display transitional/internal fields
- clients must not build product logic that depends on their exact string value

## Source Of Truth

Current implementation references:
- [route contract tests](/Users/gimtaehun/Desktop/idol-song-app/backend/src/route-contract.test.ts)
- [calendar route](/Users/gimtaehun/Desktop/idol-song-app/backend/src/routes/calendar.ts)
- [search route](/Users/gimtaehun/Desktop/idol-song-app/backend/src/routes/search.ts)
- [entity routes](/Users/gimtaehun/Desktop/idol-song-app/backend/src/routes/entities.ts)
- [release routes](/Users/gimtaehun/Desktop/idol-song-app/backend/src/routes/releases.ts)
- [radar route](/Users/gimtaehun/Desktop/idol-song-app/backend/src/routes/radar.ts)
- [review routes](/Users/gimtaehun/Desktop/idol-song-app/backend/src/routes/review.ts)

이 문서가 위 구현보다 우선하는 public contract reference다.
구현이 이 문서와 다르면 구현을 수정하거나, breaking change가 아니라면 문서를 additive하게 갱신한다.
