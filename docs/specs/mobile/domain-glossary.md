# Domain Glossary

## 1. 목적
이 문서는 모바일/웹 전반에서 사용하는 도메인 용어를 고정한다.
기획, 데이터, 개발, QA가 서로 다른 단어를 같은 의미로 쓰거나, 같은 단어를 다른 의미로 쓰는 문제를 막는다.

## 2. 핵심 용어

### 2.1 Team
- 서비스에서 추적하는 그룹/솔로/유닛/프로젝트 단위
- UI에서는 장르 판정 라벨 없이 동일한 추적 단위로 취급한다.

### 2.2 Artist Profile
- 팀을 대표하는 메타데이터 묶음
- display name, agency, 공식 링크, 대표 이미지, 배지, alias 등을 포함한다.

### 2.3 Release
- 이미 발매된 음원/앨범 단위
- single, mini, album, ep, ost, collab 등으로 분류될 수 있다.

### 2.4 Latest Song
- 팀 기준 최신 곡 stream
- `latest_album`과 별개로 관리한다.

### 2.5 Latest Album
- 팀 기준 최신 앨범/릴리즈 stream
- `latest_song`과 독립적으로 관리한다.

### 2.6 Release Detail
- 특정 release에 대한 상세 메타
- track list, album-level links, MV, notes, credits 등을 포함한다.

### 2.7 Upcoming Event
- 미래 시점의 컴백/발매 관련 예정 정보
- 기사, 공식 공지, Weverse 등에서 파생된다.

### 2.8 Source
- 예정 또는 발매 정보의 근거 링크/원문
- `agency_notice`, `weverse_notice`, `official_social`, `news_rss` 같은 source type을 가진다.

### 2.9 Confidence
- 예정 정보에 대한 신뢰도 요약
- low / medium / high 정도로 표현한다.

### 2.10 Date Precision
- 예정 시점의 정밀도
- `exact`, `month_only`, `unknown` 중 하나로 표현한다.
- `scheduled_date`는 `exact`일 때만 day-level ISO date를 가진다.
- `scheduled_month`는 `exact` 또는 `month_only`일 때 month context(`YYYY-MM`)를 가진다.

### 2.11 Date Status
- 예정 정보의 상태/톤
- `confirmed`, `scheduled`, `rumor`처럼 정밀도와 별개로 관리한다.

### 2.12 Handoff
- 앱에서 Spotify, YouTube Music, YouTube MV 또는 source 원문으로 외부 이동하는 행위

### 2.13 Service Action
- Spotify, YouTube Music, YouTube MV로 이동하는 CTA

### 2.14 Meta Action
- 기사 원문, 공식 공지, 소스 보기처럼 근거 확인용 CTA

### 2.15 Primary Action
- 팀 페이지 진입, 릴리즈 상세 보기처럼 다음 맥락으로 들어가는 핵심 CTA

### 2.16 Chip
- 상태/형식/타이틀 여부 같은 정보성 라벨
- 액션이 아니다.

### 2.17 Date Detail Sheet
- 캘린더 날짜 탭 시 열리는 bottom sheet drill-in

### 2.18 Radar
- 다가오는 컴백, 일정 변경, 장기 공백, 루키 같은 탐지 중심 요약 화면

### 2.19 Long-gap Team
- 마지막 verified release 이후 장기 공백 상태로 보는 팀
- 기준 일수는 운영 정책에서 정의한다.

### 2.20 Rookie
- 데뷔 연도 또는 수동 seed 기준으로 rookie로 분류된 팀

### 2.21 Search Alias
- 공식명 외 별칭/약칭/한글명 검색을 위해 유지하는 검색 전용 alias
