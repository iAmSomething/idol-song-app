# User Journey Sequences

## 1. 목적
이 문서는 실제 사용자 흐름을 step-by-step sequence로 정의한다.
화면 스펙과 인터랙션 매트릭스가 개별 동작을 설명한다면, 이 문서는 여러 화면을 걸치는 end-to-end 흐름을 설명한다.

## 2. Journey A: 날짜에서 바로 듣기

### 목표
사용자가 월간 캘린더에서 특정 날짜의 발매를 보고 바로 외부 서비스로 이동한다.

### Preconditions
- 현재 월에 발매가 있는 날짜가 존재
- release service URL 또는 search fallback 생성 가능

### Main Flow
1. Calendar 탭 진입
2. 특정 날짜 셀 탭
3. Date Detail Sheet 오픈
4. Verified release row 확인
5. Spotify 또는 YouTube Music 버튼 탭
6. 외부 앱 또는 브라우저 오픈

### Alternate Flow
- canonical URL 없음 -> search fallback 오픈
- 두 서비스 모두 없음 -> service button 비노출

### Postconditions
- 앱 복귀 시 Calendar 월/선택 상태 유지

## 3. Journey B: 예정 컴백에서 팀 허브로 이동

### 목표
사용자가 다가오는 컴백 신호를 보고 팀 상세로 이동해 최신 발매와 최근 앨범까지 확인한다.

### Main Flow
1. Radar 탭 진입
2. Featured 또는 Weekly card 탭
3. Team Detail 진입
4. 다음 컴백 섹션 확인
5. 최신 발매 카드 확인
6. 필요 시 Release Detail 진입

### Alternate Flow
- 예정 컴백 없음 -> empty state 확인
- confidence 없음 -> confidence chip 숨김

## 4. Journey C: 별칭 검색 후 릴리즈 상세 진입

### 목표
사용자가 별칭으로 검색해서 원하는 릴리즈 상세까지 들어간다.

### Main Flow
1. Search 탭 진입
2. `투바투` 같은 alias 입력
3. `발매` 세그먼트 전환
4. Release row 탭
5. Release Detail 진입

### Alternate Flow
- team 결과만 존재 -> Team Detail로 진입
- no result -> empty copy 노출

## 5. Journey D: 팀 상세에서 수록곡 단위 이동

### 목표
사용자가 팀 상세에서 앨범 상세로 이동한 뒤 수록곡 단위로 서비스 이동한다.

### Main Flow
1. Team Detail 진입
2. 최근 앨범 카드 탭
3. Release Detail 진입
4. Track Row 확인
5. 특정 트랙의 Spotify 또는 YouTube Music 버튼 탭
6. 외부 앱 이동

### Alternate Flow
- 트랙 canonical 링크 없음 -> search fallback
- MV 없음 -> MV block 숨김

## 6. Journey E: 필터 적용 후 결과 재탐색

### 목표
사용자가 필터로 월간/레이더 결과를 좁혀 재탐색한다.

### Main Flow
1. Calendar 또는 Radar에서 Filter 버튼 탭
2. Filter Sheet 오픈
3. 옵션 토글
4. Apply 탭
5. 대상 화면 결과 재계산

### Alternate Flow
- Dismiss without apply -> 기존 상태 유지
- 필터 결과 0건 -> empty state 노출

## 7. QA 포인트
- 각 journey는 main flow와 alternate flow 모두 통과해야 한다.
- push/pop 이후 원래 화면 상태가 유지되어야 한다.
- external open 후 복귀 시 컨텍스트 유실이 없어야 한다.
