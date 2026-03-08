# Calendar Screen Spec

## 1. 화면 목적
캘린더 화면은 월간 발매/예정 탐색의 기본 진입점이다.
사용자는 이 화면에서 `언제 무엇이 나오는지`를 날짜 중심으로 확인하고, 특정 날짜를 탭해 상세 정보와 액션으로 내려간다.

## 2. 진입 경로
- 앱 기본 진입 화면
- 하단 탭 `캘린더`

## 3. 이탈 경로
- Date Detail Sheet
- Team Detail push
- Release Detail push
- 서비스 외부 이동
- Search 탭 전환
- Radar 탭 전환

## 4. 레이아웃 구조

### 4.1 App Bar
- 좌측: 현재 월 텍스트
- 월 텍스트 인접: 이전 월 / 다음 월 버튼
- 우측: 검색 버튼, 필터 버튼, optional 언어/설정 버튼
- App Bar는 safe area 아래 첫 줄에 고정한다.

### 4.2 Monthly Summary Strip
- App Bar 바로 아래 단일 수평 스트립
- 항목 3개:
  - 이번 달 발매 수
  - 예정 컴백 수
  - 가장 가까운 일정
- 탭 동작 없음

### 4.3 View Toggle
- Summary 아래 전폭 배치
- `캘린더`
- `리스트`
- 기본값: `캘린더`

### 4.4 Calendar Grid
- 7열 월간 그리드
- 날짜 셀 내부:
  - 상단 좌측: 날짜 숫자
  - 하단 영역: 팀 배지 최대 2개
  - 초과 시 마지막 줄에 `+N`
- 날짜 셀에 들어가는 예정 컴백은 `exact date`가 있는 항목만 허용한다.
- 선택 셀은 같은 월 안에서 1개만 활성

### 4.5 Month-only Bucket
- 캘린더 그리드 바로 아래 월 컨텍스트 섹션
- 대상: `scheduled_month`는 있지만 `scheduled_date`는 없는 예정 신호
- 표현:
  - 팀 배지/팀명
  - headline
  - 상태 칩
  - `2026년 4월 · 날짜 미정` 같은 월 단위 라벨
  - Primary `팀 페이지`
  - Meta `기사/공식 공지`
- day cell이나 date detail sheet 안의 날짜별 row로 밀어 넣지 않는다.

### 4.6 List Mode
- 캘린더 그리드 위치를 카드 리스트가 대체
- 상단 월/필터/요약 컨텍스트는 유지
- `예정` 리스트는 `exact date`와 `month_only`를 분리해 보여주고, `month_only`에는 항상 `날짜 미정` 라벨을 붙인다.

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| App Bar | Month Title | 좌측 상단 | 필수 | 없음 |
| App Bar | Prev Month Button | Month Title 인접 | 필수 | 이전 월 이동 |
| App Bar | Next Month Button | Month Title 인접 | 필수 | 다음 월 이동 |
| App Bar | Search Button | 우측 상단 | 필수 | Search 탭 또는 검색 진입 |
| App Bar | Filter Button | Search Button 옆 | 필수 | Filter Sheet 오픈 |
| Summary | Monthly Summary Strip | App Bar 아래 | 필수 | 없음 |
| Segment | View Toggle | Summary 아래 | 필수 | 캘린더/리스트 전환 |
| Calendar | Day Cell | 그리드 본문 | 필수 | Date Detail Sheet 오픈 |
| Monthly Context | Month-only Bucket | Calendar 아래 | 조건부 | 각 행 액션 처리 |
| Sheet | Verified Section | Sheet 상단 | 조건부 | 각 행 액션 처리 |
| Sheet | Scheduled Section | Verified 아래 | 조건부 | 각 행 액션 처리 |

## 6. 버튼 위치 계약
- Prev/Next Month는 Month Title 좌우 인접 위치에만 둔다.
- Search와 Filter는 우상단 trailing group으로만 묶는다.
- Date Detail row의 Primary 버튼은 하단 첫 번째 CTA다.
- Service 버튼 그룹은 Primary 오른쪽 또는 다음 줄에 compact group으로 둔다.
- 기사/공식 공지 링크는 항상 마지막 줄 Meta 영역에 둔다.

## 7. 날짜 셀 규칙

### 7.1 기본
- 발매/예정 없는 날짜는 숫자만 표시
- 발매/예정 있는 날짜는 배지 노출
- 배지는 `공식 배지 -> 대표 이미지 크롭 -> 모노그램` 순서의 fallback 허용
- `month_only` 또는 `unknown` 예정 신호는 날짜 셀 배지 대상이 아니다.

### 7.2 선택 상태
- border + background + ring 중 최소 2개 이상 변화
- bottom sheet가 열려도 underlying grid에서 강조 상태를 유지한다.

### 7.3 탭 동작
- 해당 날짜를 선택
- Date Detail Sheet 오픈
- 시트 헤더에 날짜 표시

## 8. Date Detail Sheet

### 8.1 목적
- 선택 날짜의 전체 일정 drill-in

### 8.2 오픈/닫기
- 오픈: 날짜 셀 탭
- 닫기: 배경 탭, 아래로 스와이프, optional 닫기 버튼
- 기본 높이: 화면의 약 78%
- empty 상태 높이: 화면의 약 45%

