# Mobile Adoption Readiness Review

## 1. 목적

- backend shared read contract가 future mobile surface를 client-side business-logic 재구성 없이 감당할 수 있는지 검증한다.
- 검증 대상 surface는 `calendar`, `search`, `entity detail`, `release detail`, `radar`다.
- readiness 판정은 문서만이 아니라 현재 구현과 drift report까지 함께 본다.

## 2. 검토 기준

`docs/specs/backend/shared-read-api-contracts.md`의 `Client-side Allowed Logic` 기준을 그대로 적용한다.

mobile가 아래를 다시 계산하거나 조합해야 하면 readiness fail로 본다.

- alias normalization
- latest release selection
- nearest upcoming selection
- exact vs `month_only` separation
- MV resolution status interpretation
- radar eligibility rules

또한 각 surface는 아래를 만족해야 pass로 본다.

- screen spec에서 요구하는 primary/meta action에 필요한 필드가 backend response에 있다.
- item shape가 문서에 명시돼 있고 구현도 그 shape를 따른다.
- representative shadow/parity evidence가 clean이거나, 최소한 mobile 구현을 막는 drift가 없다.

## 3. 검토 입력

- backend contract:
  - `docs/specs/backend/shared-read-api-contracts.md`
  - `docs/specs/backend/canonical-backend-data-model.md`
  - `docs/specs/backend/phased-rollout-plan.md`
- mobile spec:
  - `docs/specs/mobile/master-spec.md`
  - `docs/specs/mobile/calendar-screen.md`
  - `docs/specs/mobile/search-screen.md`
  - `docs/specs/mobile/team-detail-screen.md`
  - `docs/specs/mobile/release-detail-screen.md`
  - `docs/specs/mobile/radar-screen.md`
  - `docs/specs/mobile/data-binding-spec.md`
  - `docs/specs/mobile/route-param-contracts.md`
- runtime evidence:
  - `backend/reports/backend_json_parity_report.json`
  - `backend/reports/backend_shadow_read_report.json`

## 4. 결론

현 시점 판정은 `부분 준비 완료 / full mobile implementation start는 보류`다.

- `release detail`은 v1 mobile 구현을 시작해도 된다.
- `calendar`, `radar`는 아직 blocker가 남아 있어 mobile screen implementation start gate를 통과하지 못했다.
- 따라서 mobile 쪽에서는 scaffold, router, theme, selector, release-detail slice 같은 비차단 작업은 계속 진행할 수 있지만, 주요 surface 구현 시작 선언은 아래 follow-up issue가 닫힌 뒤로 미루는 것이 맞다.

## 5. Surface Matrix

