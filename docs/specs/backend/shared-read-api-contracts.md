# Shared Read API Contracts

## 1. 목적

이 문서는 current web과 future mobile이 함께 소비할 shared read API contract를 정의한다.
핵심 목표는 각 client가 제품 의미론을 다시 조립하지 않도록 하는 것이다.

이 문서가 고정하는 것은 generic CRUD가 아니라 surface-ready read payload다.

## 2. Design Principles

### 2.1 Projection-first

- API는 raw table dump를 내보내지 않는다.
- client는 product-ready aggregate를 읽는다.

### 2.2 Server-side semantics

아래 의미론은 서버가 책임진다.

- alias normalization
- nearest upcoming selection
- latest release selection
- exact vs month_only separation
- title-track state
- MV canonical / unresolved / review state
- radar eligibility policy

### 2.3 Stable public identifiers

- public entity identifier는 `slug`
- public release identifier는 stable `release_id`
- transition helper로 `entity_slug + title + date + stream` lookup을 허용할 수 있다

### 2.4 Shared payload semantics

- web과 mobile은 같은 필드 의미를 읽는다
- client별로 별도 business-rule branch를 만들지 않는다

## 3. Envelope Rule

모든 v1 read endpoint는 아래 envelope를 기본으로 한다.

```json
{
  "meta": {
    "request_id": "uuid-or-trace-id",
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul",
    "source": "projection"
  },
  "data": {}
}
```

규칙:

- `generated_at`은 projection freshness 판단용이다
- `timezone`은 제품 의미론 기준을 명시한다
- payload business data는 `data` 아래에 둔다
- caller가 `X-Request-Id`를 보내면 backend는 같은 값을 `meta.request_id`와 `X-Request-Id` response header에 그대로 반영한다
- caller가 보내지 않으면 backend가 `api-<uuid>` 형태 request id를 생성한다
- preview와 production은 같은 request-id policy를 사용한다

## 4. Endpoint Summary

| endpoint | purpose |
| --- | --- |
| `GET /v1/calendar/month?month=2026-03` | calendar month / monthly dashboard |
| `GET /v1/search?q=트리플에스` | unified search |
| `GET /v1/entities/:slug` | entity detail |
| `GET /v1/releases/:id` | release detail |
| `GET /v1/releases/lookup?entity_slug=...&title=...&date=...&stream=...` | transition helper |
| `GET /v1/radar` | radar tab / featured derived sections |
| `GET /v1/review/upcoming` | upcoming review queue |
| `GET /v1/review/mv` | MV review queue |

## 5. `GET /v1/calendar/month`

### 5.1 Purpose

- web calendar
- mobile calendar tab
- monthly list / dashboard surfaces

### 5.2 Query Contract

- required: `month`
- format: `YYYY-MM`
- example: `2026-03`

### 5.3 Response Responsibility

- month summary count
- day-cell payload for verified releases and exact upcoming only
- separate `month_only_upcoming` bucket
- monthly verified list
- monthly scheduled list
- nearest upcoming calculated from exact future date only
- scheduled row action-ready source summary (`source_url`, `source_type`, `source_domain`, `evidence_summary`, `source_count`)
- stable `scheduled_month` in `YYYY-MM` format for both `exact` and `month_only` rows

### 5.4 Response Shape

```json
{
  "meta": {
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul",
    "month": "2026-03"
  },
  "data": {
    "summary": {
      "verified_count": 4,
      "exact_upcoming_count": 3,
      "month_only_upcoming_count": 10
    },
    "nearest_upcoming": {
      "upcoming_signal_id": "upc_yena_2026_03_11",
      "entity_slug": "yena",
      "display_name": "YENA",
      "headline": "YENA 4th Mini Album",
      "scheduled_date": "2026-03-11",
      "scheduled_month": "2026-03",
      "date_precision": "exact",
      "date_status": "confirmed",
      "confidence_score": 0.98,
      "release_format": "mini_album",
      "source_url": "https://starnewskorea.com/...",
      "source_type": "news_rss",
      "source_domain": "starnewskorea.com",
      "evidence_summary": "YENA will release a new mini album on March 11.",
      "source_count": 2
    },
    "days": [
      {
        "date": "2026-03-03",
        "verified_releases": [
          {
            "release_id": "rel_tunexx_set_by_us_only_2026_03_03_album",
            "entity_slug": "tunexx",
            "display_name": "TUNEXX",
            "release_title": "SET BY US ONLY",
            "release_date": "2026-03-03",
            "stream": "album",
            "release_kind": "ep"
          }
        ],
        "exact_upcoming": []
      }
    ],
    "month_only_upcoming": [
      {
        "entity_slug": "tomorrow-x-together",
        "display_name": "TOMORROW X TOGETHER",
        "headline": "March comeback",
        "scheduled_date": null,
        "scheduled_month": "2026-03",
        "date_precision": "month_only",
        "date_status": "scheduled",
        "confidence_score": 0.74,
        "release_format": "album",
        "source_url": "https://www.weverse.io/...",
        "source_type": "weverse_notice",
        "source_domain": "weverse.io",
        "evidence_summary": "March comeback teaser posted on Weverse.",
        "source_count": 1
      }
    ],
    "verified_list": [],
    "scheduled_list": []
  }
}
```

