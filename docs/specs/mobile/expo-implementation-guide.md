# Expo Implementation Guide

## 1. 목적
이 문서는 `Expo + React Native + Expo Router` 기준으로 모바일 앱을 실제로 시작할 때 필요한 구현 가이드를 정의한다.
문서 목적은 라이브러리 선택, 폴더 규칙, 상태/데이터 흐름, 외부 handoff, 테스트 전제까지 통일하는 것이다.

## 2. 권장 스택
- Framework: Expo
- Routing: Expo Router
- Language: TypeScript
- Styling: token 기반 style object 또는 design-system wrapper
- State: local screen state + selector/adapter 조합
- Remote state: v1에서는 정적 JSON 소비 우선
- Testing: unit + component + smoke e2e

## 3. 라우팅 가이드

### 3.1 권장 경로 구조
```text
mobile/app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    calendar.tsx
    radar.tsx
    search.tsx
  artists/[slug].tsx
  releases/[id].tsx
```

### 3.2 규칙
- 최상위 탭은 `(tabs)` 아래만 둔다.
- `artists/[slug]`와 `releases/[id]`는 push screen이다.
- `Date Detail`과 `Filter`는 route가 아니라 sheet state로 관리한다.

## 4. 상태 관리 가이드

### 4.1 원칙
- 전역 store를 먼저 도입하지 않는다.
- 화면 state는 화면 내부에서 관리한다.
- 재사용 규칙은 selector/adapter layer로 올린다.

### 4.2 분리 기준
- UI state:
  - selected month
  - selected date
  - sheet open/close
  - query
  - selected segment
- derived state:
  - nearest comeback
  - month releases
  - search results
  - latest release

### 4.3 금지
- raw JSON를 여러 컴포넌트에서 직접 읽기
- 화면마다 같은 정렬/선택 로직 중복 구현

## 5. 데이터 로딩 가이드

### 5.1 v1 방향
- 앱 번들 또는 로컬 캐시 가능한 정적 JSON 소비
- `releases.json`, `artistProfiles.json`, `upcomingCandidates.json`, `releaseArtwork.json`, `releaseDetails.json` 우선

### 5.2 adapter layer
- 각 raw JSON를 바로 화면에 넘기지 않고 adapter를 거친다.
- adapter는 nullable field와 fallback을 포함한 display model을 반환한다.

### 5.3 캐싱
- 정적 데이터는 메모리 캐시 또는 lightweight storage 사용 가능
- 화면 재진입 시 매번 parse/derive 과다 반복 금지

## 6. 스타일링 가이드

### 6.1 규칙
- 디자인 토큰은 `src/tokens/` 아래 정의
- 화면 스타일에서 raw number/hex를 직접 박지 않는다.
- semantic token과 layout constraint 문서를 기준으로 스타일을 만든다.

### 6.2 컴포넌트 레벨
- `components/`는 순수 표시 컴포넌트 우선
- `features/`는 composition과 state binding 담당

## 7. 외부 앱 Handoff 가이드

### 7.1 서비스별 원칙
- canonical URL 있으면 canonical open
- 없으면 search fallback open
- 둘 다 실패하면 external-open error feedback 제공

### 7.2 구현 포인트
- 외부 앱 열기 실패 시 브라우저 fallback 고려
- 사용자에게 재생 보장을 암시하는 문구 금지
- 접근성 라벨에 서비스명과 대상명 포함

## 8. 이미지/자산 가이드
- team badge와 cover는 async image component로 통일
- placeholder asset을 공통 사용
- broken image가 layout shift를 만들면 안 된다.

## 9. 성능 가이드
- 큰 리스트는 virtualization 고려
- selector는 memoization 가능 구조 권장
- 캘린더 셀에 heavy image 작업 금지
- search input은 과도한 recompute 방지 필요

## 10. 접근성 가이드
- icon-only button 금지
- minimum touch target 확보
- Dynamic Type 확대 시 레이아웃 재검증
- VoiceOver/TalkBack 라벨은 컴포넌트 API 단계에서 강제

## 11. 개발 순서 권장
1. Router shell
2. Token/theme
3. Shared selectors/adapters
4. Shared components
5. Calendar + Date Detail Sheet
6. Team Detail
7. Release Detail
8. Search
9. Radar
10. QA polish

## 12. Definition of Ready
- 화면 스펙 존재
- adapter/selectors 규칙 명확
- 필요한 sample payload 존재
- QA acceptance 포인트 확인

## 13. 환경/라우트 참조
- route param과 deep-link 계약은 `route-param-contracts.md`를 따른다.
- environment/data source/feature gate는 `configuration-environment-spec.md`를 따른다.
- 오류 분류와 로깅 정책은 `observability-error-taxonomy.md`를 따른다.

## 14. 성능/feature gate/외부 의존 참조
- 체감 성능 기준은 `performance-budget-spec.md`를 따른다.
- feature gate 설계는 `feature-gate-matrix.md`를 따른다.
- 외부 서비스/데이터 리스크는 `external-dependency-risk-spec.md`를 따른다.
