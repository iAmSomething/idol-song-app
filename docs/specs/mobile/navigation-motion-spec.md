# Navigation and Motion Spec

## 1. 목적
이 문서는 모바일 앱의 전역 내비게이션 계약과 모션 규칙을 정의한다.
화면 간 이동이 일관되지 않으면 캘린더/레이더/검색/상세 흐름이 무너지므로, 각 화면 문서는 이 문서를 공통 규칙으로 참조한다.

## 2. 네비게이션 스택 구조

### 2.1 Root Tabs
1. Calendar
2. Radar
3. Search

### 2.2 Stack Screens
1. Team Detail
2. Release Detail

### 2.3 Global Sheets
1. Date Detail Sheet
2. Filter Sheet
3. Language/Settings Sheet

## 3. 이동 타입

### 3.1 Tab Switch
- 대상: Calendar / Radar / Search
- 목적: 최상위 탐색 맥락 전환
- 상태 보존: 유지
- 애니메이션: 기본 탭 전환

### 3.2 Push Navigation
- 대상: Team Detail, Release Detail
- 목적: 맥락 심화
- 뒤로 가기: 이전 화면 상태 복원
- 애니메이션: 기본 네이티브 push

### 3.3 Bottom Sheet
- 대상: Date Detail, Filter
- 목적: 현재 맥락을 유지한 drill-in
- 배경: dim 처리
- 닫기: swipe down, background tap, explicit close(optional)
- 애니메이션: 기본 sheet open/close

### 3.4 External Open
- 대상: Spotify, YouTube Music, YouTube MV, 기사 원문, 공식 공지
- 목적: 서비스/출처 외부 이동
- 복귀: OS/browser 기준
- 앱 내 상태 보존: 유지

## 4. 화면 간 이동 계약

### 4.1 Calendar -> Date Detail Sheet
- 트리거: 날짜 셀 탭
- 결과: 선택 날짜 갱신 + sheet open
- 금지: 별도 페이지 이동

### 4.2 Calendar -> Team Detail
- 트리거: 날짜 상세 행의 Primary CTA
- 결과: push to Team Detail

### 4.3 Team Detail -> Release Detail
- 트리거: 최신 발매 카드, 최근 앨범 카드 탭
- 결과: push to Release Detail

### 4.4 Search -> Team Detail / Release Detail
- 팀 결과: Team Detail push
- 발매 결과: Team Detail 또는 Release Detail push
- 예정 결과: Team Detail push

### 4.5 Radar -> Team Detail
- 레이더 카드는 기본적으로 Team Detail push

## 5. 뒤로 가기 규칙

### 5.1 Push Screen
- 직전 화면의 스크롤 위치와 선택 상태를 유지해야 한다.
- 예: Team Detail에서 뒤로 가면 Calendar 탭의 월/선택 날짜 상태 유지

### 5.2 Bottom Sheet
- 닫으면 underlying screen 상태 그대로 유지
- 시트 안에서 별도 stack을 열지 않음

## 6. 딥링크 고려 사항
- v1에서 필수 구현은 아님
- 장기적으로 지원할 후보:
  - `app://calendar?month=2026-04`
  - `app://artists/tomorrow-x-together`
  - `app://releases/tomorrow-x-together/deadline-2026-02-27`

## 7. 모션 원칙

### 7.1 허용
- 기본 push/pop
- bottom sheet open/close
- short fade/translate on content change
- subtle press feedback

### 7.2 금지
- 과한 spring/bounce
- 화면 진입마다 다른 전환 규칙
- 서비스 버튼 개별 과장 모션

### 7.3 타이밍 원칙
- 탭/버튼 press feedback: 매우 짧게
- sheet: 명확하고 예측 가능하게
- long blocking transition 금지

## 8. 상태 복원
- 탭 상태 유지
- 월 유지
- 필터 유지
- 검색어 유지(동일 세션)
- 시트는 복귀 시 자동 재오픈하지 않음

## 9. 수용 기준
- 모든 상세 이동은 push, 모든 날짜 drill-in은 sheet로 일관된다.
- 뒤로 가기 시 사용자가 보고 있던 월/검색 상태가 유지된다.
- 모션이 정보 탐색을 방해하지 않는다.
