# Analytics Event Spec

## 1. 목적
이 문서는 모바일 앱에서 수집할 가치가 있는 사용자 행동 이벤트를 정의한다.
v1 필수 구현은 아니지만, 제품 판단을 위해 어떤 이벤트를 남기면 좋은지 기준을 고정한다.

## 2. 원칙
- 개인 정보 수집보다 제품 사용 흐름 측정을 우선한다.
- 이벤트 이름은 동사 중심으로 통일한다.
- 화면 노출, 주요 CTA, 외부 handoff, 검색 행위를 우선 측정한다.

## 3. 공통 속성
- `screen_name`
- `team_slug?`
- `release_id?`
- `source_type?`
- `service_name?`
- `query?`
- `selected_date?`
- `current_month?`

## 4. 추천 이벤트

### 4.1 Screen Viewed
- `calendar_viewed`
- `radar_viewed`
- `search_viewed`
- `team_detail_viewed`
- `release_detail_viewed`

### 4.2 Calendar Interactions
- `calendar_month_changed`
- `calendar_day_selected`
- `calendar_list_mode_selected`
- `calendar_filter_applied`

### 4.3 Radar Interactions
- `radar_featured_opened`
- `radar_card_opened`
- `radar_filter_applied`

### 4.4 Search Interactions
- `search_query_submitted`
- `search_segment_changed`
- `search_result_opened`
- `search_recent_query_reused`

### 4.5 Team / Release Detail
- `team_detail_latest_release_opened`
- `team_detail_album_opened`
- `release_detail_track_service_opened`
- `release_detail_album_service_opened`
- `release_detail_mv_opened`

### 4.6 Source / External
- `source_link_opened`
- `service_handoff_opened`
- `service_handoff_failed`

## 5. 최소 해석 포인트
- 사용자는 캘린더와 레이더 중 어디를 더 자주 시작점으로 쓰는가
- 검색이 Team vs Release vs Upcoming 중 어느 쪽으로 많이 이어지는가
- 가장 많이 쓰는 handoff 서비스는 무엇인가
- Date Detail Sheet 이후 Team Detail vs 바로 handoff 중 어느 흐름이 많은가

## 6. 비범위
- 개인 추천 시스템용 과한 사용자 프로파일링
- 민감한 개인정보 추적
- 세션 리플레이 수준 분석