| Surface | Backend Contract | Mobile Spec | 판정 | 핵심 이유 | Follow-up |
|---|---|---|---|---|---|
| Calendar | `GET /v1/calendar/month` | `calendar-screen.md` | Blocked | date-detail/action에 필요한 row completeness와 `scheduled_month` 의미론이 아직 불안정 | [#276](https://github.com/iAmSomething/idol-song-app/issues/276) |
| Search | `GET /v1/search` | `search-screen.md` | Ready | release-title/headline exact query에도 owner entity row가 포함되고, upcoming summary completeness가 contract 기준으로 고정됨 | none |
| Entity Detail | `GET /v1/entities/:slug` | `team-detail-screen.md` | Ready | `next_upcoming`, `latest_release`, `recent_albums`, `source_timeline` shape가 mobile team detail 기준으로 고정됨 | none |
| Release Detail | `GET /v1/releases/:id` | `release-detail-screen.md` | Ready | release meta, artwork, service links, tracks, MV state/provenance가 mobile 요구를 이미 충족 | none |
| Radar | `GET /v1/radar` | `radar-screen.md` | Blocked | typed section contract보다 raw projection passthrough가 강하고 section semantics drift가 남음 | [#279](https://github.com/iAmSomething/idol-song-app/issues/279) |

## 6. Surface Review

### 6.1 Calendar

판정: `Ready`

mobile calendar가 요구하는 것:

- day cell에는 exact upcoming만 들어가야 한다.
- `month_only`는 month bucket으로 분리돼야 한다.
- date detail sheet와 monthly list row는 action-ready payload를 가져야 한다.
- scheduled row는 기사/공식 공지 meta link를 가져야 한다.

현재 확인된 문제:

- shared contract는 `verified_list`와 `scheduled_list`가 존재한다고만 쓰고, item shape를 충분히 고정하지 않았다.
- mobile spec의 scheduled row action은 source link를 요구하지만, current `CalendarUpcomingItem` runtime shape에는 `source_url`, `source_type`, `evidence_summary`가 없다.
- shadow report에서 `2026-03`, `2026-04`, `2025-10` 모두 summary/day/list drift가 남아 있다.
- `scheduled_month`가 일부 비교 경로에서는 `YYYY-MM`이 아니라 비어 있거나 `YYYY-MM-01`로 내려와 month-only display 규칙이 흔들린다.

따라서 mobile client는 현재 상태로는 scheduled meta action과 month-only display semantics를 다시 조합해야 한다.

blocker issue:

- [#276](https://github.com/iAmSomething/idol-song-app/issues/276)

### 6.2 Search

판정: `Blocked`

mobile search가 요구하는 것:

- alias normalization과 ranking은 backend가 책임져야 한다.
- search target에는 팀명, alias, 최신 곡/앨범명, 예정 headline이 포함된다.
- segmented result는 `entities`, `releases`, `upcoming`만으로 충분해야 한다.

현재 상태:

- `REVIVE+`, `흰수염고래` 같은 exact release-title query도 owner entity row가 함께 내려와서 mobile이 entity card를 자체 합성할 필요가 없다.
- `투바투`, `최예나` 케이스에서 `next_upcoming.scheduled_month`, `next_upcoming.release_format`, `upcoming[].scheduled_month` completeness가 contract 기준으로 고정됐다.
- search shadow representative case가 clean 기준으로 다시 통과해 client-side patching 필요가 없어졌다.

### 6.3 Entity Detail

판정: `Ready`

mobile team detail이 요구하는 것:

- `다음 컴백` 카드에 날짜/D-day, 상태, 출처, confidence가 있어야 한다.
- `최신 발매` 카드에 cover, release meta, action 진입점이 있어야 한다.
- `최근 앨범 캐러셀`은 cover와 release summary만으로 바로 렌더돼야 한다.

현재 상태:

- `next_upcoming`가 source/meta action(`source_type`, `source_url`, `source_domain`, `evidence_summary`, `source_count`)을 포함한다.
- `latest_release`와 `recent_albums`는 `release_format + artwork`를 가진 card payload로 고정됐다.
- `source_timeline`도 `event_type`, `occurred_at`, `summary`를 포함한 shared item shape로 고정됐다.
- representative shadow coverage도 `yena`, `blackpink`, `and-team`, `allday-project` 기준으로 clean까지 확인했다.

따라서 mobile team detail은 이제 client-side selector reconstruction 없이 backend contract를 직접 소비해도 된다.

### 6.4 Release Detail

판정: `Ready`

release detail은 mobile 요구사항을 이미 거의 충족한다.

- release meta
- artwork
- release-level service links
- tracks with `is_title_track`
- MV object with `url`, `video_id`, `status`, `provenance`
- optional `credits`, `charts`, `notes`

이 screen에서 중요한 server-owned semantics:

- title-track / double-title tagging
- MV canonical / unresolved / needs_review state
- release service-link status

위 세 가지가 이미 backend contract 안에 들어 있고, mobile screen도 이 상태를 그대로 소비하면 된다.

non-blocking note:

- mobile route param doc example은 slug-like id 예시를 아직 들고 있는데, backend contract는 stable `release_id` + lookup helper를 기준으로 움직인다.
- 이건 implementation blocker보다는 doc alignment 성격이다.

### 6.5 Radar

판정: `Blocked`

mobile radar가 요구하는 것:

- `featured_upcoming`
- `weekly_upcoming`
- `change_feed`
- `long_gap`
- `rookie`

각 섹션이 typed payload와 server-owned eligibility를 가져야 한다.

현재 확인된 문제:

- shared contract는 section 이름만 고정했고 item shape를 충분히 풀어 쓰지 않았다.
- runtime route는 raw projection record passthrough에 가깝다.
- shadow report에서 `weekly_upcoming`, `change_feed`, `long_gap` 의미론 drift가 남아 있다.
- 이 상태면 client가 “이번 주 예정”과 “변경 feed”의 경계를 다시 해석하거나, long-gap/rookie 카드를 section별로 다르게 보정하게 된다.

blocker issue:

- [#279](https://github.com/iAmSomething/idol-song-app/issues/279)

## 7. Remaining Ambiguities That Are Not Release-blocking

- mobile `release detail` route param example은 backend `release_id`/lookup helper 기준으로 한 번 더 맞춰야 한다.
- official link trailing slash 차이와 `artist_source_url` 같은 extra field는 shared contract sufficiency를 막는 핵심 blocker는 아니다.
- current backend/json parity report의 latest-release stream mismatch 3건은 search/entity detail surface 품질에는 영향을 주지만, contract class 전체를 뒤집는 blocker라기보다는 기존 parity stabilization backlog에 가깝다.

## 8. Start / Wait Recommendation

지금 바로 시작해도 되는 것:

- mobile scaffold / router / theme / selector layer
- release-detail API consumption
- non-domain presentation work

지금은 보류해야 하는 것:

- calendar screen implementation
- search screen implementation
- radar screen implementation

보류 해제 조건:

- [#276](https://github.com/iAmSomething/idol-song-app/issues/276)
- [#278](https://github.com/iAmSomething/idol-song-app/issues/278)
- [#279](https://github.com/iAmSomething/idol-song-app/issues/279)

## 9. Acceptance Checklist

- [x] 각 major mobile surface를 backend contract 기준으로 점검했다.
- [x] client-side duplicated logic risk를 명시적으로 판정했다.
- [x] blocker를 actionable follow-up issue로 분리했다.
- [x] mobile implementation start 여부에 대해 grounded recommendation을 남겼다.
