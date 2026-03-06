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
### 4.1 상단 앱 바
- 뒤로 가기
- 릴리즈명 또는 축약 제목

### 4.2 헤더 영역
- 커버 이미지
- 릴리즈명
- 발매일
- 형식 칩
- 팀명

### 4.3 앨범 레벨 액션 영역
- Spotify
- YouTube Music
- YouTube MV(optional)

### 4.4 트랙 리스트 영역
- 트랙 번호
- 곡명
- 타이틀 표시
- 트랙별 서비스 액션

### 4.5 부가 정보 영역
- notes
- 크레딧(optional)
- 출처(optional)

### 4.6 MV 영역
- `youtube_video_id` 있으면 임베드 또는 바로가기
- 없으면 숨김 또는 링크 fallback

## 5. 컴포넌트 인벤토리
| 영역 | 컴포넌트 | 위치 | 필수 여부 | 탭 동작 |
|---|---|---|---|---|
| Header | Back Button | 상단 좌측 | 필수 | 이전 화면 복귀 |
| Header | Cover Image | 상단 | 필수 | 없음 |
| Header | Release Meta | Cover 아래 | 필수 | 없음 |
| Action | Album Service Group | Meta 아래 | 필수 | 외부 서비스 이동 |
| Body | Track Row | 본문 | 조건부 | 트랙별 서비스 이동 |
| Body | Notes Block | 트랙 아래 | 선택 | 없음 |
| Body | MV Block | notes 아래 | 선택 | 영상 보기 |

## 6. 트랙 리스트 규칙
### 6.1 필드
- `order`
- `title`
- `is_title_track`
- `spotify_url` optional
- `youtube_music_url` optional

### 6.2 타이틀곡 표시
- `★ 타이틀` 또는 타이틀 라벨 사용
- 더블타이틀이면 여러 트랙에 표시 가능

### 6.3 트랙 액션
- 각 행 우측에 Spotify / YouTube Music 버튼
- canonical URL 없으면 `group + track title` 검색 fallback

## 7. 데이터 바인딩
- 릴리즈 메타: `releaseDetails`
- 커버: `releaseArtwork`
- 트랙 리스트: `releaseDetails.tracks`
- MV: `releaseDetails.youtube_video_id`
- team label fallback: artist profile display name

## 8. 상태 매트릭스
| 상태 | 헤더 | 앨범 액션 | 트랙 리스트 | MV |
|---|---|---|---|---|
| Default | 정상 | 정상 | 정상 | 있으면 노출 |
| Loading | skeleton | skeleton | skeleton rows | skeleton/숨김 |
| Empty Tracks | 정상 | 유지 | empty copy | 영향 없음 |
| Partial Data | placeholder cover | 일부 버튼만 | 일부 트랙 버튼 fallback | 숨김 |
| Error | back + retry | 숨김 가능 | 숨김 | 숨김 |

## 9. 애니메이션
- 화면 push 기본 전환
- MV block fade-in 정도 허용
- 트랙 버튼 press feedback 짧게

## 10. 상세 요구사항
- 상세 화면의 가장 강한 CTA는 서비스 액션이다.
- 타이틀곡/더블타이틀 표시가 시각적으로 명확해야 한다.
- 앨범 레벨 액션과 트랙 레벨 액션은 혼동되지 않아야 한다.
- MV가 없을 때 공간이 어색하게 비면 안 된다.

## 11. QA 핵심 포인트
- 더블타이틀 케이스
- 트랙 링크 fallback
- MV 있음/없음
- cover missing fallback