### 5.5 Server-side Rules

- `days[].exact_upcoming`에는 `date_precision = exact`만 들어간다
- `month_only_upcoming`은 day cell에 섞지 않는다
- `nearest_upcoming`은 exact future date만 대상으로 계산한다
- `scheduled_month`는 항상 `YYYY-MM` 형식이다
- `scheduled_month`는 `exact` row에서도 month context를 유지하기 위해 채워진다
- source summary는 `agency_notice -> weverse_notice -> official_social -> news_rss -> manual` 우선순위의 대표 source를 사용한다

## 6. `GET /v1/search`

### 6.1 Purpose

- web search
- mobile search tab

### 6.2 Query Contract

- required: `q`
- optional: `limit`
- optional future: `segment`

### 6.3 Response Responsibility

- normalized query metadata
- segmented results for `entities`, `releases`, `upcoming`
- alias normalization and match highlighting metadata

### 6.4 Response Shape

```json
{
  "meta": {
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul",
    "query": "트리플에스",
    "normalized_query": "트리플에스"
  },
  "data": {
    "entities": [
      {
        "entity_slug": "triples",
        "display_name": "tripleS",
        "canonical_name": "tripleS",
        "entity_type": "group",
        "agency_name": "MODHAUS",
        "match_reason": "alias_exact",
        "matched_alias": "트리플에스",
        "latest_release": {
          "release_id": "uuid",
          "release_title": "Are You Alive",
          "release_date": "2026-02-04",
          "stream": "album",
          "release_kind": "ep"
        },
        "next_upcoming": null
      }
    ],
    "releases": [
      {
        "release_id": "uuid",
        "canonical_path": "/v1/releases/uuid",
        "entity_slug": "ive",
        "display_name": "IVE",
        "release_title": "REVIVE+",
        "release_date": "2026-02-23",
        "stream": "album",
        "release_kind": "album",
        "release_format": "album",
        "match_reason": "release_title_exact",
        "matched_alias": "REVIVE+"
      }
    ],
    "upcoming": [
      {
        "upcoming_signal_id": "uuid",
        "entity_slug": "yena",
        "display_name": "YENA",
        "headline": "YENA confirms March comeback",
        "scheduled_date": "2026-03-11",
        "scheduled_month": "2026-03",
        "date_precision": "exact",
        "date_status": "confirmed",
        "release_format": "single album",
        "confidence_score": 0.93,
        "source_type": "news_rss",
        "source_url": "https://...",
        "evidence_summary": "YENA confirmed...",
        "match_reason": "entity_exact",
        "matched_alias": "최예나"
      }
    ]
  }
}
```

### 6.5 Server-side Rules

- alias normalization은 API가 책임진다
- client는 matched alias 계산을 재구현하지 않는다
- segmented empty state는 빈 배열로 표현한다
- exact `entity/alias` query는 companion `releases` / `upcoming` row를 같이 반환할 수 있다
- exact `release_title` 또는 exact upcoming `headline` query가 잡히면 owner entity card를 `entities`에 같이 포함한다
- 위 owner entity card는 `match_reason = partial`, `matched_alias = null`로 고정한다
- `next_upcoming.scheduled_month`는 `scheduled_date`가 exact date일 때도 항상 month label까지 채워 반환한다
- `next_upcoming.release_format`, `upcoming[].release_format`은 nullable metadata다. canonical upcoming signal에 값이 있으면 그대로 보존하고, 값이 없을 때 client가 별도 backfill 하지 않는다

## 7. `GET /v1/entities/:slug`

### 7.1 Purpose

- web team/entity detail
- mobile entity detail

### 7.2 Path Contract

- required path param: `slug`
- format: kebab-case stable identifier

### 7.3 Response Responsibility

- entity identity/meta
- official links and YouTube channel info
- tracking state
- next upcoming
- latest release
- recent albums
- optional source timeline support

