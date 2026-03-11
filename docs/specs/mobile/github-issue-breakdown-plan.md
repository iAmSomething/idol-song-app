# GitHub Issue Breakdown Plan

## 1. 목적
이 문서는 모바일 스펙 문서를 실제 GitHub issue 묶음으로 분해하기 위한 계획서다.
이 문서를 보면 PM이 어떤 순서로 이슈를 만들고, 어떤 범위로 잘라야 하는지 바로 판단할 수 있어야 한다.

## 2. Epic 구조

### Epic A. Mobile Foundation
- Expo shell
- routing
- tokens
- shared selectors
- shared components

### Epic B. Calendar Experience
- Calendar screen
- Date Detail Sheet
- monthly list mode
- filter integration

### Epic C. Team and Release Details
- Team Detail
- Release Detail
- service handoff
- MV block

### Epic D. Search Experience
- alias search
- result segments
- recent queries

### Epic E. Radar Experience
- featured comeback
- weekly list
- change feed
- long-gap / rookie

### Epic F. Polish and QA
- accessibility
- empty/error/partial states
- device smoke
- regression checklist

## 3. Suggested Issues

### A-series
- `A1` Bootstrap Expo app shell and router structure
- `A2` Add token/theme layer from mobile token spec
- `A3` Implement shared selectors and adapters for mobile display models
- `A4` Implement shared action/button primitives
- `A5` Implement shared rows, cards, and sheet primitives

### B-series
- `B1` Build calendar screen shell and month navigation
- `B2` Implement day cell grid and selected state
- `B3` Implement date detail sheet
- `B4` Add calendar list mode
- `B5` Add calendar filter sheet integration

### C-series
- `C1` Build team detail hero and official links
- `C2` Add next comeback and latest release sections
- `C3` Add recent album carousel
- `C4` Build release detail screen shell
- `C5` Add track list and title-track badges
- `C6` Add album-level and track-level service handoff
- `C7` Add MV block with fallback behavior

### D-series
- `D1` Build search screen shell and input state
- `D2` Add alias-aware result computation
- `D3` Add segmented results and recent searches
- `D4` Add release-row secondary service actions

### E-series
- `E1` Build radar screen shell and featured card
- `E2` Add weekly upcoming section
- `E3` Add schedule change section
- `E4` Add long-gap and rookie sections
- `E5` Add radar filter integration

### F-series
- `F1` Accessibility pass across shared components
- `F2` Empty/error/partial-state hardening
- `F3` Device-level handoff and gesture QA
- `F4` Regression checklist and sign-off

## 4. Recommended Order
1. A1-A5
2. B1-B5
3. C1-C7
4. D1-D4
5. E1-E5
6. F1-F4

## 5. Issue Writing Rules
- 각 이슈는 화면/컴포넌트/selector 중 한 축만 주로 건드리게 한다.
- 수용 기준은 해당 문서 섹션을 직접 링크해 작성한다.
- `1 issue = 1 PR` 원칙 유지.
- Calendar, Team Detail, Release Detail은 우선순위를 Search/Radar보다 높게 둔다.

## 6. Merge Gates
- screen-delivery-checklists 충족
- relevant QA acceptance 항목 충족
- selector fallback 테스트 존재
- external handoff smoke 확인

## 7. Live RN Umbrella and Execution Order

### 7.1 Landed foundation / cutover work
- `#404` shared mobile backend read client
- `#405` parent mobile surface cutover
- `#415` persisted screen snapshot cache
- `#416` shared mobile screen-source hook
- `#417` calendar/search backend cutover
- `#418` radar/entity detail/release detail backend cutover
- `#419` preview/production backend-primary runtime policy

### 7.2 Remaining system / shared work
1. `#425` RN executable implementation umbrella
2. `#456` document-to-issue traceability matrix
3. `#457` naming alignment with glossary/TS examples
4. `#458` selector output + binding parity validation
5. `#455` content-governance and fallback parity checks
6. `#426` route-param/deep-link/back-navigation contracts
7. `#427` shared sheet + snap behavior
8. `#430` layout constraints, density, token sizing
9. `#431` copy/localization rules
10. `#432` analytics and observability taxonomy
11. `#433` privacy/security/external handoff guards
12. `#434` feature-gate, environment, failure-policy enforcement
13. `#435` state restoration across tabs/sheets/detail/search/radar

### 7.3 QA / polish gate
1. `#459` interaction matrix compliance across all screens
2. `#454` release-readiness gate + device QA matrix

### 7.4 Working rule
- 새 RN 작업은 위 순서를 기본으로 집행하되, dependency가 강한 항목은 한 PR에서 묶을 수 있다.
- `#425`는 umbrella, `#456`은 traceability anchor, `#454`는 최종 gate로 유지한다.

### 7.5 Release-Grade QA Closure Status
- `2026-03-11` preview sign-off 기준으로 아래 이슈는 충족 상태다.
  - `#503` iOS end-to-end QA
  - `#504` Android end-to-end QA
  - `#508` final accessibility freeze
  - `#509` preview candidate runtime verification
  - `#510` final release-readiness gate
- release-grade umbrella `#502`는 blocker/non-blocker 구분과 sign-off verdict가 확정된 시점에 닫는다.
- 아래 이슈는 non-blocking polish / richer real-device follow-up으로 남길 수 있다.
  - `#505` native external handoff installed-app matrix
  - `#506` final visual polish
  - `#507` final Korean-first copy polish

## 8. Launch-Grade Visual Identity Track

### 8.1 Light-mode visual identity
1. `#511` visual identity system 고정
2. `#512` app icon system
3. `#515` richer non-card component patterns
4. `#516` placeholder / badge / fallback asset pack
5. `#513` splash + restrained launch animation
6. `#514` premium loading / skeleton / retry-feedback
7. `#517` motion system
8. `#518` export assets / implementation handoff

### 8.2 Dark-mode split
1. `#519` dark mode umbrella
2. `#520` semantic token and theme mapping
3. `#521` shared components and main screen adaptation
4. `#522` splash / loading / placeholder dark assets
5. `#523` dark-mode accessibility and contrast QA

### 8.3 Rule
- `#511`은 visual identity 기준을 잠그는 anchor issue다.
- `#519`는 dark mode 전체 축을 관리하는 umbrella다.
- visual identity child issue와 dark mode child issue는 서로 dependency는 있지만 다른 sign-off로 추적한다.
