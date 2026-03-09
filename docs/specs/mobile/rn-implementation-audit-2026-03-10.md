# RN Implementation Audit 2026-03-10

대상 이슈: `#463`, `#464`, `#465`

## 목적

React Native 구현이 모바일 결정 로그와 비기능 요구를 얼마나 일관되게 따르고 있는지 점검하고, 중복 구현이나 source-confidence 불일치를 줄이는 데 목적이 있다.

## 확인 결과

- `calendar`, `search`, `radar`, `entity detail`, `release detail` 5개 주요 surface가 모두 같은 dataset loading 패턴을 반복하고 있었다.
- degraded / error analytics와 event dedupe 로직이 화면별로 복제되어 유지보수성이 낮았다.
- source-confidence / external dependency disclosure는 화면별 기준이 조금씩 달랐고, 일부는 아예 없었다.
- 결정 로그 핵심 판단 자체를 뒤집는 구현은 찾지 못했다.
  - 앱 내 직접 재생 추가 없음
  - 팀 페이지 실용 허브 순서 유지
  - release detail 독립 소비 화면 유지
  - calendar bottom sheet drill-in 유지
  - alias-aware search 유지

## 이번 정리로 바뀐 점

- `useActiveDatasetScreen`으로 dataset load/degraded/error analytics 경로를 중앙화했다.
- `surfaceDisclosures` helper로 dataset risk, entity source confidence, release dependency disclosure를 공통화했다.
- 5개 주요 surface가 같은 degraded/error/fallback 언어와 구조를 쓰도록 맞췄다.
- release detail / entity detail은 데이터 공백을 placeholder로 숨기지 않고 explicit notice로 노출한다.

## 남은 운영 규칙

- 새 surface가 dataset을 직접 로드할 경우 shared hook으로 올릴 수 있는지 먼저 검토한다.
- source-confidence / external dependency 관련 새 notice는 `surfaceDisclosures.ts` 확장을 우선한다.
- 결정 로그 변경이 없으면 화면 스펙보다 checklist 기준으로 회귀를 막는다.
