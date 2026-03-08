# Canonical Backend Data Model

## 1. 목적

이 문서는 현재 JSON-first 파이프라인을 장기적으로 대체할 canonical backend data model을 정의한다.
목표는 웹과 향후 모바일이 같은 정본 의미론을 공유하도록 만드는 것이다.

핵심은 아래를 분리하는 것이다.

1. canonical write model
2. projection / read model

즉, 현재의 `artistProfiles.json`, `upcomingCandidates.json`, `releaseDetails.json` 같은 산출물을
그대로 DB 테이블로 복제하지 않고, 장기 정본과 제품용 rollup을 명시적으로 나눈다.

## 2. 모델링 원칙

### 2.1 정본과 projection 분리

- canonical write model은 ingest, curation, override, review state를 보존한다.
- projection / read model은 웹/모바일 화면에 맞춘 rollup과 cache를 담당한다.
- `releases.json`, `watchlist.json`, `releaseHistory.json`, `releaseDetails.json`는 장기 정본이 아니라 projection이다.

### 2.2 entity scope 확장

- entity는 `group | solo | unit | project`를 모두 포함한다.
- alias와 Korean-searchable seed는 UI helper가 아니라 first-class domain data다.

### 2.3 날짜 의미론 고정

- 제품에서 보이는 날짜 의미론은 `Asia/Seoul` 기준이다.
- DB timestamp는 UTC 저장을 기본으로 한다.
- upcoming은 `exact | month_only | unknown` precision을 반드시 분리한다.

### 2.4 override / review 내구화

- official link, YouTube allowlist, MV override, manual review queue는 흩어진 JSON fallback이 아니라 durable record를 가진다.
- canonical source와 manual override, unresolved 상태를 같은 레코드에서 구분 가능해야 한다.

### 2.5 stable key 우선

- 화면은 display label보다 stable identifier를 따라야 한다.
- entity는 `id`와 `slug`를 중심으로 찾고, release는 canonical unique key와 `id`를 함께 가진다.

## 3. Stable IDs And Lookup Keys

### 3.1 Entity

- canonical primary key: `entities.id uuid`
- stable product key: `entities.slug`
- display text는 `display_name`, canonical naming은 `canonical_name`

권장 규칙:

- slug는 앱 route, read API path, projection cache key로 재사용한다.
- alias는 `normalized_alias`까지 저장해 검색 인덱스와 dedupe에 재사용한다.

### 3.2 Release

- canonical primary key: `releases.id uuid`
- natural unique key:
  - `entity_id`
  - `normalized_release_title`
  - `release_date`
  - `stream`

보조 규칙:

- 충돌 가능성이 있으면 `release_kind`를 보조 키로만 사용한다.
- `musicbrainz_release_group_id`는 외부 source key로 저장하지만 내부 pk를 대체하지 않는다.

### 3.3 Upcoming Signal

- canonical primary key: `upcoming_signals.id uuid`
- dedupe key: `dedupe_key`
- headline display와 별개로 `normalized_headline`를 저장한다.

### 3.4 Channel / Link / Review

- official channel은 `youtube_channels.id uuid`
- release service link는 `(release_id, service_type)` unique
- review task는 `review_tasks.id uuid`

## 4. Canonical Write Model

### 4.1 `entities`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `slug` | `text unique` | stable route / read key |
| `canonical_name` | `text` | canonical naming |
| `display_name` | `text` | product display label |
| `entity_type` | `text` | `group | solo | unit | project` |
| `agency_name` | `text null` | text first, agency table later |
| `debut_year` | `int null` | optional seed |
| `badge_image_url` | `text null` | canonical badge/avatar asset URL when available |
| `badge_source_url` | `text null` | source page/channel for badge asset provenance |
| `badge_source_label` | `text null` | human-readable provenance label |
| `badge_kind` | `text null` | current seed kind, e.g. `official_channel_avatar` |
| `representative_image_url` | `text null` | team hero / badge fallback |
| `representative_image_source` | `text null` | provenance |
| `created_at` | `timestamptz` | audit |
| `updated_at` | `timestamptz` | audit |

