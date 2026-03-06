# Accessibility Reading Order Spec

## 1. 목적
이 문서는 VoiceOver/TalkBack 기준으로 화면별 읽기 순서와 라벨 정책을 정의한다.
보이는 레이아웃이 합리적이어도 스크린리더 순서가 어긋나면 실제 사용성은 크게 나빠진다.

## 2. 공통 원칙
- 시각 순서와 읽기 순서를 최대한 일치시킨다.
- 팀 배지와 팀명은 하나의 의미 단위로 읽히게 묶는다.
- 칩 그룹은 읽기 전용이며 버튼으로 인식되면 안 된다.
- 서비스 버튼은 `Spotify에서 열기`, `YouTube Music에서 열기`, `YouTube MV 보기`처럼 목적이 드러나야 한다.

## 3. Calendar Screen
### 3.1 상단 헤더 순서
1. 현재 월 제목
2. 이전 월 버튼
3. 다음 월 버튼
4. 검색 버튼
5. 필터 버튼
6. 세그먼트 탭

### 3.2 Day Cell 라벨
- 형식: `4월 13일, 예정 2건, 확정 발매 1건`
- 선택된 셀은 `선택됨` 상태를 추가로 읽는다.

### 3.3 Date Detail Sheet 순서
1. sheet 제목
2. 닫기 버튼
3. 요약 카운트
4. verified release 섹션
5. scheduled comeback 섹션
6. 각 row의 primary action
7. 각 row의 service actions
8. source/meta actions

## 4. Radar Screen
### 4.1 Featured card 순서
1. 섹션 제목
2. D-day 라벨
3. 팀명
4. 예정일
5. 상태/신뢰도
6. 팀 페이지 버튼
7. source 링크

### 4.2 리스트 카드 순서
- 팀명 -> 핵심 상태 -> 날짜 -> primary CTA -> meta CTA 순으로 읽힌다.

## 5. Search Screen
### 5.1 상단 순서
1. 검색 입력창
2. 결과 세그먼트
3. 최근 검색 리스트
4. 결과 리스트

### 5.2 결과 row 라벨
- 팀 row: `팀, 트와이스, 팀 페이지 열기`
- release row: `발매, DEADLINE, BLACKPINK, 2026년 2월 27일`
- upcoming row: `예정, TOMORROW X TOGETHER, 2026년 4월 13일, 확정`

## 6. Team Detail Screen
### 6.1 헤더 순서
1. 뒤로 가기
2. 팀명
3. 소속사
4. 공식 링크 그룹

### 6.2 본문 순서
1. 다음 컴백 카드
2. 최신 발매 카드
3. 최근 앨범 캐러셀
4. 추가 메타/타임라인

## 7. Release Detail Screen
### 7.1 헤더 순서
1. 뒤로 가기
2. 커버 이미지 설명
3. 앨범명
4. 발매일/형식
5. 앨범 레벨 서비스 버튼 그룹

### 7.2 Track Row 라벨
- 형식: `1번 트랙, Whiplash, 타이틀곡, Spotify에서 열기, YouTube Music에서 열기`
- 더블 타이틀도 동일하게 `타이틀곡`을 읽는다.

### 7.3 MV block
- `공식 뮤직비디오` 제목 후, 재생 영역 또는 외부 열기 버튼 순서

## 8. QA 체크포인트
- 시각 순서와 스크린리더 순서가 어긋나지 않아야 한다.
- 아이콘-only 버튼은 목적어 포함 라벨을 가져야 한다.
- 캐러셀, 시트, 세그먼트 전환 시 포커스 이동이 예측 가능해야 한다.
