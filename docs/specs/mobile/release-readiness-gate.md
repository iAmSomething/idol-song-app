# Release Readiness Gate

## 1. 목적
이 문서는 모바일 MVP를 TestFlight/내부 배포 또는 스토어 심사 직전 단계로 올리기 위한 출시 게이트를 정의한다.

## 2. 제품 게이트
- Calendar, Search, Team Detail, Release Detail의 핵심 유스케이스가 동작해야 한다.
- Radar는 MVP 범위에 포함될 경우 최소 featured + weekly sections가 동작해야 한다.
- latest_song / latest_album 분리가 UI에 반영되어야 한다.

## 3. 데이터 게이트
- artistProfiles, releaseArtwork, releaseDetails의 최소 seed coverage가 확보되어야 한다.
- upcoming dedupe 규칙이 적용되어야 한다.
- search aliases 대표 케이스가 동작해야 한다.

## 4. UX 게이트
- 팀 페이지/상세/서비스 버튼의 액션 위계가 일관되어야 한다.
- chips가 버튼처럼 보이지 않아야 한다.
- loading/empty/error/partial state가 각 주요 화면에 존재해야 한다.

## 5. 접근성 게이트
- VoiceOver/TalkBack 기본 읽기 순서 검증 통과
- Dynamic Type 확대 시 핵심 CTA 유지
- 최소 터치 영역 충족

## 6. 플랫폼 게이트
- iOS handoff 정상
- Android handoff 정상
- bottom sheet gesture 정상
- back navigation과 상태 복원 정상

## 7. 테스트 게이트
- selector unit test 통과
- 핵심 shared component test 통과
- screen smoke 통과
- manual QA checklist 통과

## 8. 운영 게이트
- data freshness 전략이 문서 기준으로 이해 가능해야 한다.
- analytics event naming과 privacy 정책이 충돌하지 않아야 한다.
- crash/blocked link를 유발하는 known issue가 없어야 한다.

## 9. 출시 차단 조건
- primary CTA가 missing data 때문에 사라지는 경우
- alias 검색 핵심 케이스 실패
- external handoff 다수 실패
- sheet나 navigation이 컨텍스트를 잃는 경우
- 접근성 기본 게이트 실패
