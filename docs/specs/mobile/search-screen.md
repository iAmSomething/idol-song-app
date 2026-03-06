# Search Screen Spec

## 1. 화면 목적
검색 화면은 팀, 발매, 예정 정보를 한글명/약칭/공식명 기준으로 빠르게 찾는 통합 탐색 화면이다.
핵심은 alias 검색과 결과 분류(`팀`, `발매`, `예정`)다.

## 2. 진입 경로
- 하단 탭 `검색`
- 캘린더/레이더의 검색 버튼 탭

## 3. 이탈 경로
- Team Detail push
- Release Detail push
- 외부 출처 이동
- 탭 전환

## 4. 레이아웃 구조

### 4.1 Search Header
- 상단 고정 검색 입력창
- 입력창 내부 trailing: clear 버튼
- optional: 최근 검색 전체 삭제 버튼

### 4.2 Result Segment
- 검색창 아래 고정
- `팀`
- `발매`
- `예정`
- 기본값: `팀`

### 4.3 Body
- 검색어 없을 때:
  - 최근 검색
  - 추천 팀(optional)
- 검색어 있을 때:
  - 결과 리스트
- 키보드 open/close 시 레이아웃이 깨지면 안 된다.

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| Header | Search Input | 상단 고정 | 필수 | focus / 입력 |
| Header | Clear Button | 입력 우측 | 조건부 | 검색어 초기화 |
| Header | Clear History Button | 헤더 또는 최근 검색 섹션 | 선택 | 최근 검색 삭제 |
| Segment | Result Tabs | 검색창 아래 | 필수 | 팀/발매/예정 전환 |
| Body | Recent Search List | 검색어 없을 때 | 조건부 | 검색어 재실행 |
| Body | Team Result Row | 결과 영역 | 조건부 | Team Detail push |
| Body | Release Result Row | 결과 영역 | 조건부 | Release Detail push |
| Body | Upcoming Result Row | 결과 영역 | 조건부 | Team Detail push |

## 6. 검색 규칙

### 6.1 검색 대상
- 공식 그룹명
- display name
- aliases
- search aliases
- 최신 곡명
- 최신 앨범명
- 예정 headline
- 예정명/릴리즈명(optional if available)

### 6.2 정규화
- lower-case
- 공백 축약/제거
- 특수문자 제거
- `X/x/×` 혼용 흡수

### 6.3 비범위
- fuzzy search
- 초성 검색
- 자동완성 고도화

## 7. 결과 정렬 규칙
- 팀 결과 우선순위:
  1. display name exact match
  2. search alias exact match
  3. alias partial match
  4. 일반 partial match
- 발매 결과 우선순위:
  1. release title exact match
  2. team name exact match + latest release
  3. partial match
- 예정 결과 우선순위:
  1. exact team/alias match
  2. headline exact token match
  3. partial match

## 8. 결과 Row 규칙

### 8.1 Team Result Row
- 좌측: 팀 배지
- 본문: 팀명, optional 보조 정보(소속사/최근 발매)
- 액션: 행 전체가 Team Detail push
- trailing secondary CTA는 v1에서 두지 않음

### 8.2 Release Result Row
- 좌측: 커버(optional)
- 본문: 팀명, 릴리즈명, 발매일, 형식
- 액션:
  1. 행 전체 탭: Release Detail push
  2. optional service group: compact secondary action
- Service 버튼은 행 전체 tap target과 충돌하면 안 된다.

### 8.3 Upcoming Result Row
- 좌측: 팀 배지
- 본문: 예정명/headline, 예정일, 상태, source summary
- 액션:
  1. 행 전체 탭: Team Detail push
  2. source 링크: Meta external open

## 9. 최근 검색 규칙
- 최근 검색은 동일 세션 유지가 기본
- 항목 탭 시 해당 검색어 재실행
- 삭제는 개별 삭제보다 `전체 삭제` 우선
- 최근 검색이 비어 있으면 추천 팀 또는 안내 문구 표시

## 10. 데이터 바인딩
- 팀 결과: `artistProfiles.json` 기반 derived team model
- 발매 결과: `releases.json`
- 예정 결과: `upcomingCandidates.json`
- 정규화 유틸: shared search utility
- 팀 배지/커버: `artistProfiles.json`, `releaseArtwork.json` fallback 사용

## 11. 상태 매트릭스
| 상태 | 검색창 | 결과 | 세그먼트 |
|---|---|---|---|
| Default | focus 가능 | 최근 검색 | 팀 기본 |
| Searching | 입력 유지 | loading state | 유지 |
| No Result | 입력 유지 | `검색 결과가 없습니다.` | 전환 가능 |
| Partial Result | 입력 유지 | 일부 세그먼트만 결과 | 전환 가능 |
| Error | 입력 유지 | retry | 유지 |

## 12. 문구 계약
- placeholder: `팀, 앨범, 곡, 별칭 검색`
- 탭 라벨: `팀`, `발매`, `예정`
- 최근 검색 제목: `최근 검색`
- no-result: `검색 결과가 없습니다.`

## 13. 키보드/포커스 규칙
- 검색 탭 진입 시 자동 포커스는 v1 필수 아님
- 입력 focus 시 세그먼트와 결과 레이아웃이 밀려도 구조가 깨지면 안 된다.
- clear 버튼 탭 시 검색어를 비우고 기본 상태로 복귀한다.

## 14. 애니메이션
- 세그먼트 전환 fade 정도
- 키보드 open/close 시 레이아웃 깨짐 금지
- 검색 결과 등장에 과도한 모션 없음

## 15. 상세 요구사항
- `투바투`, `트와이스`, `블핑` 같은 alias가 작동해야 한다.
- `팀` 결과의 주 CTA는 항상 Team Detail이다.
- 발매 결과는 Release Detail로 일관되게 이동해야 한다.
- 결과 리스트에서 서비스 버튼이 행 전체 탭 동작을 방해하면 안 된다.

## 16. QA 핵심 포인트
- 한글 alias / 영문 약칭 / 공식명 검색
- no-result, partial-result
- 최근 검색 재실행/전체 삭제 동작
- 결과 세그먼트 전환 시 검색어 유지 여부
- Release row 내 secondary service action 충돌 여부
