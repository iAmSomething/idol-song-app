# State Restoration Spec

## 1. 목적
이 문서는 모바일 앱에서 탭 전환, 뒤로 가기, 외부 앱 복귀, 시트 닫힘 이후 어떤 UI 상태를 복원해야 하는지 정의한다.

## 2. 복원 우선순위
1. 현재 탭
2. 현재 월 또는 현재 검색 query
3. 선택된 날짜 또는 선택된 세그먼트
4. 상세 화면 진입 전 스크롤 위치
5. 보조 필터 상태

## 3. Calendar
- 현재 월은 탭 이탈 후 복원되어야 한다.
- 선택된 날짜는 Date Detail Sheet가 닫혀도 유지될 수 있다.
- 캘린더/리스트 세그먼트 상태는 탭 전환 후 유지되어야 한다.
- external handoff 후 돌아오면 기존 선택 날짜와 월 컨텍스트가 보존되어야 한다.

## 4. Search
- query는 탭 전환 후 유지되어야 한다.
- active segment(`팀/발매/예정`)는 유지되어야 한다.
- 결과 리스트 scroll position은 같은 세션 내 복원 가능하면 유지한다.

## 5. Radar
- active filter 또는 섹션 스크롤 맥락을 잃지 않아야 한다.
- external handoff 후 복귀 시 기존 카드 목록 위치를 유지한다.
- applied filter(`status`, `actType`, `sections`)는 route state로 복원된다.
- Filter Sheet draft state는 apply 전까지만 임시 상태이며, close/backdrop dismiss 시 폐기된다.

## 6. Team Detail / Release Detail
- back 시 이전 화면 scroll 위치를 복원해야 한다.
- Team Detail에서 Release Detail로 갔다가 back 하면 Team Detail의 최근 앨범 캐러셀/스크롤 문맥이 유지되어야 한다.
- invalid route direct entry는 복원 대상이 아니라 safe fallback 대상이다.

## 7. 시트 상태
- Date Detail Sheet는 닫은 뒤에도 선택 날짜를 유지할 수 있다.
- Filter Sheet는 apply 전 임시 상태와 apply 후 확정 상태를 구분한다.
- 언어/설정 시트는 변경 즉시 반영되더라도 원래 화면 컨텍스트는 유지한다.

## 8. 비범위
- 앱 강제 종료 후 완전한 세션 복구
- 모든 캐러셀/리스트의 세밀한 픽셀 단위 복원

## 9. QA 체크포인트
- Team Detail -> Release Detail -> Back에서 스크롤 복원이 자연스러워야 한다.
- Calendar에서 external handoff 후 복귀 시 월/선택 날짜가 유지되어야 한다.
- Search query와 세그먼트가 탭 전환 후 사라지면 안 된다.
