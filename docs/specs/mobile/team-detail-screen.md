# Team Detail Screen Spec

## 1. 화면 목적
팀 상세 화면은 팬페이지가 아니라 `컴백 추적 + 최신 발매 허브`다.
사용자는 이 화면에서 해당 팀의 다음 컴백, 최신 발매, 최근 앨범을 빠르게 파악하고 앨범 상세나 외부 음악 서비스로 이동한다.

## 2. 진입 경로
- 캘린더 상세
- 레이더 카드
- 검색 결과
- 월간 리스트/대시보드 카드

## 3. 이탈 경로
- 뒤로 가기
- 앨범/릴리즈 상세 push
- 외부 서비스 이동
- 공식 링크 이동

## 4. 레이아웃 구조

### 4.1 App Bar
- 좌측: Back Button
- 중앙/좌측: 팀명 또는 화면 제목
- 우측: v1에서 별도 공유/설정 버튼 없음

### 4.2 Team Hero
- 앱 바 아래 첫 블록
- 대표 이미지
- 팀명
- 소속사
- 공식 링크 그룹

### 4.3 본문 순서
1. `다음 컴백`
2. `최신 발매`
3. `최근 앨범들`
4. 후속 확장 영역(optional)

## 5. 배치 계약
- Back Button은 safe area 기준 좌상단 고정이다.
- 공식 링크 그룹은 Hero 하단 별도 줄로 둔다.
- 다음 컴백 섹션은 항상 최신 발매보다 위에 위치해야 한다.
- 최신 발매 카드의 `상세 보기`는 카드 하단 첫 번째 CTA다.
- Service 그룹은 Primary 버튼 옆 또는 바로 아래 두 번째 줄에 둔다.
- 최근 앨범 캐러셀 카드는 카드 전체 탭을 Primary로 본다.

## 6. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| Header | Back Button | 상단 좌측 | 필수 | 이전 화면 복귀 |
| Header | Team Hero | 상단 | 필수 | 없음 |
| Header | Official Link Group | Hero 하단 | 조건부 | 외부 이동 |
| Section | Next Comeback Card | 본문 1순위 | 조건부 | source 또는 관련 상세 |
| Section | Latest Release Card | 본문 2순위 | 필수 | Release Detail push |
| Section | Recent Album Carousel | 본문 3순위 | 조건부 | 카드 탭 시 Release Detail push |

## 7. 섹션 명세

### 7.1 다음 컴백 카드
- 정보: 날짜/D-day, 상태, 출처, confidence(optional)
- 액션: source(Meta), optional 관련 상세
- empty copy: `등록된 예정 컴백이 없습니다.`

### 7.2 최신 발매 카드
- 정보: 커버, 릴리즈명, 발매일, 형식
- 액션 순서:
  1. `상세 보기`(Primary)
  2. Spotify / YouTube Music / MV(Service)
  3. 출처(Meta, optional)

### 7.3 최근 앨범 캐러셀
- 카드 요소: 커버, 릴리즈명, 발매일, 형식 칩
- 액션: 카드 전체 탭 시 Release Detail push
- 카드가 1개면 단일 카드 렌더 허용

## 8. 데이터 바인딩
- 헤더: `artistProfiles.json`
- 다음 컴백: group 기준 earliest upcoming
- 최신 발매: `releases.json` 또는 `watchlist.json` 기반 latest release
- 최근 앨범: group releases filtered by album stream
- 커버: `releaseArtwork.json`

## 9. 상태 매트릭스
| 상태 | 헤더 | 다음 컴백 | 최신 발매 | 최근 앨범 |
|---|---|---|---|---|
| Default | 정상 | 있으면 카드 | 카드 | 캐러셀 |
| Loading | skeleton | skeleton | skeleton | skeleton |
| No Upcoming | 정상 | empty copy | 카드 유지 | 유지 |
| No Albums | 정상 | 유지 | 카드 유지 | empty copy |
| Partial Data | placeholder image | confidence 숨김 | 일부 링크 fallback | 일부 카드만 |
| Error | retry + back | 숨김 가능 | 숨김 가능 | 숨김 가능 |

## 10. Empty/Partial 규칙
- 다음 컴백이 없으면 섹션 자체를 숨기지 않고 empty copy를 표시한다.
- 공식 링크가 일부만 있으면 존재하는 링크만 노출하고 정렬을 유지한다.
- 최신 발매에 커버가 없으면 placeholder cover를 사용하되 카드 레이아웃은 유지한다.

## 11. 캐러셀 규칙
- 최근 앨범이 1개면 캐러셀 대신 단일 카드 렌더를 허용한다.
- 최근 앨범이 2개 이상이면 가로 스크롤 캐러셀을 사용한다.
- 캐러셀 인디케이터는 v1에서 필수 아님.

## 12. 애니메이션
- 화면 push 기본 전환
- 캐러셀 자체는 기본 스크롤
- 최신 발매 카드 hover류 모션 없음, press feedback만

## 13. 상세 요구사항
- 첫 화면에서 `다음 컴백 -> 최신 발매 -> 최근 앨범들` 순서가 유지되어야 한다.
- 공식 링크 그룹은 서비스 CTA보다 약해야 한다.
- 최신 발매 카드는 팀 상세의 가장 강한 실제 액션 허브 역할을 해야 한다.

## 14. QA 핵심 포인트
- 공식 링크 일부 누락
- 최근 앨범 없는 팀
- 예정 컴백 없는 팀
- 최신 발매 서비스 액션 동작
- 카드 내 CTA 위계가 일관적인지 확인
