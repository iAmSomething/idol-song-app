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
   - push/sheet/external 이동 규칙, 상태 복원, 시트 높이, 모션 강도
4. `data-binding-spec.md`
   - 화면별 주요 데이터 소스, 필드 매핑, fallback 우선순위
5. `visual-design-spec.md`
   - spacing, radius, elevation, icon size, chip/button 규칙
6. `component-catalog.md`
   - 공통 UI 컴포넌트 해부도, props 성격, 상태, 접근성
7. `layout-constraint-spec.md`
   - 화면/블록별 최소 높이, 줄 수, sticky 범위, 비율
8. `state-feedback-spec.md`
   - loading, empty, partial, error, external-open 실패 피드백
9. `copy-localization-spec.md`
   - 버튼 라벨, empty/error 문구, 날짜/언어 정책
10. `accessibility-platform-spec.md`
   - 접근성, 플랫폼 차이, 외부 앱 handoff, dynamic type 규칙
11. `edge-case-catalog.md`
   - 예외 데이터, 긴 텍스트, 누락 메타, 다중 기사, 링크 누락 처리
12. `qa-acceptance-spec.md`
   - 화면별 QA 체크리스트, 핵심 시나리오, 회귀 포인트
13. `interaction-matrix.md`
   - 화면별 모든 주요 탭/시트/외부 이동 매트릭스
14. `sample-data-contracts.md`
   - UI 관점의 최소 JSON payload 예시
15. `wireframe-block-diagrams.md`
   - 핵심 화면의 블록 수준 구조 다이어그램
16. `design-token-spec.md`
   - semantic token naming과 역할 정의
17. `implementation-work-breakdown.md`
   - Expo 앱 구현을 위한 모듈/작업 분해
18. `component-api-contracts.md`
   - 공통 컴포넌트의 props, 이벤트, fallback 계약
19. `view-state-models.md`
   - 화면별 상태 shape와 상태 전이 규칙
20. `user-journey-sequences.md`
   - end-to-end 사용자 흐름과 alternate flow
21. `expo-implementation-guide.md`
   - Expo Router, 상태, handoff, asset, 성능 가이드
22. `screen-delivery-checklists.md`
   - 화면별 완료 체크리스트
23. `testing-strategy-spec.md`
   - unit/component/smoke/manual 테스트 전략
24. `typescript-interface-examples.md`
   - display model, props, screen state의 TS 예시
25. `github-issue-breakdown-plan.md`
   - 모바일 구현을 위한 GitHub issue 분해 계획
26. `domain-glossary.md`
   - 팀, 릴리즈, upcoming, handoff 등 핵심 용어 정의
27. `non-functional-requirements-spec.md`
   - 성능, 상태 보존, 접근성, 테스트성 요구사항
28. `decision-log.md`
   - 제품/UX 핵심 결정 기록
29. `analytics-event-spec.md`
   - 화면/CTA/외부 이동 중심 분석 이벤트 정의
30. `data-sync-freshness-spec.md`
   - JSON 산출물 신선도, 갱신 기대치, 캐싱/partial-data 정책
31. `privacy-security-spec.md`
   - 외부 링크, analytics, 로컬 저장, 보안 가드 규칙
32. `accessibility-reading-order-spec.md`
   - VoiceOver/TalkBack 기준 읽기 순서와 라벨 정책
33. `release-readiness-gate.md`
   - 모바일 MVP 출시 전 게이트와 차단 조건
34. `route-param-contracts.md`
   - 화면 path, param, deep-link, back behavior 계약
35. `configuration-environment-spec.md`
   - 환경 분리, 데이터 소스, feature gate, build 설정 원칙
36. `observability-error-taxonomy.md`
   - 오류 분류, 로깅 포인트, 사용자 피드백 규칙
37. `content-governance-spec.md`
   - 프로필/아트워크/상세 메타데이터 운영 원칙
38. `performance-budget-spec.md`
   - 화면별 체감 성능 예산과 금지 패턴
39. `state-restoration-spec.md`
   - 탭/시트/뒤로가기/복귀 시 상태 복원 규칙
40. `feature-gate-matrix.md`
   - Radar, MV, analytics 등 기능 게이트와 fallback 규칙