### 4.2 `entity_aliases`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `entity_id` | `uuid fk -> entities.id` | owner entity |
| `alias` | `text` | raw alias |
| `alias_type` | `text` | `official_ko | common_ko | shorthand | nickname | romanized | legacy | search_seed` |
| `normalized_alias` | `text` | shared search normalization |
| `is_primary` | `boolean` | preferred alias of the same type |

Constraint:

- unique `(entity_id, alias)`

### 4.3 `entity_official_links`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `entity_id` | `uuid fk -> entities.id` | owner entity |
| `link_type` | `text` | `youtube | x | instagram | website | artist_source` |
| `url` | `text` | canonical URL |
| `is_primary` | `boolean` | same type primary marker |
| `provenance` | `text null` | source summary |

### 4.4 `youtube_channels`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `canonical_channel_url` | `text unique` | normalized channel URL |
| `channel_label` | `text` | display name |
| `owner_type` | `text` | `team | label | distributor | other_official` |
| `display_in_team_links` | `boolean` | show in team social row |
| `allow_mv_uploads` | `boolean` | can host official MV |
| `provenance` | `text null` | seed or review note |

### 4.5 `entity_youtube_channels`

| field | type | notes |
| --- | --- | --- |
| `entity_id` | `uuid fk -> entities.id` | owner entity |
| `youtube_channel_id` | `uuid fk -> youtube_channels.id` | linked channel |
| `channel_role` | `text` | `primary_team_channel | mv_allowlist | both` |

Constraint:

- unique `(entity_id, youtube_channel_id)`

### 4.6 `releases`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `entity_id` | `uuid fk -> entities.id` | owner entity |
| `release_title` | `text` | raw title |
| `normalized_release_title` | `text` | dedupe/search |
| `release_date` | `date` | Asia/Seoul semantic date |
| `stream` | `text` | `song | album` |
| `release_kind` | `text null` | `single | ep | album | ost ...` |
| `release_format` | `text null` | UI display / upstream format |
| `source_url` | `text null` | external verification source |
| `artist_source_url` | `text null` | artist-specific source |
| `musicbrainz_artist_id` | `text null` | external source key |
| `musicbrainz_release_group_id` | `text null` | external source key |
| `notes` | `text null` | import note |
| `created_at` | `timestamptz` | audit |
| `updated_at` | `timestamptz` | audit |

Constraint:

- unique `(entity_id, normalized_release_title, release_date, stream)`

### 4.7 `release_artwork`

| field | type | notes |
| --- | --- | --- |
| `release_id` | `uuid pk fk -> releases.id` | one-to-one with release |
| `cover_image_url` | `text null` | main cover |
| `thumbnail_image_url` | `text null` | smaller asset |
| `artwork_source_type` | `text null` | upstream source classifier |
| `artwork_source_url` | `text null` | provenance |

### 4.8 `tracks`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `release_id` | `uuid fk -> releases.id` | parent release |
| `track_order` | `int` | sequence order |
| `track_title` | `text` | raw title |
| `normalized_track_title` | `text` | compare/search key |
| `is_title_track` | `boolean null` | supports double-title |

Constraint:

- unique `(release_id, track_order)`

### 4.9 `release_service_links`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `release_id` | `uuid fk -> releases.id` | parent release |
| `service_type` | `text` | `spotify | youtube_music | youtube_mv` |
| `url` | `text null` | canonical target URL |
| `status` | `text` | `canonical | manual_override | relation_match | needs_review | unresolved | no_link` |
| `provenance` | `text null` | relation / override / search note |

Constraint:

- unique `(release_id, service_type)`