### 8.3 시트 헤더
- 날짜 텍스트: `4월 13일 발매/컴백`
- 요약 수치: `발매 2 · 예정 1`

### 8.4 섹션 구성
1. `Verified releases`
2. `Scheduled comebacks`

### 8.4.a 제외 규칙
- Date Detail Sheet의 `Scheduled comebacks`에는 `exact date` 항목만 넣는다.
- `month_only` 항목은 sheet가 아니라 월 컨텍스트의 Month-only Bucket으로 보낸다.

### 8.5 Verified Release Row
- 좌측: 팀 배지 + 팀명
- 본문: 릴리즈명, 형식 칩, 발매일
- 하단 액션 순서:
  1. `팀 페이지`(Primary)
  2. `상세 보기`(Secondary)
  3. Spotify / YouTube Music / MV(Service)
  4. 출처 링크(Meta)

### 8.6 Scheduled Comeback Row
- 좌측: 팀 배지 + 팀명
- 본문: 예정명 또는 headline 요약, 상태 칩, 예정일, confidence(optional)
- meta action은 backend payload의 `source_url`을 그대로 사용한다.
- `scheduled_month`는 `YYYY-MM` month context만 신뢰하고, month-only row는 `월 라벨 + 날짜 미정`으로 렌더링한다.
- 하단 액션 순서:
  1. `팀 페이지`(Primary)
  2. 기사/공식 공지(Meta)

## 9. 리스트 모드

### 9.1 목적
- 현재 월 전체를 카드형으로 스캔

### 9.2 세그먼트
- `발매`
- `예정`

### 9.3 카드 규칙
- 발매 카드: 팀명, 릴리즈명, 대표곡(optional), 형식, 발매일, 상세/서비스 액션
- 예정 카드: 팀명, 예정명, 상태, 예정일, confidence, 팀 페이지, 출처
- `month_only` 예정 카드는 예정일 대신 `월 라벨 + 날짜 미정`을 표시한다.

## 10. 데이터 바인딩
- 월간 발매 수: `releases.json` month filter
- 예정 컴백 수: `upcomingCandidates.json` month filter
- 가장 가까운 일정: filtered upcoming 중 earliest `exact date`
- 날짜 셀 배지: releases + exact-date upcoming grouped by iso day
- month-only bucket: `upcomingCandidates.json` 중 `date_precision = month_only` and `scheduled_month = active month`
- verified row artwork: optional `releaseArtwork.json`

## 11. 상태 매트릭스
| 상태 | 헤더 | 캘린더 | 시트 | 리스트 모드 |
|---|---|---|---|---|
| Default | 월/요약 표시 | 정상 셀 | 섹션 분리 | 카드 목록 |
| Loading | skeleton | placeholder 셀 허용 | skeleton row | skeleton cards |
| Empty Month | 0값 표시 | 빈 월 | empty day만 가능 | empty message |
| Empty Day | 유지 | 선택 가능 | `이 날짜에는 등록된 일정이 없습니다.` | 영향 없음 |
| Partial Data | 유지 | 배지 일부만 노출 | 누락 필드 숨김 | fallback 허용 |
| Error | retry CTA | 최소 월 프레임 유지 | 시트 미오픈 또는 오류 | retry |

## 12. 문구 계약
- 월 제목은 `2026년 4월` 형식을 우선한다.
- Summary 라벨은 `이번 달 발매`, `예정 컴백`, `가장 가까운 일정`으로 고정한다.
- Empty Day 시트 문구는 `이 날짜에는 등록된 일정이 없습니다.`로 고정한다.
- `month_only` 라벨은 `2026년 4월 · 날짜 미정` 형식을 우선한다.

## 13. 제스처 계약
- 날짜 셀 탭은 sheet open만 수행한다.
- 날짜 셀 long press 액션은 두지 않는다.
- 리스트 카드 탭은 기본적으로 Team Detail 또는 Release Detail push로 연결한다.
- Filter 적용 후 현재 선택 날짜가 결과에서 완전히 사라지면 sheet를 닫는다.

## 14. 애니메이션
- 월 이동: 가벼운 fade/slide
- 날짜 선택: 셀 강조 transition
- bottom sheet: 기본 open/close transition
- 요약 바 숫자 변화는 과장 애니메이션 금지

## 15. 상세 요구사항
- 캘린더는 첫 진입 시 현재 월 기준으로 시작한다.
- `리스트` 모드로 전환해도 월 컨텍스트는 유지된다.
- 필터 시트에서 적용한 조건은 캘린더와 리스트 모드 모두에 반영된다.
- Date Detail Sheet는 별도 페이지로 대체하면 안 된다.

## 16. QA 핵심 포인트
- 날짜 탭 -> sheet 오픈 -> 팀 상세 이동 흐름 확인
- empty day, multi-item day, partial-data day 확인
- month-only만 있는 월에서 날짜 셀은 비어 있고, 별도 월 버킷에는 항목이 보이는지 확인
- `캘린더/리스트` 전환 시 월 상태 유지 확인
- 서비스 버튼과 Meta 링크가 시각적으로 구분되는지 확인
