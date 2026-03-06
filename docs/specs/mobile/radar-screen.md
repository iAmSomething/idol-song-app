# Radar Screen Spec

## 1. 화면 목적
레이더 화면은 `다가오는 컴백`, `일정 변경`, `장기 공백`, `루키`를 날짜순/중요도순으로 빠르게 확인하는 요약 허브다.
캘린더보다 이벤트 중심이고, 팀 상세로 들어가기 전의 탐색 대시보드 역할을 한다.

## 2. 진입 경로
- 하단 탭 `레이더`

## 3. 이탈 경로
- 팀 상세 push
- 기사/공식 공지 외부 이동
- 검색 탭 이동
- 캘린더 탭 이동

## 4. 레이아웃 구조
### 4.1 상단 앱 바
- 제목 `레이더`
- 검색 버튼(optional)
- 필터 버튼(optional)

### 4.2 섹션 순서
1. `가장 가까운 컴백`
2. `이번 주 예정`
3. `일정 변경`
4. `장기 공백 레이더`
5. `루키 레이더`

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| App Bar | Title | 상단 | 필수 | 없음 |
| App Bar | Search Button | 우측 | 선택 | Search 탭 진입 |
| App Bar | Filter Button | 우측 | 선택 | Filter Sheet 오픈 |
| Section | Featured Comeback Card | 최상단 | 필수 | Team Detail push |
| Section | Weekly Event Card | 그 아래 | 필수 | Team Detail push |
| Section | Change Card | 중간 | 조건부 | Team Detail push / source open |
| Section | Long-gap Card | 하단 | 조건부 | Team Detail push |
| Section | Rookie Card | 하단 | 조건부 | Team Detail push |

## 6. 섹션 명세
### 6.1 가장 가까운 컴백 카드
- 정보: 팀명, D-day, 예정일, 상태, 대표 source
- 액션: `팀 페이지`(Primary), source(Meta)
- 위치: 화면 최상단 강조 카드

### 6.2 이번 주 예정 카드
- 정보: 팀명, 예정명/headline, 예정일, 상태, confidence
- 액션: `팀 페이지`(Primary), source(Meta)

### 6.3 일정 변경 카드
- 정보: 팀명, 이전 일정, 새 일정, 변경 유형, source
- 액션: `팀 페이지`(Primary), source(Meta)

### 6.4 장기 공백 카드
- 정보: 팀명, 마지막 verified release, 경과 기간, 예정 신호 여부
- 액션: `팀 페이지`(Primary)

### 6.5 루키 카드
- 정보: 팀명, 데뷔 연도, 최근 verified release, 예정 신호 여부
- 액션: `팀 페이지`(Primary)

## 7. 데이터 바인딩
- 가장 가까운 컴백: upcoming sorted ascending
- 일정 변경: upcoming change-tracked feed or derived diff data
- 장기 공백: watchlist + latest release recency
- 루키: artist profile debut year or manual rookie tags

## 8. 상태 매트릭스
| 상태 | Featured | Weekly | Change | Long-gap/Rookie |
|---|---|---|---|---|
| Default | 카드 노출 | 리스트 노출 | 있으면 노출 | 있으면 노출 |
| Loading | skeleton | skeleton | skeleton | skeleton |
| Empty | 최근 컴백 없음 메시지 | `이번 주 예정 없음` | `변경 없음` | 섹션 숨김 또는 empty |
| Partial Data | headline fallback | confidence 숨김 | source만 유지 | 최소 카드 유지 |
| Error | retry | retry | retry | retry |

## 9. 애니메이션
- 섹션 등장 fade/translate 약하게
- 카드 강조는 색/크기 위주, 과한 모션 금지

## 10. 상세 요구사항
- 이 화면의 주 CTA는 항상 `팀 페이지`다.
- 서비스 액션은 여기서 전면 노출하지 않는다.
- source는 보조 링크로만 노출한다.
- `가장 가까운 컴백`은 스크롤 없이 첫 화면에서 보여야 한다.

## 11. QA 핵심 포인트
- Featured card 존재 여부
- 이번 주 예정 비어 있을 때 empty copy
- 일정 변경 카드가 있을 때 시각적으로 구분되는지 확인