### 7.4 Response Shape

```json
{
  "meta": {
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul",
    "entity_slug": "tomorrow-x-together"
  },
  "data": {
    "identity": {
      "entity_slug": "tomorrow-x-together",
      "display_name": "TOMORROW X TOGETHER",
      "canonical_name": "TOMORROW X TOGETHER",
      "entity_type": "group",
      "agency_name": "BIGHIT MUSIC",
      "debut_year": 2019,
      "badge_image_url": "https://...",
      "badge_source_url": "https://www.youtube.com/@TXT_bighit",
      "badge_source_label": "Official YouTube channel avatar",
      "badge_kind": "official_channel_avatar",
      "representative_image_url": "https://...",
      "representative_image_source": "artistProfiles.representative_image_url"
    },
    "official_links": {
      "youtube": "https://www.youtube.com/@TXT_bighit",
      "x": "https://x.com/TXT_bighit",
      "instagram": "https://instagram.com/txt_bighit"
    },
    "youtube_channels": {
      "primary_team_channel_url": "https://www.youtube.com/@TXT_bighit",
      "mv_allowlist_urls": [
        "https://www.youtube.com/@TXT_bighit",
        "https://www.youtube.com/@HYBELABELS"
      ]
    },
    "tracking_state": {
      "tier": "core",
      "watch_reason": "recent_release",
      "tracking_status": "recent_release"
    },
    "next_upcoming": {
      "upcoming_signal_id": "upcoming_txt_example",
      "headline": "TXT, 3월 12일 컴백 확정",
      "scheduled_date": "2026-03-12",
      "scheduled_month": "2026-03",
      "date_precision": "exact",
      "date_status": "confirmed",
      "release_format": "mini",
      "confidence_score": 0.91,
      "latest_seen_at": "2026-03-06T03:00:00Z",
      "source_type": "agency_notice",
      "source_url": "https://ibighit.com/txt/example",
      "source_domain": "ibighit.com",
      "evidence_summary": "BIGHIT MUSIC confirmed the March 12 comeback date.",
      "source_count": 2
    },
    "latest_release": {
      "release_id": "rel_txt_example",
      "release_title": "Example",
      "release_date": "2026-02-27",
      "stream": "album",
      "release_kind": "mini",
      "release_format": "mini",
      "artwork": {
        "cover_image_url": "https://cdn.example.com/txt-example-cover.jpg",
        "thumbnail_image_url": "https://cdn.example.com/txt-example-thumb.jpg",
        "artwork_source_type": "releaseArtwork.cover_image_url",
        "artwork_source_url": "https://artwork.example.com/txt-example",
        "is_placeholder": false
      }
    },
    "recent_albums": [
      {
        "release_id": "rel_txt_example",
        "release_title": "Example",
        "release_date": "2026-02-27",
        "stream": "album",
        "release_kind": "mini",
        "release_format": "mini",
        "artwork": {
          "cover_image_url": "https://cdn.example.com/txt-example-cover.jpg",
          "thumbnail_image_url": "https://cdn.example.com/txt-example-thumb.jpg",
          "artwork_source_type": "releaseArtwork.cover_image_url",
          "artwork_source_url": "https://artwork.example.com/txt-example",
          "is_placeholder": false
        }
      }
    ],
    "source_timeline": [
      {
        "event_type": "official_announcement",
        "headline": "TXT, 3월 12일 컴백 확정",
        "occurred_at": "2026-03-06T03:00:00Z",
        "summary": "mini · confirmed · 2026-03-12",
        "source_url": "https://ibighit.com/txt/example",
        "source_type": "agency_notice",
        "source_domain": "ibighit.com",
        "published_at": "2026-03-06T03:00:00Z",
        "scheduled_date": "2026-03-12",
        "scheduled_month": "2026-03",
        "date_precision": "exact",
        "date_status": "confirmed",
        "release_format": "mini",
        "confidence_score": 0.91,
        "evidence_summary": "BIGHIT MUSIC confirmed the March 12 comeback date.",
        "source_count": 2
      }
    ]
  }
}
```

### 7.5 Server-side Rules

- `next_upcoming`은 exact future date 우선이며 없으면 `null`
- `next_upcoming`은 mobile next-comeback card가 바로 렌더되도록 source/meta(`source_type`, `source_url`, `source_domain`, `evidence_summary`, `source_count`)를 포함한다
- official links는 deduped canonical URL만 준다
- latest release와 recent album card는 `release_format`과 nested `artwork` shape를 항상 포함한다
- recent album selection rule은 서버가 고정하며 `album` stream 기준 최신순 최대 `12`개다
- `source_timeline`를 shared contract로 유지하는 동안 item shape는 `event_type`, `occurred_at`, `summary`, source/date meta까지 포함한 구조로 고정한다

