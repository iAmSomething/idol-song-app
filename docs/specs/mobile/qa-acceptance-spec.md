# Mobile QA Acceptance Spec

## 1. 목적
이 문서는 모바일 구현 이후 QA가 검증해야 할 핵심 시나리오, 회귀 포인트, 합격 기준을 정의한다.

## 2. 공통 검증 항목
1. 탭 전환 상태 유지
2. 뒤로 가기 상태 복원
3. 서비스 액션 외부 이동
4. 링크 누락 fallback
5. 이미지 누락 placeholder
6. 칩과 버튼 혼동 없음
7. 최소 터치 영역 확보
8. 한국어/영어 전환 시 구조 유지
9. Dynamic Type 확대 시 레이아웃 붕괴 없음
10. 스크린리더 라벨이 아이콘 버튼에 제공됨

## 3. 시나리오 기반 검증

### QA-UC-01 Calendar Drill-in
전제:
- 발매/예정이 있는 날짜 존재

절차:
1. 캘린더 탭 진입
2. 날짜 셀 탭
3. Date Detail Sheet 오픈 확인
4. Verified/Scheduled 섹션 분리 확인
5. `팀 페이지` 탭
6. Team Detail 진입 후 back

기대 결과:
- sheet가 열리고 날짜 헤더가 보인다.
- back 후 동일 월/선택 상태가 유지된다.

### QA-UC-02 Empty Day
전제:
- 발매/예정이 없는 날짜 존재

절차:
1. 빈 날짜 셀 탭

기대 결과:
- sheet는 열릴 수 있다.
- `이 날짜에는 등록된 일정이 없습니다.` 문구가 보인다.
- 레이아웃이 깨지지 않는다.

### QA-UC-03 Alias Search
전제:
- alias dataset 포함

절차:
1. 검색 탭 진입
2. `투바투`, `트와이스`, `블핑` 순서로 검색
3. 세그먼트 전환

기대 결과:
- 팀/발매/예정 결과가 기대 범위 내에서 반환된다.
- 검색어는 세그먼트 전환 후에도 유지된다.

### QA-UC-04 Team Detail Hub
전제:
- 예정 컴백이 있는 팀과 없는 팀 각각 존재

절차:
1. Team Detail 진입
2. 섹션 순서 확인
3. 최신 발매 `상세 보기` 탭
4. back 후 최근 앨범 캐러셀 확인

기대 결과:
- `다음 컴백 -> 최신 발매 -> 최근 앨범들` 순서 유지
- 최신 발매 CTA가 가장 강하게 보인다.

### QA-UC-05 Release Detail Consumption
전제:
- 트랙 리스트와 MV가 있는 릴리즈 존재

절차:
1. Release Detail 진입
2. 앨범 레벨 서비스 버튼 확인
3. 타이틀/더블타이틀 표시 확인
4. 트랙별 Spotify/YouTube Music 버튼 탭
5. MV 영역 확인

기대 결과:
- 앨범 레벨과 트랙 레벨 액션이 구분된다.
- MV 없을 때 빈 영역이 생기지 않는다.

## 4. 화면별 체크리스트

### 4.1 Calendar Screen
1. 월 이동 가능
2. 날짜 탭 시 bottom sheet 오픈
3. Verified / Scheduled 섹션 분리
4. empty date 대응
5. list 모드 전환 정상
6. 필터 적용 후 결과 갱신
7. 서비스 버튼과 Meta 링크 시각 위계 확인

### 4.2 Radar Screen
1. Featured card 존재 여부
2. 이번 주 예정 리스트 정상
3. 장기 공백 / 루키 섹션 empty 대응
4. 팀 페이지 CTA 우선순위 확인
5. source 링크가 Primary처럼 보이지 않는지 확인

### 4.3 Search Screen
1. 공식명 검색
2. 한글 alias 검색
3. 약칭 검색
4. 결과 세그먼트 전환
5. no-result 대응
6. Release row 내 secondary service action 충돌 없음

### 4.4 Team Detail
1. 다음 컴백 > 최신 발매 > 최근 앨범 순서 유지
2. 최신 발매에서 상세/서비스 이동 가능
3. 공식 링크 누락 대응
4. 최근 앨범 가로 스크롤 정상
5. CTA 위계 일관성 확인

### 4.5 Release Detail
1. 앨범 레벨 서비스 액션 동작
2. 트랙 리스트 표시
3. 타이틀/더블타이틀 표시
4. 트랙별 Spotify / YouTube Music 링크 동작
5. MV 있음/없음 케이스 정상
6. cover missing fallback

## 5. 회귀 포인트
1. 월 상태 유실
2. 검색어 유실
3. 서비스 버튼이 일반 카드처럼 보이는 문제
4. Meta 링크가 Primary처럼 보이는 문제
5. bottom sheet 대신 페이지 이동되는 문제
6. 탭 전환 시 상태 초기화
7. back 후 스크롤 위치 유실

## 6. 접근성 회귀 포인트
1. 아이콘-only 버튼에 접근성 라벨 없음
2. Dynamic Type 확대 시 서비스 버튼 잘림
3. 상태 칩이 버튼처럼 읽힘
4. 대비 부족으로 텍스트 판독 어려움

## 7. 합격 기준
- 핵심 유스케이스 5종이 모두 동작해야 한다.
- Primary / Service / Meta 위계가 모든 화면에서 일관되어야 한다.
- partial data 상태에서 레이아웃이 깨지지 않아야 한다.
- 접근성 핵심 항목이 차단 이슈 없이 통과해야 한다.

## 8. 참조 문서
- 인터랙션 검증은 `interaction-matrix.md` 기준으로 수행한다.
- 데이터 예시 확인은 `sample-data-contracts.md` 기준으로 수행한다.
