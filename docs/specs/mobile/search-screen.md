# Search Screen Spec

## 1. 화면 목적
검색 화면은 팀, 발매, 예정 정보를 한글명/약칭/공식명 기준으로 빠르게 찾는 통합 탐색 화면이다.
핵심은 alias 검색과 결과 분류(`팀`, `발매`, `예정`)다.

## 2. 진입 경로
- 하단 탭 `검색`
- 캘린더/레이더에서 검색 버튼 탭

## 3. 이탈 경로
- 팀 상세 push
- 앨범/릴리즈 상세 push
- 외부 출처 이동
- 탭 전환

## 4. 레이아웃 구조
### 4.1 상단 검색 영역
- 검색 입력창
- clear 버튼
- 필요 시 최근 검색 삭제 버튼

### 4.2 결과 세그먼트
- `팀`
- `발매`
- `예정`
- 기본값: `팀`

### 4.3 본문
- 검색어 없을 때: 최근 검색 + 추천 팀(optional)
- 검색어 있을 때: 결과 리스트

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| Header | Search Input | 상단 고정 | 필수 | 입력 focus |
| Header | Clear Button | 입력 우측 | 조건부 | 검색어 초기화 |
| Segment | Result Tabs | 검색창 아래 | 필수 | 팀/발매/예정 전환 |
| Body | Recent Search List | 검색어 없을 때 | 조건부 | 검색어 재실행 |
| Body | Team Result Row | 결과 영역 | 조건부 | Team Detail push |
| Body | Release Result Row | 결과 영역 | 조건부 | Team/Release Detail push |
| Body | Upcoming Result Row | 결과 영역 | 조건부 | Team Detail push |

## 6. 검색 규칙
### 6.1 대상
- 공식 그룹명
- display name
- aliases
- search aliases
- 최신 곡명
- 최신 앨범명
- 예정 headline

### 6.2 정규화
- lower-case
- 공백 축약/제거
- 특수문자 제거
- `X/x/×` 혼용 흡수

### 6.3 제외
- fuzzy search
- 초성 검색
- 자동완성 고도화

## 7. 결과 Row 규칙
### 7.1 Team Result Row
- 좌측: 팀 배지
- 본문: 팀명, optional 보조 정보(소속사/최근 발매)
- 액션: 탭 전체가 Team Detail push

### 7.2 Release Result Row
- 좌측: 커버(optional)
- 본문: 팀명, 릴리즈명, 발매일, 형식
- 액션: 행 탭 시 Release Detail 또는 Team Detail
- 서비스 버튼은 행 우측 또는 2차 액션 영역

### 7.3 Upcoming Result Row
- 좌측: 팀 배지
- 본문: 예정명/headline, 예정일, 상태, source
- 액션: 행 탭 시 Team Detail
- 기사 링크는 Meta

## 8. 데이터 바인딩
- 팀 결과: `artistProfiles` 기반 derived model
- 발매 결과: `releases`
- 예정 결과: `upcomingCandidates`
- 정규화 유틸: shared search utility

## 9. 상태 매트릭스
| 상태 | 검색창 | 결과 | 세그먼트 |
|---|---|---|---|
| Default | focus 가능 | 최근 검색 | 팀 기본 |
| Searching | 입력 유지 | loading state | 유지 |
| No Result | 입력 유지 | no-result copy | 전환 가능 |
| Partial Result | 입력 유지 | 일부 세그먼트만 결과 | 전환 가능 |
| Error | 입력 유지 | retry | 유지 |

## 10. 애니메이션
- 세그먼트 전환 fade 정도
- 키보드 open/close 시 레이아웃 깨짐 금지
- 검색 결과 등장에 과도한 모션 없음

## 11. 상세 요구사항
- `투바투`, `트와이스`, `블핑` 같은 alias가 작동해야 한다.
- `팀` 결과의 주 CTA는 항상 Team Detail이다.
- 발매 결과는 팀 또는 릴리즈 상세로 일관되게 이동해야 한다.

## 12. QA 핵심 포인트
- 한글 alias / 영문 약칭 / 공식명 검색
- no-result, partial-result
- 최근 검색 재실행 동작
