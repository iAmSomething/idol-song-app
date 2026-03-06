# Testing Strategy Spec

## 1. 목적
이 문서는 모바일 앱 구현 시 어떤 레벨에서 무엇을 검증할지 정의한다.
정적 문서 구현물이라도 최소 단위 테스트와 화면 smoke 테스트가 필요하다.

## 2. 테스트 레벨

### 2.1 Unit Tests
대상:
- selector
- adapter
- search normalization
- nearest comeback selection
- latest release selection
- fallback URL builder

### 2.2 Component Tests
대상:
- ServiceButton
- ServiceButtonGroup
- DayCell
- ReleaseSummaryRow
- UpcomingEventRow
- TrackRow
- DateDetailSheet

### 2.3 Screen Smoke Tests
대상:
- Calendar
- Search
- Team Detail
- Release Detail
- Radar

### 2.4 Manual/QA Tests
대상:
- 외부 앱 handoff
- bottom sheet gesture
- Dynamic Type
- VoiceOver/TalkBack
- real device navigation

## 3. 권장 검증 범위

### 3.1 Unit
- 입력 raw JSON -> derived model
- null field -> fallback
- alias query -> expected results

### 3.2 Component
- 버튼 라벨
- disabled state
- chip/button 혼동 없음
- row action order

### 3.3 Screen Smoke
- screen render without crash
- main CTA visible
- primary navigation works
- empty state visible when data empty

## 4. 테스트 데이터 전략
- `sample-data-contracts.md` 기반 fixture 사용
- edge-case fixture 별도 유지
  - missing cover
  - missing links
  - no upcoming
  - double title
  - duplicate upcoming articles

## 5. 최소 합격선
- selector unit tests 통과
- key shared component tests 통과
- screen smoke 통과
- manual QA checklist 통과

## 6. 릴리즈 전 필수 확인
- iOS device handoff
- Android device handoff
- bottom sheet close/open gesture
- search alias regression
- Team Detail -> Release Detail -> Back scroll restoration