## 8. `GET /v1/releases/:id`

### 8.1 Purpose

- web release detail
- mobile release detail

### 8.2 Path Contract

- required path param: `id`
- format: stable release identifier

### 8.3 Transition Helper

lookup helper:

- `GET /v1/releases/lookup?entity_slug=...&title=...&date=...&stream=...`

용도:

- legacy JSON exact key에서 API `release_id`로 넘어가는 migration helper

lookup helper response:

```json
{
  "meta": {
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul",
    "lookup": {
      "entity_slug": "blackpink",
      "title": "DEADLINE",
      "date": "2026-02-27",
      "stream": "album"
    }
  },
  "data": {
    "release_id": "rel_blackpink_deadline_2026_02_27_album",
    "canonical_path": "/v1/releases/rel_blackpink_deadline_2026_02_27_album",
    "release": {
      "release_id": "rel_blackpink_deadline_2026_02_27_album",
      "entity_slug": "blackpink",
      "display_name": "BLACKPINK",
      "release_title": "DEADLINE",
      "release_date": "2026-02-27",
      "stream": "album",
      "release_kind": "mini"
    }
  }
}
```

### 8.4 Response Responsibility

- release meta
- artwork
- release-level service links
- tracks with `is_title_track`
- MV object with `url`, `video_id`, `status`, `provenance`
- optional credits / charts

### 8.5 Response Shape

```json
{
  "meta": {
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul",
    "release_id": "rel_blackpink_deadline_2026_02_27_album"
  },
  "data": {
    "release": {
      "release_id": "rel_blackpink_deadline_2026_02_27_album",
      "entity_slug": "blackpink",
      "display_name": "BLACKPINK",
      "release_title": "DEADLINE",
      "release_date": "2026-02-27",
      "stream": "album",
      "release_kind": "mini"
    },
    "artwork": {
      "cover_image_url": "https://..."
    },
    "service_links": {
      "spotify": {
        "url": "https://open.spotify.com/album/...",
        "status": "canonical"
      },
      "youtube_music": {
        "url": "https://music.youtube.com/browse/...",
        "status": "manual_override"
      }
    },
    "tracks": [
      {
        "track_id": "trk_blackpink_deadline_go_01",
        "order": 1,
        "title": "GO",
        "is_title_track": true,
        "spotify": null,
        "youtube_music": null
      }
    ],
    "mv": {
      "url": "https://www.youtube.com/watch?v=abc123xyz",
      "video_id": "abc123xyz",
      "status": "manual_override",
      "provenance": "official artist channel watch URL"
    },
    "credits": [],
    "charts": [],
    "notes": null
  }
}
```

### 8.6 Server-side Rules

- title-track tagging은 API가 final state만 내려준다
- MV object는 canonical / unresolved / needs_review 의미론을 그대로 노출한다
- client는 `watch`, `shorts`, `youtu.be` parser를 재구현하지 않는다

## 9. `GET /v1/radar`

### 9.1 Purpose

- web radar sections
- mobile radar tab

### 9.2 Response Responsibility

- featured upcoming
- weekly upcoming
- change feed
- long-gap
- rookie

### 9.3 Response Shape

```json
{
  "meta": {
    "generated_at": "2026-03-07T09:00:00Z",
    "timezone": "Asia/Seoul"
  },
  "data": {
    "featured_upcoming": null,
    "weekly_upcoming": [],
    "change_feed": [],
    "long_gap": [],
    "rookie": []
  }
}
```

### 9.4 Server-side Rules

- long-gap / rookie eligibility는 server-side policy를 따른다
- change feed는 projection diff 또는 equivalent read model을 사용한다

## 10. Internal / Review Endpoints

### 10.1 `GET /v1/review/upcoming`

대체 대상:

- `manual_review_queue.json`

필수 의미론:

- review reason
- recommended action
- evidence payload
- entity / upcoming linkage

응답 shape:

