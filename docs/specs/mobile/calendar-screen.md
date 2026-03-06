# Calendar Screen Spec

## 1. 화면 목적
캘린더 화면은 월간 발매/예정 탐색의 기본 진입점이다.
사용자는 이 화면에서 `언제 무엇이 나오는지`를 날짜 중심으로 확인하고, 특정 날짜를 탭해 상세 정보와 액션으로 내려간다.

## 2. 진입 경로
- 앱 기본 진입 화면
- 하단 탭 `캘린더`

## 3. 이탈 경로
- 날짜 상세 bottom sheet
- 팀 상세 push
- 앨범/릴리즈 상세 push
- 서비스 외부 이동
- 검색 탭 전환
- 레이더 탭 전환

## 4. 레이아웃 구조
### 4.1 상단 앱 바
- 좌측: 현재 월 텍스트, 좌/우 월 이동 버튼
- 우측: 검색 진입 버튼, 필터 버튼, optional 언어/설정 버튼

### 4.2 월간 요약 바
- 항목 3개
  - 이번 달 발매 수
  - 예정 컴백 수
  - 가장 가까운 일정

### 4.3 보기 전환 세그먼트
- `캘린더`
- `리스트`
- 기본값: `캘린더`

### 4.4 캘린더 본문
- 7열 그리드
- 날짜 셀 내부:
  - 날짜 숫자
  - 팀 배지 최대 2개
  - 초과 시 `+N`

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| App Bar | Month Title | 좌측 상단 | 필수 | 없음 |
| App Bar | Prev Month Button | Month Title 좌측/우측 인접 | 필수 | 이전 월로 이동 |
| App Bar | Next Month Button | Month Title 우측 인접 | 필수 | 다음 월로 이동 |
| App Bar | Search Button | 우측 상단 | 필수 | Search 탭 또는 검색 진입 |
| App Bar | Filter Button | Search Button 옆 | 필수 | Filter Sheet 오픈 |
| Summary | Monthly Summary Cards | App Bar 아래 | 필수 | 탭 동작 없음 |
| Segment | View Toggle | Summary 아래 | 필수 | 캘린더/리스트 전환 |
| Calendar | Day Cell | 본문 그리드 | 필수 | Date Detail Sheet 오픈 |
| Sheet | Verified Section | Sheet 내부 상단 | 조건부 | 각 행 액션 처리 |
| Sheet | Scheduled Section | Verified 아래 | 조건부 | 각 행 액션 처리 |

## 6. 날짜 셀 규칙
### 6.1 기본
- 발매/예정 없는 날짜는 숫자만 표시
- 발매/예정 있는 날짜는 배지 노출

### 6.2 선택 상태
- border + background + ring 중 최소 2개 이상 변화
- 선택 셀은 같은 월 안에서 1개만 활성

### 6.3 탭 동작
- 해당 날짜를 선택
- bottom sheet 오픈
- 시트 헤더에 날짜 표시

## 7. Date Detail Bottom Sheet
### 7.1 목적
- 선택 날짜의 전체 일정 drill-in

### 7.2 오픈 조건
- 날짜 셀 탭

### 7.3 닫기 조건
- 배경 탭
- 아래로 스와이프
- 닫기 버튼(optional)

### 7.4 시트 헤더
- 날짜 텍스트 (`4월 13일 발매/컴백`)
- 요약 수치 (`발매 2 · 예정 1`)

### 7.5 섹션
1. `Verified releases`
2. `Scheduled comebacks`

### 7.6 Verified Release Row
- 좌측: 팀 배지 + 팀명
- 본문: 릴리즈명, 형식 칩, 발매일
- 하단 액션: `팀 페이지`(Primary), `상세 보기`(Secondary), 서비스 그룹, 출처 링크

### 7.7 Scheduled Comeback Row
- 좌측: 팀 배지 + 팀명
- 본문: 예정명 또는 headline 요약, 상태 칩, 예정일, confidence(optional)
- 하단 액션: `팀 페이지`(Primary), 기사/공식 공지(Meta)

## 8. 리스트 모드
### 8.1 목적
- 현재 월 전체를 카드형으로 스캔

### 8.2 세그먼트
- `발매`
- `예정`

### 8.3 카드 규칙
- 발매 카드: 팀명, 릴리즈명, 대표곡(optional), 형식, 발매일, 상세/서비스 액션
- 예정 카드: 팀명, 예정명, 상태, 예정일, confidence, 팀 페이지, 출처

## 9. 데이터 바인딩
- 월간 발매 수: `releases.json` month filter
- 예정 컴백 수: `upcomingCandidates.json` month filter
- 가장 가까운 일정: filtered upcoming 중 earliest
- 날짜 셀 배지: releases/upcoming grouped by iso day
- verified row artwork: optional `releaseArtwork.json`

## 10. 상태 매트릭스
| 상태 | 헤더 | 캘린더 | 시트 | 리스트 모드 |
|---|---|---|---|---|
| Default | 월/요약 표시 | 정상 셀 | 섹션 분리 | 카드 목록 |
| Loading | skeleton | placeholder 셀 허용 | skeleton row | skeleton cards |
| Empty Month | 0값 표시 | 빈 월 | empty day만 가능 | empty message |
| Empty Day | 유지 | 선택 가능 | `등록된 일정이 없습니다` | 영향 없음 |
| Partial Data | 유지 | 배지 일부만 노출 | 누락 필드 숨김 | fallback 허용 |
| Error | retry CTA | 최소 월 프레임 유지 | 시트 미오픈 또는 오류 | retry |

## 11. 애니메이션
- 월 이동: 가벼운 fade/slide
- 날짜 선택: 셀 강조 transition
- bottom sheet: 기본 open/close transition
- 요약 바 숫자 변화는 과장 애니메이션 금지

## 12. 상세 요구사항
- 캘린더는 첫 진입 시 현재 월 기준으로 시작한다.
- `리스트` 모드로 전환해도 월 컨텍스트는 유지된다.
- 필터 시트에서 적용한 조건은 캘린더와 리스트 모드 모두에 반영된다.
- 날짜 상세 시트는 별도 페이지로 대체하면 안 된다.

## 13. QA 핵심 포인트
- 날짜 탭 -> sheet 오픈 -> 팀 상세 이동 흐름 확인
- empty day, multi-item day, partial-data day 확인
- `캘린더/리스트` 전환 시 월 상태 유지 확인
