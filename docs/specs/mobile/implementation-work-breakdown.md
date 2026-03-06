# Implementation Work Breakdown

## 1. 목적
이 문서는 모바일 앱을 실제 개발 작업으로 분해한다.
구현자는 이 문서를 기준으로 에픽, 모듈, 컴포넌트, selector, 화면 작업을 순차적으로 진행할 수 있어야 한다.

## 2. 권장 저장소 구조
```text
mobile/
  app/
    (tabs)/
      calendar.tsx
      radar.tsx
      search.tsx
    artists/[slug].tsx
    releases/[id].tsx
  src/
    components/
      app-bar/
      buttons/
      cards/
      chips/
      rows/
      sheets/
    features/
      calendar/
      radar/
      search/
      artist/
      release/
    selectors/
    services/
    tokens/
    types/
    utils/
```

## 3. 선행 구현 순서
1. Token / Theme layer
2. Navigation shell
3. Shared selectors and adapters
4. Shared components
5. Calendar screen
6. Team Detail
7. Release Detail
8. Search screen
9. Radar screen
10. QA and polish

## 4. Module Breakdown

### 4.1 tokens/
- design token constants
- semantic color mapping
- spacing/radius/type scale

### 4.2 types/
- TeamSummaryModel
- ReleaseSummaryModel
- UpcomingEventModel
- ReleaseDetailModel

### 4.3 selectors/
- `selectMonthReleases`
- `selectMonthUpcoming`
- `selectNearestComeback`
- `selectTeamDetail`
- `selectReleaseDetail`
- `selectSearchResults`

### 4.4 services/
- external handoff builder
- search fallback URL builder
- source classifier helper

### 4.5 components/
- AppBar
- SummaryStrip
- SegmentedControl
- ServiceButton
- PrimaryButton
- MetaLinkRow
- TeamIdentityRow
- ReleaseSummaryRow
- UpcomingEventRow
- AlbumCard
- TrackRow
- EmptyStateBlock
- ErrorStateBlock
- DateDetailSheet
- FilterSheet

## 5. Screen Task Breakdown

### 5.1 Calendar
1. AppBar + Month navigation
2. SummaryStrip
3. Calendar grid + DayCell
4. Date Detail Sheet
5. List mode
6. Filter integration

### 5.2 Team Detail
1. Hero block
2. Next Comeback card
3. Latest Release card
4. Recent Album carousel

### 5.3 Release Detail
1. Header + cover/meta
2. Album service action group
3. Track list
4. MV block
5. Notes/credits/source

### 5.4 Search
1. Search input + persistence
2. Segmented results
3. Team rows
4. Release rows
5. Upcoming rows

### 5.5 Radar
1. Featured card
2. Weekly list
3. Change feed cards
4. Long-gap cards
5. Rookie cards

## 6. Delivery Order Recommendation
- Milestone A: Calendar + Team + Release
- Milestone B: Search
- Milestone C: Radar
- Milestone D: accessibility/polish/offline/error hardening

## 7. Definition of Done
- 화면이 스펙 문서의 버튼 위치/이동 규칙을 충족한다.
- selector 레이어가 raw JSON fallback을 캡슐화한다.
- 서비스 handoff는 canonical 또는 검색 fallback을 지원한다.
- 접근성 기본 요건을 만족한다.
- QA acceptance checklist를 통과한다.

## 8. 구현 참고 문서
- 공통 컴포넌트 API는 `component-api-contracts.md`를 따른다.
- 화면 state 설계는 `view-state-models.md`를 따른다.
- end-to-end 구현 순서는 `user-journey-sequences.md`를 참조한다.

## 9. 플랫폼 구현 참조
- Expo 라우팅/상태/asset/성능 가이드는 `expo-implementation-guide.md`를 따른다.
- 화면 완료 기준은 `screen-delivery-checklists.md`를 따른다.
- 테스트 레벨과 최소 합격선은 `testing-strategy-spec.md`를 따른다.

## 10. 이슈 분해 참조
- 실제 GitHub 이슈 생성 순서와 묶음은 `github-issue-breakdown-plan.md`를 따른다.
- TypeScript 모델 예시는 `typescript-interface-examples.md`를 참조한다.

## 11. 운영/결정 참조
- 용어 정의는 `domain-glossary.md`를 따른다.
- 완료 기준 외 비기능 요구는 `non-functional-requirements-spec.md`를 따른다.
- 구현 중 핵심 판단은 `decision-log.md`를 참조한다.

## 12. 출시/운영 게이트 참조
- 데이터 신선도 규칙은 `data-sync-freshness-spec.md`를 따른다.
- 외부 링크/analytics 보안 규칙은 `privacy-security-spec.md`를 따른다.
- MVP 출시 직전 차단 조건은 `release-readiness-gate.md`를 따른다.
