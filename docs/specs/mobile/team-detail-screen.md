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
### 4.1 상단 앱 바
- 뒤로 가기
- 화면 제목 또는 팀명
- optional 공유/설정은 v1 제외

### 4.2 헤더 영역
- 대표 이미지
- 팀명
- 소속사
- 공식 링크 그룹 (YouTube / X / Instagram)

### 4.3 본문 순서
1. `다음 컴백`
2. `최신 발매`
3. `최근 앨범들`
4. 후속 확장 영역(optional)

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| Header | Back Button | 상단 좌측 | 필수 | 이전 화면 복귀 |
| Header | Team Hero | 상단 | 필수 | 없음 |
| Header | Official Link Group | Hero 하단 | 조건부 | 외부 이동 |
| Section | Next Comeback Card | 본문 1순위 | 조건부 | 기사/공식 공지 또는 관련 상세 |
| Section | Latest Release Card | 본문 2순위 | 필수 | Release Detail push |
| Section | Recent Album Carousel | 본문 3순위 | 조건부 | 카드 탭 시 Release Detail push |

## 6. 섹션 명세
### 6.1 다음 컴백 카드
- 정보: 날짜/D-day, 상태, 출처, confidence(optional)
- 액션: source(Meta), optional 관련 상세
- empty copy: `등록된 예정 컴백이 없습니다`

### 6.2 최신 발매 카드
- 정보: 커버, 릴리즈명, 발매일, 형식
- 액션 배치:
  - Primary: `상세 보기`
  - Service: Spotify / YouTube Music / MV
  - Meta: 출처(optional)

### 6.3 최근 앨범 캐러셀
- 카드 요소: 커버, 릴리즈명, 발매일, 형식 칩
- 액션: 카드 전체 탭 시 Release Detail push

## 7. 데이터 바인딩
- 헤더: `artistProfiles`
- 다음 컴백: group 기준 earliest upcoming
- 최신 발매: derived latest release from releases/watchlist
- 최근 앨범: group releases filtered by album stream
- 커버: `releaseArtwork`

## 8. 상태 매트릭스
| 상태 | 헤더 | 다음 컴백 | 최신 발매 | 최근 앨범 |
|---|---|---|---|---|
| Default | 정상 | 있으면 카드 | 카드 | 캐러셀 |
| Loading | skeleton | skeleton | skeleton | skeleton |
| No Upcoming | 정상 | empty copy | 카드 유지 | 유지 |
| No Albums | 정상 | 유지 | 카드 유지 | empty copy |
| Partial Data | placeholder image | confidence 숨김 | 일부 링크 fallback | 일부 카드만 |
| Error | retry + back | 숨김 가능 | 숨김 가능 | 숨김 가능 |

## 9. 애니메이션
- 화면 push 기본 전환
- 캐러셀 자체는 기본 스크롤
- 최신 발매 카드 hover류 모션 없음, press feedback만

## 10. 상세 요구사항
- 첫 화면에서 `다음 컴백 -> 최신 발매 -> 최근 앨범들` 순서가 유지되어야 한다.
- 공식 링크 그룹은 서비스 CTA보다 약해야 한다.
- 최신 발매 카드가 팀 상세의 가장 강한 실제 액션 허브 역할을 해야 한다.

## 11. QA 핵심 포인트
- 공식 링크 일부 누락
- 최근 앨범 없는 팀
- 예정 컴백 없는 팀
- 최신 발매 서비스 액션 동작
