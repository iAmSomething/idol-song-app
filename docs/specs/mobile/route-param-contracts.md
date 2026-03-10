# Route and Parameter Contracts

## 1. 목적
이 문서는 Expo Router 기준 화면 경로, route param, deep-link 진입 규칙을 정의한다.
화면 이동은 UI 이벤트뿐 아니라 복귀/공유/외부 진입까지 고려해야 하므로, 문자열 path와 파라미터 계약을 먼저 고정한다.

## 2. 기본 원칙
- route param은 화면 식별 최소 키만 가진다.
- display copy를 route param으로 넘기지 않는다.
- raw JSON blob를 navigation param으로 넘기지 않는다.
- 화면은 param을 selector key로만 사용하고, 데이터는 store/adapter에서 재구성한다.

## 3. 경로 목록
### 3.1 Tabs
- `/(tabs)/calendar`
- `/(tabs)/radar`
- `/(tabs)/search`

### 3.2 Stack screens
- `/artists/[slug]`
- `/releases/[id]`

### 3.3 Modal or sheet entry points
- 날짜 상세, 필터, 언어/설정은 dedicated route보다 in-screen sheet state를 우선한다.
- v1에서는 URL 기반 sheet deep-link를 강제하지 않는다.

## 4. Param 계약
### 4.1 Artist detail
Path: `/artists/[slug]`
- required: `slug`
- format: kebab-case string
- example: `tomorrow-x-together`

### 4.2 Release detail
Path: `/releases/[id]`
- required: `id`
- format: stable release identifier
- example: `blackpink-deadline-2026-02-27`

### 4.3 Calendar month state
- 기본 진입 경로는 `/(tabs)/calendar`다.
- state restoration용 optional query param:
  - `month=2026-04`
  - `date=2026-04-18`
  - `filter=all|releases|upcoming`
  - `sheet=open`
- `sheet=open`은 valid `date`가 있을 때만 유효하다.
- invalid month/date/filter는 안전하게 무시하고 현재 월 기본 상태로 복구한다.

### 4.4 Search state
- 기본 진입 경로는 `/(tabs)/search`다.
- state restoration용 optional query param:
  - `q=투바투`
  - `segment=entities|releases|upcoming`
- `segment`는 non-empty `q`가 있을 때만 적용한다.

### 4.5 Radar state
- 기본 진입 경로는 `/(tabs)/radar`다.
- state restoration용 optional query param:
  - `status=all|scheduled|confirmed|changed`
  - `actType=all|group|solo|unit`
  - `sections=weekly,change,longGap,rookie`
- filter sheet open state 자체는 route param으로 강제하지 않는다.
- invalid status/actType/sections 값은 무시하고 안전한 기본 상태로 복구한다.

## 5. Param validation
- missing slug/id는 screen crash 원인이 되어서는 안 된다.
- invalid slug/id는 error state 또는 safe fallback navigation으로 처리한다.
- selector가 데이터를 찾지 못하면 404-style empty/error state를 보여준다.

## 6. Deep-link 정책
- internal deep-link는 team detail, release detail, tab restoration query까지 지원한다.
- calendar date-detail sheet는 dedicated route 대신 tab query state 복원으로만 다룬다.
- external handoff 복귀 시 기존 route stack을 유지해야 한다.

## 7. Back behavior
- `/artists/[slug]`에서 back 시 이전 탭과 scroll context로 돌아가야 한다.
- `/releases/[id]`에서 back 시 Team Detail 또는 이전 화면 맥락을 우선 복원한다.
- invalid direct entry는 back보다 close/fallback CTA가 더 적합할 수 있다.

## 8. QA 체크포인트
- slug/id 누락 또는 오타에서 crash가 없어야 한다.
- deep-link direct open 후 back/close가 예측 가능해야 한다.
- 동일 release/team로 여러 진입 경로에서 route 계약이 일치해야 한다.