### 4.10 `track_service_links`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `track_id` | `uuid fk -> tracks.id` | parent track |
| `service_type` | `text` | `spotify | youtube_music` |
| `url` | `text null` | canonical track URL |
| `status` | `text` | `canonical | unresolved | no_link` |
| `provenance` | `text null` | source note |

Constraint:

- unique `(track_id, service_type)`

### 4.11 `upcoming_signals`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `entity_id` | `uuid fk -> entities.id` | owner entity |
| `headline` | `text` | human-readable headline |
| `normalized_headline` | `text` | dedupe/search |
| `scheduled_date` | `date null` | exact date only |
| `scheduled_month` | `date null` | month-only anchors to first day of month |
| `date_precision` | `text` | `exact | month_only | unknown` |
| `date_status` | `text` | `confirmed | scheduled | rumor` |
| `release_format` | `text null` | album/single/etc |
| `confidence_score` | `numeric(4,2) null` | normalized confidence |
| `tracking_status` | `text null` | pipeline state |
| `first_seen_at` | `timestamptz null` | first discovery |
| `latest_seen_at` | `timestamptz null` | last corroboration |
| `is_active` | `boolean` | still relevant |
| `dedupe_key` | `text null` | stable dedupe key |

### 4.12 `upcoming_signal_sources`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `upcoming_signal_id` | `uuid fk -> upcoming_signals.id` | parent signal |
| `source_type` | `text` | `news_rss | weverse_notice | agency_notice | official_social | manual` |
| `source_url` | `text` | exact evidence URL |
| `source_domain` | `text null` | domain extraction |
| `published_at` | `timestamptz null` | source publish time |
| `search_term` | `text null` | query provenance |
| `evidence_summary` | `text null` | short evidence memo |

Constraint:

- unique `(upcoming_signal_id, source_url)`

### 4.13 `entity_tracking_state`

| field | type | notes |
| --- | --- | --- |
| `entity_id` | `uuid pk fk -> entities.id` | one row per tracked entity |
| `tier` | `text` | tracking tier |
| `watch_reason` | `text` | why this entity is tracked |
| `tracking_status` | `text` | `recent_release | watch_only | needs_manual_review ...` |
| `latest_verified_release_id` | `uuid null fk -> releases.id` | current latest verified link |
| `updated_at` | `timestamptz` | rollup freshness |

### 4.14 `review_tasks`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `review_type` | `text` | `upcoming_signal | mv_candidate | entity_onboarding | alias_gap` |
| `status` | `text` | `open | resolved | dismissed` |
| `entity_id` | `uuid null fk -> entities.id` | optional owner |
| `release_id` | `uuid null fk -> releases.id` | optional owner |
| `upcoming_signal_id` | `uuid null fk -> upcoming_signals.id` | optional owner |
| `review_reason` | `text[] null` | reason codes |
| `recommended_action` | `text null` | operator hint |
| `payload` | `jsonb null` | source-specific detail |
| `created_at` | `timestamptz` | audit |
| `resolved_at` | `timestamptz null` | audit |

### 4.15 `release_link_overrides`

| field | type | notes |
| --- | --- | --- |
| `id` | `uuid pk` | canonical primary key |
| `release_id` | `uuid fk -> releases.id` | parent release |
| `service_type` | `text` | `youtube_music | youtube_mv` |
| `override_url` | `text null` | canonical target |
| `override_video_id` | `text null` | parsed YouTube video id |
| `provenance` | `text` | why override exists |

Constraint:

- unique `(release_id, service_type)`

## 5. Relationship Summary

### 5.1 Core ownership

- one `entity` has many aliases, official links, releases, upcoming signals
- one `entity` can have many YouTube channels via `entity_youtube_channels`
- one `release` has one artwork row, many tracks, many release service links
- one `upcoming_signal` has many source rows
- one `entity` has one tracking state row

### 5.2 Override / review boundary

- canonical service links live in `release_service_links`
- manual exceptions live in `release_link_overrides`
- ambiguous or missing cases live in `review_tasks`