```json
{
  "meta": {
    "generated_at": "2026-03-07T12:00:00.000Z",
    "timezone": "Asia/Seoul",
    "total_items": 42
  },
  "data": {
    "items": [
      {
        "review_task": {
          "review_task_id": "uuid",
          "review_type": "upcoming_signal",
          "status": "open",
          "created_at": "2026-03-07T12:00:00.000Z"
        },
        "entity": {
          "entity_id": "uuid",
          "slug": "yena",
          "display_name": "YENA",
          "entity_type": "solo"
        },
        "upcoming_signal": {
          "upcoming_signal_id": "uuid",
          "headline": "YENA confirms March comeback",
          "scheduled_date": "2026-03-11",
          "scheduled_month": null,
          "date_precision": "exact",
          "date_status": "confirmed",
          "release_format": "single album",
          "confidence_score": 0.93,
          "tracking_status": "manual_watch",
          "is_active": true,
          "sources": []
        },
        "review_reason": ["inexact_date"],
        "recommended_action": "Keep the candidate in review until an exact date appears.",
        "evidence_payload": {}
      }
    ]
  }
}
```

### 10.2 `GET /v1/review/mv`

대체 대상:

- `mv_manual_review_queue.json`

필수 의미론:

- release linkage
- review reason
- allowlist hint
- candidate payload

응답 shape:

```json
{
  "meta": {
    "generated_at": "2026-03-07T12:00:00.000Z",
    "timezone": "Asia/Seoul",
    "total_items": 34
  },
  "data": {
    "items": [
      {
        "review_task": {
          "review_task_id": "uuid",
          "review_type": "mv_candidate",
          "status": "open",
          "created_at": "2026-03-07T12:00:00.000Z"
        },
        "entity": {
          "entity_id": "uuid",
          "slug": "qwer",
          "display_name": "QWER",
          "entity_type": "group"
        },
        "release": {
          "release_id": "uuid",
          "release_title": "흰수염고래",
          "release_date": "2025-10-06",
          "stream": "song",
          "release_kind": "single",
          "release_format": "digital single",
          "youtube_mv": {
            "url": null,
            "status": "needs_review",
            "provenance": null
          }
        },
        "review_reason": ["Official YouTube search currently surfaces a special clip instead of a clearly canonical MV object."],
        "recommended_action": "Review the suggested query against the allowlisted official channels and either add a manual override or keep the release in review.",
        "allowlist": {
          "official_youtube_url": "https://www.youtube.com/channel/...",
          "mv_allowlist_urls": ["https://www.youtube.com/channel/..."],
          "channels": []
        },
        "candidate_payload": {}
      }
    ]
  }
}
```

### 10.3 `GET /v1/entities/:slug/channels`

용도:

- channel / allowlist debug surface
- product main flow보다는 operator / debug support

응답 책임:

- canonical channel row visibility
- team-link primary channel summary
- MV allowlist URL summary

## 11. Freshness And Caching

| endpoint | cache guidance |
| --- | --- |
| calendar month | cacheable |
| entity detail | cacheable |
| release detail | cacheable |
| search | short TTL or no-store |
| review endpoints | fresher preference |

세부 원칙:

- `ETag` / `Last-Modified`는 payload semantics 고정 후 추가 가능
- search는 query volatility가 높아 aggressive caching을 피한다
- review endpoint는 operator freshness를 우선한다

## 12. Client-side Allowed Logic

client에 남겨도 되는 것:

- presentation-only sort toggle
- recent-search local persistence
- purely visual grouping

client에 남기면 안 되는 것:

- alias normalization
- latest release selection
- nearest upcoming selection
- exact vs month_only separation
- MV resolution status interpretation
- radar eligibility rules

## 13. Error Contract

v1 read endpoint는 아래 error shape를 따른다.

```json
{
  "meta": {
    "request_id": "uuid-or-trace-id",
    "timezone": "Asia/Seoul"
  },
  "error": {
    "code": "not_found",
    "message": "Release not found"
  }
}
```

최소 error code:

- `invalid_request`
- `not_found`
- `stale_projection`
- `internal_error`

## 14. Acceptance Checklist

- calendar/search/entity/release/radar 핵심 surface가 계약으로 정의된다
- web과 mobile이 같은 payload semantics를 읽을 수 있다
- exact vs month_only, title-track, MV state가 explicit하다
- client가 key business rule을 재구현하지 않아도 된다

## 15. References

- Canonical model: [canonical-backend-data-model.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/canonical-backend-data-model.md)
- Runtime baseline: [runtime-and-service-boundaries.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/runtime-and-service-boundaries.md)
- Rollout plan: [phased-rollout-plan.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/backend/phased-rollout-plan.md)
- Mobile route contract: [route-param-contracts.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/mobile/route-param-contracts.md)
- Mobile sample payloads: [sample-data-contracts.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/mobile/sample-data-contracts.md)
