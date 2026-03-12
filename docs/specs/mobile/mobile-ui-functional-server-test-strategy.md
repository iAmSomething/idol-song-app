# Mobile UI, Functional, and Server Communication Test Strategy

## 1. 목적
- iOS와 Android preview/production 런타임이 같은 사용자 기능을 안전하게 제공하는지 검증한다.
- mobile app이 backend API를 정본으로 읽는 현재 구조에서, UI 회귀와 server communication 회귀를 같은 전략 아래 묶는다.
- 테스트 실행 경로를 문서, 로컬 실행, CI에서 동일하게 유지한다.

## 2. 범위
- Platforms:
  - iOS app
  - Android app
- Runtime surfaces:
  - Calendar
  - Search
  - Radar
  - Entity detail
  - Release detail
- Shared infrastructure:
  - runtime config
  - backend read client
  - screen cache / degraded state
  - selector/display adapter

## 3. 테스트 계층

### 3.1 UI primitives
- 목적: 공용 컴포넌트의 시각/상태/접근성 회귀를 막는다.
- 대표 파일:
  - `mobile/src/components/calendar/DayCell.test.tsx`
  - `mobile/src/components/calendar/DateDetailSheet.test.tsx`
  - `mobile/src/components/layout/BottomSheetFrame.test.tsx`
  - `mobile/src/components/layout/SummaryStrip.test.tsx`
  - `mobile/src/components/feedback/FeedbackState.test.tsx`
  - `mobile/src/components/actions/ServiceButton.test.tsx`
  - `mobile/src/components/actions/ServiceButtonGroup.test.tsx`
  - `mobile/src/components/identity/TeamIdentityRow.test.tsx`
  - `mobile/src/components/release/TrackRow.test.tsx`
  - `mobile/src/components/surfaces/SurfacePrimitives.test.tsx`
- 실행:
  - `cd mobile && npm run test:qa:ui`

### 3.2 Functional surface flows
- 목적: 사용자가 실제로 밟는 화면 흐름과 상태 전이를 검증한다.
- 대표 파일:
  - `mobile/src/features/calendarControls.test.tsx`
  - `mobile/src/features/calendarBottomSheet.test.tsx`
  - `mobile/src/features/searchTab.test.tsx`
  - `mobile/src/features/searchTabLoading.test.tsx`
  - `mobile/src/features/radarTab.test.tsx`
  - `mobile/src/features/entityDetailScreen.test.tsx`
  - `mobile/src/features/releaseDetailScreen.test.tsx`
  - `mobile/src/features/route-shell.smoke.test.tsx`
- 커버 포인트:
  - 검색 입력 / debounce / route sync
  - detail push / back-safe render
  - bottom sheet drill-in
  - handoff action visibility
  - explicit error / retry state
- 실행:
  - `cd mobile && npm run test:qa:functional`

### 3.3 Server communication and contract
- 목적: backend API 계약이 calendar/search/radar/entity/release detail 전체에서 깨지지 않는지 본다.
- 대표 파일:
  - `mobile/src/config/runtime.test.ts`
  - `mobile/src/services/backendReadClient.test.ts`
  - `mobile/src/services/backendDisplayAdapters.test.ts`
  - `mobile/src/services/datasetFailurePolicy.test.ts`
  - `mobile/src/services/screenSnapshotCache.test.ts`
  - `mobile/src/features/useActiveDatasetScreen.test.tsx`
  - `mobile/src/selectors/index.test.ts`
  - `mobile/src/selectors/specParity.test.ts`
- 커버 포인트:
  - backend API path/param contract
  - retry / timeout / typed error
  - cache reuse / degraded state
  - bundled fixture와 backend payload의 display parity
  - exact upcoming vs month-only 분리
- 실행:
  - `cd mobile && npm run test:qa:server`

### 3.4 Platform sanity
- 목적: 같은 JS bundle이 iOS/Android 둘 다에서 preview runtime 구성으로 export 가능한지 확인한다.
- 실행:
  - `cd mobile && npm run verify:qa:platforms`
- 커버 포인트:
  - `config:preview`
  - `config:production`
  - Expo export for iOS
  - Expo export for Android

## 4. 실행 순서
1. `cd mobile && npm run test:qa:ui`
2. `cd mobile && npm run test:qa:functional`
3. `cd mobile && npm run test:qa:server`
4. `cd mobile && npm run typecheck`
5. `cd mobile && npm run lint`
6. `cd mobile && npm run verify:qa:platforms`

단일 엔트리포인트:
- `cd mobile && npm run verify:qa:full`

## 5. CI 원칙
- mobile CI는 generic `npm run test` 대신 위 묶음 스위트를 순서대로 실행한다.
- 실패 메시지는 어느 계층(UI / functional / server / platform)에서 깨졌는지 바로 보여줘야 한다.
- runtime policy guard는 계속 별도 gate로 유지한다.

## 6. 수동 QA와의 관계
- 이 문서는 자동 테스트 전략이다.
- 실제 기기 handoff, VoiceOver, TalkBack, large-text, gesture feel은 기존 runtime/device QA 문서에서 별도로 유지한다.
- 자동 테스트가 통과해도 device QA evidence가 필요한 릴리즈 게이트는 별도로 남는다.

## 7. 릴리즈 day 회귀 체크
- exact-date release가 verified row로 승격되면 mobile surface도 다음 조건을 만족해야 한다.
  - calendar verified list 반영
  - search release result 반영
  - entity detail latest release 반영
  - stale upcoming suppress
  - release detail route 조회 가능
- 같은 회귀는 backend route contract, web runtime, same-day acceptance와 함께 묶어서 본다.
