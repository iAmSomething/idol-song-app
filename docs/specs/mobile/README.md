# Mobile Spec Index

이 디렉터리는 향후 `Expo + React Native` 기반 모바일 앱 착수를 위한 정본 스펙 문서 세트다.
웹 UI를 그대로 옮기지 않고, 모바일 전용 UX로 재설계하되 현재 웹의 데이터 계약과 도메인 로직을 최대한 재사용하는 것을 전제로 한다.

## 문서 구성

### Core
1. `master-spec.md`
   - 제품 목표, IA, 내비게이션 구조, 전역 UX 원칙, 구현 단계
2. `component-action-system.md`
   - 전역 액션 위계, 버튼 분류, 서비스 액션 규칙, 공통 컴포넌트 규칙
3. `navigation-motion-spec.md`
   - push/sheet/modal/external 이동 규칙, 상태 복원, 애니메이션 강도
4. `data-binding-spec.md`
   - 화면별 주요 데이터 소스, 필드 매핑, fallback 우선순위
5. `qa-acceptance-spec.md`
   - 화면별 QA 체크리스트, 핵심 시나리오, 회귀 포인트

### Screen Specs
6. `calendar-screen.md`
7. `radar-screen.md`
8. `search-screen.md`
9. `team-detail-screen.md`
10. `release-detail-screen.md`

## 읽는 순서
1. `master-spec.md`
2. `component-action-system.md`
3. `navigation-motion-spec.md`
4. `data-binding-spec.md`
5. 각 화면 스펙
6. `qa-acceptance-spec.md`

## 구현 원칙
- 모바일은 웹과 다른 레이아웃을 사용한다.
- 재사용 대상은 UI가 아니라 데이터 스키마와 도메인 로직이다.
- 액션 위계는 `탐색 > 서비스 > 출처`를 유지한다.
- 태그/칩은 절대 액션처럼 보이면 안 된다.
- 각 화면 문서는 `컴포넌트 위치 + 기능 명세 + 상태값 + 이동 규칙 + QA 기준`을 포함한다.