이렇게 분리하면 canonical value와 operator intervention, unresolved state가 한 테이블에 섞이지 않는다.

## 6. Projection / Read Model

아래는 canonical truth가 아니라 consumer-facing derived model이다.

### 6.1 `entity_search_documents`

목적:

- search screen, alias autocomplete, slug lookup

주요 필드:

- `entity_id`
- `slug`
- `display_name`
- `aliases[]`
- `normalized_search_terms[]`
- `badge_image_url?`
- `agency_name?`

### 6.2 `entity_release_rollups`

목적:

- `releases.json` 대체
- latest song / latest album / latest verified release를 빠르게 제공

주요 필드:

- `entity_id`
- `latest_song_release_id?`
- `latest_album_release_id?`
- `latest_verified_release_id?`
- `latest_release_date?`
- `latest_stream?`

### 6.3 `entity_tracking_rollups`

목적:

- `watchlist.json` 대체
- radar / tracking-state UI용 compact rollup

주요 필드:

- `entity_id`
- `tier`
- `watch_reason`
- `tracking_status`
- `latest_verified_release_summary`
- `next_upcoming_summary?`

### 6.4 `release_detail_projection`

목적:

- `releaseDetails.json`, `releaseArtwork.json` 대체
- release detail page / team detail album row에 필요한 denormalized payload 제공

주요 필드:

- `release_id`
- `entity_id`
- `display_name`
- `release_title`
- `release_date`
- `stream`
- `cover_image_url?`
- `tracks[]`
- `service_links`
- `youtube_video_id?`
- `youtube_video_status`
- `youtube_video_provenance?`

### 6.5 `calendar_month_projection`

목적:

- 월간 캘린더와 선택 날짜 패널에 필요한 compact day bucket 제공

주요 필드:

- `year_month`
- `verified_releases_by_day`
- `exact_upcoming_by_day`
- `month_only_upcoming_bucket`
- `nearest_exact_upcoming`
- `monthly_counts`

### 6.6 `entity_release_history_projection` optional

현재 웹의 `releaseHistory.json`은 `releases` 테이블만으로도 계산 가능하다.
다만 팀 페이지 yearly timeline이 잦은 트래픽을 받는다면 별도 projection table 또는 materialized view로 캐시할 수 있다.

## 7. Ownership Boundaries

### 7.1 Canonical write ownership

| concern | canonical owner |
| --- | --- |
| entity profile / aliases / official links | `entities`, `entity_aliases`, `entity_official_links` |
| official YouTube channel allowlist | `youtube_channels`, `entity_youtube_channels` |
| verified release / track / artwork | `releases`, `tracks`, `release_artwork` |
| service handoff canonical state | `release_service_links`, `track_service_links` |
| upcoming signal / source evidence | `upcoming_signals`, `upcoming_signal_sources` |
| tracking tier / watch reason | `entity_tracking_state` |
| manual review state | `review_tasks` |
| curated link override | `release_link_overrides` |

### 7.2 Generated read ownership

| product output | source-of-truth after migration |
| --- | --- |
| search result seed | `entity_search_documents` |
| home / monthly latest release summaries | `entity_release_rollups` |
| watchlist / radar | `entity_tracking_rollups` |
| release detail / service handoff / MV state | `release_detail_projection` |
| calendar day buckets | `calendar_month_projection` |

### 7.3 Curated inputs

아래는 canonical row를 직접 사람이 결정하거나 보정하는 입력이다.

- onboarding seed
- alias seed
- official social / channel seed
- release link override
- review task resolution

이 입력은 최종적으로 canonical write model에 반영되어야 하며,
"curated JSON file 그대로 영구 보관"을 목표로 하지 않는다.

## 8. Current JSON To Backend Mapping

