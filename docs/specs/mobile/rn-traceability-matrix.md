# RN Traceability Matrix

## 목적
- `docs/specs/mobile/` 전체 문서를 RN 구현/QA/운영 이슈에 추적 가능하게 연결한다.
- 구현자가 문서를 보고 바로 집행 이슈를 찾을 수 있게 한다.
- sign-off 전 문서 누락 여부를 빠르게 판별한다.

## 운영 규칙
- 모든 모바일 문서는 최소 1개의 RN 이슈에 primary로 연결된다.
- umbrella 성격 문서는 `#425`를 secondary anchor로 둔다.
- 구현이 끝난 이슈는 `closed`, 남은 이슈는 `open`으로 기록한다.
- 문서가 여러 축에 걸치면 `secondary issues`에만 확장하고 primary는 하나로 유지한다.

## Core Spec Mapping

| Document | Primary RN issue | Secondary issues | Status | Note |
| --- | --- | --- | --- | --- |
| `master-spec.md` | `#425` | `#430`, `#431`, `#434` | open | 전역 UX/구현 단계 umbrella |
| `component-action-system.md` | `#459` | `#433` | open | 탭/푸시/외부 이동 액션 계층 |
| `navigation-motion-spec.md` | `#426` | `#427`, `#435`, `#459` | open | route, sheet, 복귀 규칙 |
| `data-binding-spec.md` | `#458` | `#455` | open | selector output과 fallback 계약 |
| `visual-design-spec.md` | `#430` |  | open | spacing, density, sizing |
| `component-catalog.md` | `#430` | `#427`, `#459` | open | shared component 구조/행동 |
| `layout-constraint-spec.md` | `#430` |  | open | surface layout/density |
| `state-feedback-spec.md` | `#455` | `#454` | open | loading/empty/error/partial states |
| `copy-localization-spec.md` | `#431` | `#455` | open | copy/localization 규칙 |
| `accessibility-platform-spec.md` | `#454` | `#459`, `#508` | closed | QA/platform acceptance sign-off complete |
| `edge-case-catalog.md` | `#455` | `#458` | open | null/missing/partial edge cases |
| `qa-acceptance-spec.md` | `#454` | `#459`, `#510` | closed | preview sign-off gate complete |
| `interaction-matrix.md` | `#459` | `#426`, `#427`, `#433` | open | 탭/시트/push/external 행동 매트릭스 |
| `sample-data-contracts.md` | `#458` | `#455` | open | fixture/sample parity 기준 |
| `wireframe-block-diagrams.md` | `#430` | `#425` | open | 화면 구조 baseline |
| `design-token-spec.md` | `#430` |  | open | token-driven sizing/bounds |
| `implementation-work-breakdown.md` | `#425` | `#456` | open | RN executable backlog baseline |
| `component-api-contracts.md` | `#430` | `#427`, `#459` | open | 공통 컴포넌트 props/행동 |
| `view-state-models.md` | `#457` | `#435`, `#458` | open | state/model naming 기준 |
| `user-journey-sequences.md` | `#459` | `#454` | open | interaction + QA path |
| `expo-implementation-guide.md` | `#425` | `#426`, `#434` | open | runtime/router implementation baseline |
| `screen-delivery-checklists.md` | `#454` | `#425`, `#510` | closed | release gate checklist executed |
| `testing-strategy-spec.md` | `#454` | `#458`, `#510` | closed | selector/UI smoke/test scope satisfied for preview gate |
| `typescript-interface-examples.md` | `#457` | `#458` | open | display model/type naming 기준 |
| `github-issue-breakdown-plan.md` | `#425` | `#456` | open | live issue umbrella/order |
| `domain-glossary.md` | `#457` | `#456` | open | 용어 고정점 |
| `non-functional-requirements-spec.md` | `#430` | `#434`, `#454` | open | perf/runtime/testability |
| `decision-log.md` | `#425` | `#456` | open | 구현 판단 근거 |
| `analytics-event-spec.md` | `#432` | `#459` | open | interaction/failure analytics |
| `data-sync-freshness-spec.md` | `#455` | `#434` | open | stale/partial disclosure 기준 |
| `privacy-security-spec.md` | `#433` | `#459` | open | external/handoff/privacy guard |
| `accessibility-reading-order-spec.md` | `#454` | `#459`, `#508` | closed | reading order QA evidence complete |
| `release-readiness-gate.md` | `#454` | `#425`, `#510` | closed | preview sign-off barrier cleared |
| `route-param-contracts.md` | `#426` | `#435` | open | path/deep-link/back stack |
| `configuration-environment-spec.md` | `#434` | `#419` | open | runtime/env/failure policy |
| `observability-error-taxonomy.md` | `#432` | `#434` | open | analytics + runtime failures |
| `content-governance-spec.md` | `#455` | `#458` | open | null/missing data handling |
| `performance-budget-spec.md` | `#430` | `#454` | open | density/perf QA |
| `state-restoration-spec.md` | `#435` | `#426`, `#427` | open | tabs/sheets/detail restore |
| `feature-gate-matrix.md` | `#434` | `#432` | open | feature-gate/runtime rules |
| `external-dependency-risk-spec.md` | `#433` | `#434` | open | service/dependency guardrails |

## Audit and Review Record Mapping

| Document | Primary RN issue | Secondary issues | Status | Note |
| --- | --- | --- | --- | --- |
| `accessibility-audit-2026-03-09.md` | `#454` | `#508` | closed | pre-sign-off accessibility evidence archived under final pass |
| `decision-log-review-checklist.md` | `#456` | `#425` | open | doc review/traceability anchor |
| `rn-implementation-audit-2026-03-10.md` | `#456` | `#457`, `#458` | open | implementation audit evidence |
| `rn-quality-coverage-matrix.md` | `#454` | `#458`, `#510` | closed | QA/coverage matrix satisfied by final gate |
| `rn-screen-structure-validation-2026-03-10.md` | `#430` | `#459` | open | structure/layout validation |
| `rn-journey-walkthrough-2026-03-10.md` | `#459` | `#454` | open | journey execution evidence |
| `rn-freshness-review-2026-03-10.md` | `#455` | `#434` | open | stale/fallback review evidence |

## Screen Spec Mapping

| Document | Primary RN issue | Secondary issues | Status | Note |
| --- | --- | --- | --- | --- |
| `calendar-screen.md` | `#417` | `#427`, `#435`, `#459` | closed | backend-first calendar landed, polish remains in child issues |
| `radar-screen.md` | `#418` | `#455`, `#459` | closed | backend-backed radar landed, contract/polish remains |
| `search-screen.md` | `#417` | `#458`, `#459` | closed | backend-backed search landed, contract/polish remains |
| `team-detail-screen.md` | `#418` | `#455`, `#459` | closed | backend-backed entity detail landed |
| `release-detail-screen.md` | `#418` | `#455`, `#459` | closed | backend-backed release detail landed |

## Coverage Summary
- `covered docs`: `53 / 53`
- `closed primary anchors`: `5 / 53`
- `open primary anchors`: `48 / 53`
- `documents currently anchored to umbrella/backlog docs`: `master-spec.md`, `implementation-work-breakdown.md`, `github-issue-breakdown-plan.md`, `decision-log.md`

## Review Notes
- `#417`, `#418`, `#419`는 구현 완료됐지만, 해당 문서들의 polish/validation obligations는 `#454`, `#455`, `#459`에 남아 있다.
- `#425`는 live umbrella와 execution order를 계속 유지하는 기준 문서 역할을 맡는다.
- `#456`은 이 matrix 자체와 이후 audit artifacts의 유지 이슈다.
