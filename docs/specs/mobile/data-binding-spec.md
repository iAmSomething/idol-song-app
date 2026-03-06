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

## 3. 공통 매핑 규칙

### 3.1 팀명 표시
우선순위:
1. `artistProfiles.display_name`
2. `group`

### 3.2 팀 대표 이미지
우선순위:
1. `artistProfiles.representative_image_url`
2. placeholder

### 3.3 팀 공식 링크
- YouTube: `official_youtube_url`
- X: `official_x_url`
- Instagram: `official_instagram_url`
- 없으면 해당 버튼 숨김

### 3.4 릴리즈 커버
우선순위:
1. `releaseArtwork.image_url` 또는 equivalent field
2. placeholder asset

### 3.5 릴리즈 상세
우선순위:
1. `releaseDetails` exact match
2. fallback generated detail
3. 최소 메타만 표시

## 4. 화면별 주요 바인딩

### 4.1 Calendar Screen
- 월간 발매 수: `releases.json` filtered by month
- 예정 컴백 수: `upcomingCandidates.json` filtered by month
- 가장 가까운 일정: month context 내 earliest upcoming
- 날짜 셀 배지: releases/upcoming grouped by day

### 4.2 Radar Screen
- 가장 가까운 컴백: upcoming sorted ascending
- 일정 변경: future `change-tracked` data or derived upcoming change feed
- 장기 공백 레이더: watchlist + release recency
- 루키 레이더: artist profile debut year or manual seed tags

### 4.3 Search Screen
- team results: `artistProfiles` + derived team model
- release results: `releases`
- upcoming results: `upcomingCandidates`
- normalization: shared search utility

### 4.4 Team Detail
- 헤더: `artistProfiles`
- 다음 컴백: earliest upcoming by group
- 최신 발매: derived latest release from releases/watchlist
- 최근 앨범: filtered group releases + artwork

### 4.5 Release Detail
- 릴리즈 메타: `releaseDetails`
- 커버: `releaseArtwork`
- 트랙 리스트: `releaseDetails.tracks`
- MV: `releaseDetails.youtube_video_id`

## 5. 필드 누락 시 fallback

### 5.1 예정명 없음
- `headline` 요약 사용

### 5.2 confidence 없음
- 뱃지 숨김

### 5.3 대표곡 없음
- 필드 숨김

### 5.4 트랙 링크 없음
- `group + track title` 검색 fallback 생성

### 5.5 앨범 링크 없음
- `group + release_title` 검색 fallback 생성

## 6. Exact Match Key 원칙
릴리즈 상세/아트워크 lookup key는 아래 요소 조합 기준을 유지한다.
- group
- release_title
- release_date
- stream
필요 시 `release_kind` 보조 사용

## 7. 수용 기준
- 각 화면의 필수 데이터와 fallback 우선순위가 문서화되어야 한다.
- 구현자가 JSON 필드와 UI 컴포넌트 사이의 매핑을 추정하지 않아도 된다.