41. `external-dependency-risk-spec.md`
   - 외부 서비스/데이터 의존 리스크와 완화 전략
42. `accessibility-audit-2026-03-09.md`
   - 구현된 모바일 화면에 대한 접근성/동적 글자 크기 점검 기록
43. `decision-log-review-checklist.md`
   - 결정 로그 기준 구현 점검 체크리스트
44. `rn-implementation-audit-2026-03-10.md`
   - RN 구현 중복/신뢰도 경로 감사 기록
45. `rn-quality-coverage-matrix.md`
   - 공용 컴포넌트 / screen smoke / manual QA coverage matrix
46. `rn-screen-structure-validation-2026-03-10.md`
   - RN 주요 화면의 wireframe/checklist 구조 검증 기록
47. `rn-journey-walkthrough-2026-03-10.md`
   - RN 핵심 user journey walkthrough 결과
48. `rn-freshness-review-2026-03-10.md`
   - RN freshness/stale disclosure 리뷰 기록
49. `rn-traceability-matrix.md`
   - 전체 mobile spec 문서와 RN issue 매핑
50. `rn-selector-contract-audit.md`
   - selector/adaptor/display-model naming 및 contract parity audit
51. `rn-release-readiness-gate-2026-03-10.md`
   - preview sign-off 전 RN release-readiness gate 실행 결과와 blocker 분류
### Screen Specs
52. `calendar-screen.md`
53. `radar-screen.md`
54. `search-screen.md`
55. `team-detail-screen.md`
56. `release-detail-screen.md`

## 읽는 순서
1. `master-spec.md`
2. `component-action-system.md`
3. `visual-design-spec.md`
4. `component-catalog.md`
5. `layout-constraint-spec.md`
6. `state-feedback-spec.md`
7. `copy-localization-spec.md`
8. `navigation-motion-spec.md`
9. `data-binding-spec.md`
10. `accessibility-platform-spec.md`
11. `interaction-matrix.md`
12. `sample-data-contracts.md`
13. `wireframe-block-diagrams.md`
14. `design-token-spec.md`
15. `implementation-work-breakdown.md`
16. `component-api-contracts.md`
17. `view-state-models.md`
18. `user-journey-sequences.md`
19. `expo-implementation-guide.md`
20. `screen-delivery-checklists.md`
21. `testing-strategy-spec.md`
22. `typescript-interface-examples.md`
23. `github-issue-breakdown-plan.md`
24. `domain-glossary.md`
25. `non-functional-requirements-spec.md`
26. `decision-log.md`
27. `analytics-event-spec.md`
28. `data-sync-freshness-spec.md`
29. `privacy-security-spec.md`
30. `accessibility-reading-order-spec.md`
31. `release-readiness-gate.md`
32. `route-param-contracts.md`
33. `configuration-environment-spec.md`
34. `observability-error-taxonomy.md`
35. `content-governance-spec.md`
36. `performance-budget-spec.md`
37. `state-restoration-spec.md`
38. `feature-gate-matrix.md`
39. `external-dependency-risk-spec.md`
40. `decision-log-review-checklist.md`
41. `rn-implementation-audit-2026-03-10.md`
42. `rn-quality-coverage-matrix.md`
43. `rn-screen-structure-validation-2026-03-10.md`
44. `rn-journey-walkthrough-2026-03-10.md`
45. `rn-freshness-review-2026-03-10.md`
46. `rn-traceability-matrix.md`
47. `rn-selector-contract-audit.md`
48. `rn-release-readiness-gate-2026-03-10.md`
49. 각 화면 스펙
50. `edge-case-catalog.md`
51. `qa-acceptance-spec.md`

## 구현 원칙
- 모바일은 웹과 다른 레이아웃을 사용한다.
- 재사용 대상은 UI가 아니라 데이터 스키마와 도메인 로직이다.
- 액션 위계는 `탐색 > 서비스 > 출처`를 유지한다.
- 태그/칩은 절대 액션처럼 보이면 안 된다.
- 각 화면 문서는 `컴포넌트 위치 + 기능 명세 + 상태값 + 이동 규칙 + 애니메이션 + QA 기준`을 포함한다.
- 공통 정책은 Core 문서가 우선이며, 화면 문서는 이를 구체화한다.
