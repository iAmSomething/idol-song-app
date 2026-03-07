# Release Detail Screen Spec

## 1. 화면 목적
앨범/릴리즈 상세 화면은 가장 구체적인 소비 화면이다.
사용자는 이 화면에서 발매 메타, 앨범 레벨 액션, 트랙 리스트, MV를 확인하고 곡 단위로 외부 서비스로 이동한다.

## 2. 진입 경로
- 팀 상세의 최신 발매
- 팀 상세의 최근 앨범 카드
- 캘린더 상세/검색 결과의 상세 액션

## 3. 이탈 경로
- 뒤로 가기
- 외부 서비스 이동
- optional 팀 상세 복귀

## 4. 레이아웃 구조

### 4.1 App Bar
- 좌측: Back Button
- 중앙/좌측: 릴리즈명 또는 축약 제목

### 4.2 Header
- 커버 이미지
- 릴리즈명
- 발매일
- 형식 칩
- 팀명

### 4.3 Album-Level Action Area
- Spotify
- YouTube Music
- YouTube MV(optional)

### 4.4 Track List
- 트랙 번호
- 곡명
- 타이틀 표시
- 트랙별 서비스 액션

### 4.5 Supporting Info
- notes
- 크레딧(optional)
- 출처(optional)

### 4.6 MV Block
- `youtube_video_id` 또는 canonical `youtube_video_url`이 있으면 임베드 또는 바로가기
- 허용 URL: `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`
- 없으면 블록 전체 숨김
- `youtube_video_status`가 `needs_review`, `no_mv`, `unresolved`인 경우 MV 블록은 숨기고 misleading fallback을 만들지 않는다

## 5. 액션 배치 계약
- 앨범 레벨 서비스 버튼은 cover/meta 아래 첫 액션 블록이다.
- Spotify, YouTube Music, YouTube MV는 같은 높이의 service button group으로 배치한다.
- 트랙 row의 서비스 버튼은 행 우측 끝에 compact하게 배치한다.
- `타이틀` 표시는 트랙명 바로 우측에 chip 또는 inline badge로 둔다.
- notes/credits/source는 트랙 리스트 아래 Meta 블록으로 분리한다.

## 6. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| Header | Back Button | 상단 좌측 | 필수 | 이전 화면 복귀 |
| Header | Cover Image | 상단 | 필수 | 없음 |
| Header | Release Meta | Cover 아래 | 필수 | 없음 |
| Action | Album Service Group | Meta 아래 | 필수 | 외부 서비스 이동 |
| Body | Track Row | 본문 | 조건부 | 트랙별 서비스 이동 |
| Body | Notes Block | 트랙 아래 | 선택 | 없음 |
| Body | MV Block | notes 아래 | 선택 | 영상 보기 |

## 7. 트랙 리스트 규칙

### 7.1 필드
- `order`
- `title`
- `is_title_track`
- `spotify_url` optional
- `youtube_music_url` optional

### 7.2 타이틀곡 표시
- `★ 타이틀` 또는 타이틀 라벨 사용
- 더블타이틀이면 여러 트랙에 표시 가능

### 7.3 트랙 액션
- 각 행 우측에 Spotify / YouTube Music 버튼
- canonical URL 없으면 `group + track title` 검색 fallback

## 8. 데이터 바인딩
- 릴리즈 메타: `releaseDetails.json`
- 커버: `releaseArtwork.json`
- 트랙 리스트: `releaseDetails.tracks`
- MV: `releaseDetails.youtube_video_id` 또는 `releaseDetails.youtube_video_url`
- MV 상태: `releaseDetails.youtube_video_status`
- 팀 표기 fallback: `artistProfiles.display_name`

## 9. 상태 매트릭스
| 상태 | 헤더 | 앨범 액션 | 트랙 리스트 | MV |
|---|---|---|---|---|
| Default | 정상 | 정상 | 정상 | 있으면 노출 |
| Loading | skeleton | skeleton | skeleton rows | skeleton/숨김 |
| Empty Tracks | 정상 | 유지 | empty copy | 영향 없음 |
| Partial Data | placeholder cover | 일부 버튼만 | 일부 트랙 버튼 fallback | 숨김 |
| Error | back + retry | 숨김 가능 | 숨김 | 숨김 |

## 10. MV 규칙
- `youtube_video_id` 또는 canonical `youtube_video_url`이 있으면 MV 블록을 노출한다.
- autoplay는 금지한다.
- MV가 없으면 빈 placeholder를 두지 않고 블록 전체를 숨긴다.

## 11. 트랙 행 규칙
- 트랙 번호는 고정 폭으로 정렬한다.
- 곡명은 1~2줄 허용하되 버튼 영역을 밀어내면 안 된다.
- 트랙 링크가 하나만 있으면 해당 서비스 버튼만 노출한다.
- 링크가 모두 없으면 버튼 영역 대신 `링크 준비 중` 같은 텍스트를 두지 않는다.

## 12. 애니메이션
- 화면 push 기본 전환
- MV block fade-in 정도 허용
- 트랙 버튼 press feedback 짧게

## 13. 상세 요구사항
- 상세 화면의 가장 강한 CTA는 서비스 액션이다.
- 타이틀곡/더블타이틀 표시가 시각적으로 명확해야 한다.
- 앨범 레벨 액션과 트랙 레벨 액션은 혼동되지 않아야 한다.
- MV가 없을 때 공간이 어색하게 비면 안 된다.

## 14. QA 핵심 포인트
- 더블타이틀 케이스
- 트랙 링크 fallback
- MV 있음/없음
- cover missing fallback
- 앨범 레벨 액션과 트랙 레벨 액션이 시각적으로 분리되는지 확인
