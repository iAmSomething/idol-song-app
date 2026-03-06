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