| current file | backend target | migration note |
| --- | --- | --- |
| `web/src/data/artistProfiles.json` | `entities`, `entity_aliases`, `entity_official_links` | current seed becomes canonical entity import source |
| `web/src/data/youtubeChannelAllowlists.json` | `youtube_channels`, `entity_youtube_channels` | team + label allowlist split preserved |
| `group_latest_release_since_2025-06-01_mb.json` | `releases`, `entity_tracking_state.latest_verified_release_id` | latest-only import feed, not durable read model |
| `verified_release_history_mb.json` | `releases`, `tracks?`, `release_artwork?` | full verified history import source |
| `web/src/data/releases.json` | `entity_release_rollups` | product rollup only |
| `web/src/data/releaseHistory.json` | derived from `releases`, optional `entity_release_history_projection` | timeline-specific projection |
| `web/src/data/releaseArtwork.json` | `release_artwork` or `release_detail_projection` | canonical artwork still belongs to write model |
| `web/src/data/releaseDetails.json` | `tracks`, `release_service_links`, `track_service_links`, `release_detail_projection` | detail payload is denormalized read model |
| `tracking_watchlist.json` | `entity_tracking_state` | root job output becomes import/backfill feed |
| `web/src/data/watchlist.json` | `entity_tracking_rollups` | product rollup only |
| `upcoming_release_candidates.json` | `upcoming_signals`, `upcoming_signal_sources` | root scan output becomes canonical ingest source |
| `web/src/data/upcomingCandidates.json` | `calendar_month_projection` and related read models | consumer-facing projection |
| `manual_review_queue.json` | `review_tasks` with `review_type='upcoming_signal'` | queue becomes canonical review record |
| `mv_manual_review_queue.json` | `review_tasks` with `review_type='mv_candidate'` | queue becomes canonical review record |
| `release_detail_overrides.json` | `release_link_overrides` | override source |
| `mv_coverage_report.json` | reporting only | not canonical |
| `web/src/data/releaseChangeLog.json` | reporting only | not canonical |

## 9. Import / Write Semantics

### 9.1 Entity onboarding

- onboarding job upserts `entities`
- alias seed writes `entity_aliases`
- official link seed writes `entity_official_links`
- YouTube allowlist seed writes `youtube_channels` and `entity_youtube_channels`

### 9.2 Verified release ingestion

- history import creates or upserts `releases`
- artwork enrichment updates `release_artwork`
- detail enrichment writes `tracks`, `release_service_links`, `track_service_links`
- title-track tagging updates `tracks.is_title_track`

### 9.3 Upcoming ingestion

- scan job creates or upserts `upcoming_signals`
- every corroborating article or official post writes `upcoming_signal_sources`
- exact/month-only/unknown semantics are stored directly, not inferred in UI

### 9.4 Review / override loop

- ambiguous data creates `review_tasks`
- operator resolution updates canonical row or override row
- resolved task keeps audit trail instead of disappearing

## 10. Open Questions

1. `agency_name`를 초기에는 text로 두고, later migration에서 `agencies` table로 승격할지?
2. projection materialization을 SQL view / materialized view / worker-generated table 중 무엇으로 고정할지?
3. `review_tasks.payload`에 후보 raw response를 얼마나 저장할지?
4. release unique key 충돌 시 `release_kind`를 언제부터 mandatory disambiguator로 승격할지?

## 11. Acceptance Checklist

- entity type, alias, official link가 first-class field로 표현된다.
- verified release, track, artwork, title-track metadata를 보존할 수 있다.
- upcoming의 `exact | month_only | unknown` precision이 직접 저장된다.
- canonical 링크, manual override, review state가 분리된다.
- `releases.json`, `watchlist.json`, `releaseDetails.json`를 projection으로 취급한다.
- 현재 JSON 파일을 backend model로 매핑할 때 추정이 필요 없다.

## 12. References

- Parent epic: `#146`
- Related: `#145`, `#147`, `#148`, `#155`, `#156`, `#157`
- Existing consumer contract: `docs/specs/mobile/data-binding-spec.md`
