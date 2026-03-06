# Radar Screen Spec

## 1. 화면 목적
레이더 화면은 `다가오는 컴백`, `일정 변경`, `장기 공백`, `루키`를 날짜순/중요도순으로 빠르게 확인하는 요약 허브다.
캘린더보다 이벤트 중심이고, 팀 상세로 들어가기 전의 탐색 대시보드 역할을 한다.

## 2. 진입 경로
- 하단 탭 `레이더`
- 캘린더/검색에서 특정 CTA로 진입 가능한 확장은 v2 고려사항

## 3. 이탈 경로
- Team Detail push
- 기사/공식 공지 외부 이동
- Search 탭 이동
- Calendar 탭 이동

## 4. 레이아웃 구조

### 4.1 App Bar
- 좌측: 제목 `레이더`
- 우측: Search 버튼, Filter 버튼
- App Bar는 safe area 아래 첫 줄에 고정한다.

### 4.2 Summary Strip
- 선택적 소형 요약 스트립
- 항목 예시:
  - 이번 주 예정 수
  - 일정 변경 수
  - 장기 공백 수
- v1에서는 텍스트/숫자 요약 2~3개까지만 허용

### 4.3 Section Stack
1. `가장 가까운 컴백`
2. `이번 주 예정`
3. `일정 변경`
4. `장기 공백 레이더`
5. `루키 레이더`

### 4.4 Scroll Behavior
- 전체 화면은 단일 세로 스크롤
- 섹션 내부 독립 스크롤 금지
- 가장 가까운 컴백 카드는 첫 화면에서 스크롤 없이 보여야 한다.

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| App Bar | Title | 상단 | 필수 | 없음 |
| App Bar | Search Button | 우측 | 필수 | Search 탭 진입 |
| App Bar | Filter Button | 우측 | 필수 | Filter Sheet 오픈 |
| Summary | Radar Summary Strip | App Bar 아래 | 선택 | 없음 |
| Section | Featured Comeback Card | 최상단 | 필수 | Team Detail push |
| Section | Weekly Event Card | 그 아래 | 조건부 | Team Detail push |
| Section | Change Card | 중간 | 조건부 | Team Detail push / source open |
| Section | Long-gap Card | 하단 | 조건부 | Team Detail push |
| Section | Rookie Card | 하단 | 조건부 | Team Detail push |

## 6. 배치 계약
- Featured Comeback Card는 첫 번째 섹션의 첫 번째 카드로만 둔다.
- Search와 Filter는 trailing group으로만 묶는다.
- 모든 레이더 카드의 Primary는 `팀 페이지`이며, 서비스 버튼은 노출하지 않는다.
- source 링크는 카드 마지막 줄 Meta 영역에만 둔다.
- 상태 칩과 confidence 칩은 제목보다 먼저 오지 않는다.

## 7. 섹션 명세

### 7.1 가장 가까운 컴백 카드
- 정보:
  - 팀명
  - D-day
  - 예정일
  - 상태
  - 대표 source
- 액션 순서:
  1. `팀 페이지`(Primary)
  2. source(Meta)
- 카드 강조:
  - 일반 카드보다 한 단계 높은 시각 위계
  - 과도한 shadow/gradient 금지

### 7.2 이번 주 예정 카드
- 정보:
  - 팀명
  - 예정명/headline
  - 예정일
  - 상태
  - confidence
- 액션 순서:
  1. `팀 페이지`(Primary)
  2. source(Meta)
- 정렬:
  - 예정일 오름차순

### 7.3 일정 변경 카드
- 정보:
  - 팀명
  - 이전 일정
  - 새 일정
  - 변경 유형 (`연기`, `당김`, `상태 변경` 등)
  - source
- 액션 순서:
  1. `팀 페이지`(Primary)
  2. source(Meta)
- 시각 규칙:
  - 일반 예정 카드와 구분되는 변화 강조 영역 필요
  - 단, 경고 UI처럼 과장하지 않음

### 7.4 장기 공백 카드
- 정보:
  - 팀명
  - 마지막 verified release
  - 경과 기간
  - 예정 신호 여부
- 액션:
  1. `팀 페이지`(Primary)
- 서비스/기사 버튼은 v1에서 노출하지 않음

### 7.5 루키 카드
- 정보:
  - 팀명
  - 데뷔 연도
  - 최근 verified release
  - 예정 신호 여부
- 액션:
  1. `팀 페이지`(Primary)

## 8. 필터 규칙
- 지원 후보:
  - 상태 (`예정`, `확정`, `변경`)
  - act type (`그룹`, `솔로`, `유닛`)
  - 레이더 섹션 on/off
- Filter Sheet 적용 후 레이더 리스트는 즉시 재계산되어야 한다.
- Featured Comeback Card 대상이 사라지면 다음 우선 항목으로 교체한다.

## 9. 데이터 바인딩
- Featured Comeback: `upcomingCandidates.json`에서 exact/future date 기준 가장 가까운 항목
- Weekly Events: 현재 주 범위 필터된 upcoming
- Change Feed: `change-tracked` 데이터 또는 derived diff feed
- Long-gap: `watchlist.json` + latest release recency
- Rookie: `artistProfiles.json`의 debut_year 또는 manual rookie tags
- Team badge/image: `artistProfiles.json` 우선, 없으면 fallback

## 10. 상태 매트릭스
| 상태 | Featured | Weekly | Change | Long-gap/Rookie |
|---|---|---|---|---|
| Default | 카드 노출 | 리스트 노출 | 있으면 노출 | 있으면 노출 |
| Loading | skeleton | skeleton | skeleton | skeleton |
| Empty | `가까운 컴백 일정이 없습니다.` | `이번 주 예정이 없습니다.` | `감지된 일정 변경이 없습니다.` | 섹션 숨김 또는 empty |
| Partial Data | headline fallback | confidence 숨김 | source만 유지 | 최소 카드 유지 |
| Error | retry | retry | retry | retry |

## 11. 문구 계약
- 섹션 제목은 `가장 가까운 컴백`, `이번 주 예정`, `일정 변경`, `장기 공백 레이더`, `루키 레이더`로 고정한다.
- D-day 표기는 `D-3`, `오늘`, `내일` 규칙을 따른다.
- source 라벨은 `기사 원문`, `공식 공지`, `소스 보기`만 사용한다.

## 12. 제스처 및 전환
- Featured/Weekly/Change/Long-gap/Rookie 카드 탭은 기본적으로 Team Detail push다.
- source 링크는 별도 external open이다.
- 레이더 화면 내에서 bottom sheet drill-in은 v1에 두지 않는다.

## 13. 애니메이션
- 섹션 등장 fade/translate 약하게
- Featured card 강조는 색/크기 위주, 과한 모션 금지
- 카드 press feedback은 120~160ms 범위의 짧은 feedback만 허용

## 14. 상세 요구사항
- 이 화면의 주 CTA는 항상 `팀 페이지`다.
- 서비스 액션은 여기서 전면 노출하지 않는다.
- source는 보조 링크로만 노출한다.
- Featured card는 스크롤 없이 첫 화면에서 보여야 한다.

## 15. QA 핵심 포인트
- Featured card 존재 여부
- 이번 주 예정 비어 있을 때 empty copy
- 일정 변경 카드가 있을 때 일반 카드와 시각적으로 구분되는지 확인
- 팀 페이지 CTA가 모든 섹션에서 일관된지 확인
- 필터 적용 후 Featured 대상이 정상 재계산되는지 확인
