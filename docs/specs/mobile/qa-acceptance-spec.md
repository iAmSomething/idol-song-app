# Mobile QA Acceptance Spec

## 1. 목적
이 문서는 모바일 구현 이후 QA가 검증해야 할 핵심 시나리오와 회귀 포인트를 정의한다.

## 2. 공통 검증 항목
1. 탭 전환 상태 유지
2. 뒤로 가기 상태 복원
3. 서비스 액션 외부 이동
4. 링크 누락 fallback
5. 이미지 누락 placeholder
6. 칩과 버튼 혼동 없음
7. 최소 터치 영역 확보

## 3. Calendar Screen
1. 월 이동 가능
2. 날짜 탭 시 bottom sheet 오픈
3. Verified / Scheduled 섹션 분리
4. empty date 대응
5. list 모드 전환 정상
6. 필터 적용 후 결과 갱신

## 4. Radar Screen
1. 가장 가까운 컴백 표시
2. 이번 주 예정 리스트 정상
3. 장기 공백 / 루키 섹션 empty 대응
4. 팀 페이지 CTA 우선순위 확인

## 5. Search Screen
1. 공식명 검색
2. 한글 alias 검색
3. 약칭 검색
4. 결과 세그먼트 전환
5. no-result 대응

## 6. Team Detail
1. 다음 컴백 > 최신 발매 > 최근 앨범 순서 유지
2. 최신 발매에서 상세/서비스 이동 가능
3. 공식 링크 누락 대응
4. 최근 앨범 가로 스크롤 정상

## 7. Release Detail
1. 앨범 레벨 서비스 액션 동작
2. 트랙 리스트 표시
3. 타이틀/더블타이틀 표시
4. 트랙별 Spotify / YouTube Music 링크 동작
5. MV 있음/없음 케이스 정상

## 8. 회귀 포인트
1. 월 상태 유실
2. 검색어 유실
3. 서비스 버튼이 일반 카드처럼 보이는 문제
4. 메타 링크가 primary처럼 보이는 문제
5. bottom sheet 대신 페이지 이동되는 문제

## 9. 합격 기준
- 핵심 유스케이스 5종이 모두 동작해야 한다.
- primary/service/meta 위계가 모든 화면에서 일관되어야 한다.
- partial data 상태에서 레이아웃이 깨지지 않아야 한다.
