# Data Binding Spec

## 1. 목적
이 문서는 모바일 UI와 현재 웹 데이터 산출물 사이의 계약을 정의한다.
핵심은 각 화면/컴포넌트가 어떤 JSON 필드를 읽고, 값이 없을 때 어떤 fallback을 쓰는지 명확히 하는 것이다.

## 2. 주요 데이터 소스
1. `releases.json`
2. `watchlist.json`
3. `upcomingCandidates.json`
4. `artistProfiles.json`
5. `releaseArtwork.json`
6. `releaseDetails.json`

## 3. 공통 파생 모델

### 3.1 TeamSummaryModel
필수 필드:
- `group`
- `display_name`
- `badge_image_url?`
- `representative_image_url?`
- `agency?`
- `official_youtube_url?`
- `official_x_url?`
- `official_instagram_url?`

### 3.2 ReleaseSummaryModel
필수 필드:
- `group`
- `release_title`
- `release_date`
- `release_kind?`
- `latest_song?`
- `latest_album?`
- `spotify_url?`
- `youtube_music_url?`
- `youtube_mv_url?`

### 3.3 UpcomingEventModel
필수 필드:
- `group`
- `scheduled_date?`
- `date_status?`
- `headline`
- `source_type`
- `source_url?`
- `confidence?`
- `release_label?`

### 3.4 ReleaseDetailModel
필수 필드:
- `group`
- `release_title`
- `release_date`
- `tracks[]`
- `youtube_video_id?`
- `youtube_video_url?`
- `notes?`
- `credits?`

## 4. 공통 매핑 규칙

### 4.1 팀명 표시
우선순위:
1. `artistProfiles.display_name`
2. `group`

### 4.2 팀 배지
우선순위:
1. `artistProfiles.badge_image_url`
2. `artistProfiles.representative_image_url`
3. monogram fallback

### 4.3 팀 대표 이미지
우선순위:
1. `artistProfiles.representative_image_url`
2. placeholder

### 4.4 팀 공식 링크
- YouTube: `official_youtube_url`
- X: `official_x_url`
- Instagram: `official_instagram_url`
- 없으면 해당 버튼 숨김

### 4.5 릴리즈 커버
우선순위:
1. `releaseArtwork.image_url` 또는 equivalent field
2. placeholder asset

### 4.6 릴리즈 상세
우선순위:
1. `releaseDetails` exact match
2. fallback generated detail
3. 최소 메타만 표시

## 5. 화면별 바인딩

### 5.1 Calendar Screen
- 월간 발매 수: `releases.json` month filter
- 예정 컴백 수: `upcomingCandidates.json` month filter
- 가장 가까운 일정: month context 내 earliest upcoming
- 날짜 셀 배지: releases/upcoming grouped by day
- Date Detail Verified row: ReleaseSummaryModel 파생
- Date Detail Scheduled row: UpcomingEventModel 파생

### 5.2 Radar Screen
- Featured Comeback: exact/future date 중 earliest upcoming
- Weekly Events: 현재 주 범위 필터된 upcoming
- Change Feed: future `change-tracked` data or derived diff feed
- Long-gap: `watchlist.json` + latest release recency
- Rookie: `artistProfiles.debut_year` 또는 manual rookie tags

### 5.3 Search Screen
- Team Results: `artistProfiles.json` + derived search index
- Release Results: `releases.json`
- Upcoming Results: `upcomingCandidates.json`
- Normalization: shared search utility
- Recent Searches: local persistence or in-memory session store

### 5.4 Team Detail Screen
- 헤더: `artistProfiles.json`
- 다음 컴백: group 기준 earliest upcoming
- 최신 발매: `releases.json` 또는 `watchlist.json` 기반 latest release
- 최근 앨범: group releases filtered by album stream
- 커버: `releaseArtwork.json`

### 5.5 Release Detail Screen
- 릴리즈 메타: `releaseDetails.json`
- 커버: `releaseArtwork.json`
- 트랙 리스트: `releaseDetails.tracks`
- MV: `releaseDetails.youtube_video_id` 또는 `releaseDetails.youtube_video_url`

## 6. Derived Rules

### 6.1 Latest Release Selection
- `latest_song`과 `latest_album`을 별도 유지한다.
- Team Detail의 최신 발매 카드에서는 더 최근 날짜를 가진 stream을 우선한다.
- 두 stream이 모두 존재하면 UI는 stream type을 표시할 수 있어야 한다.

### 6.2 Nearest Comeback Selection
- exact future date를 가진 upcoming 중 가장 빠른 항목 선택
- exact date가 없으면 Featured 후보에서 제외하고 일반 예정 항목으로만 유지

### 6.3 Search Index Construction
- source fields:
  - `display_name`
  - `aliases`
  - `search_aliases`
  - `release_title`
  - `latest_song.title`
  - `latest_album.title`
  - `headline`
- normalization:
  - lower-case
  - whitespace collapse/remove
  - special-char strip
  - `X/x/×` normalize

## 7. 필드 누락 시 fallback

### 7.1 예정명 없음
- `headline` 요약 사용

### 7.2 confidence 없음
- confidence chip 숨김

### 7.3 representative image 없음
- team placeholder 사용

### 7.4 cover 없음
- release placeholder 사용

### 7.5 대표곡 없음
- 필드 숨김

### 7.6 트랙 링크 없음
- `group + track title` 검색 fallback 생성

### 7.7 앨범 링크 없음
- `group + release_title` 검색 fallback 생성

### 7.8 MV 없음
- MV 블록 숨김

## 8. Exact Match Key 원칙
릴리즈 상세/아트워크 lookup key는 아래 요소 조합 기준을 유지한다.
- `group`
- `release_title`
- `release_date`
- `stream`
- 필요 시 `release_kind` 보조 사용

## 9. 구현 메모
- UI 구현자는 raw JSON을 직접 여기저기 읽지 않고, 화면별 selector/adapter를 통해 파생 모델을 만든다.
- 각 selector는 fallback을 포함한 최종 표시 모델을 반환해야 한다.
- alias 검색, latest release selection, nearest upcoming selection은 화면마다 중복 구현하면 안 된다.

## 10. 수용 기준
- 각 화면의 필수 데이터와 fallback 우선순위가 문서화되어야 한다.
- 구현자가 JSON 필드와 UI 컴포넌트 사이의 매핑을 추정하지 않아도 된다.
- 같은 데이터 파생 규칙이 화면마다 다르게 구현되면 안 된다.

## 11. 참조 예시
- 실제 payload 형상 예시는 `sample-data-contracts.md`를 따른다.
- selector 구현 시 이 예시의 nullable field와 fallback 사례를 함께 고려한다.

## 9. 콘텐츠 운영 참조
- profile/artwork/detail/upcoming 운영 기준은 `content-governance-spec.md`를 따른다.
- freshness/partial-data 기준은 `data-sync-freshness-spec.md`를 따른다.
