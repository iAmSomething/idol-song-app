# Content Governance Spec

## 1. 목적
이 문서는 모바일 앱이 의존하는 팀/릴리즈 메타데이터를 어떤 원칙으로 운영하고 보강할지 정의한다.
특히 `artistProfiles`, `releaseArtwork`, `releaseDetails`, `upcomingCandidates`는 자동과 수동 큐레이션이 섞이므로 운영 기준이 필요하다.

## 2. 데이터군 구분
### 2.1 Auto-first
- `releases.json`
- `watchlist.json`
- `upcomingCandidates.json`
- 주기 스캔 또는 이벤트 기반 갱신이 우선

### 2.2 Curated-first
- `artistProfiles.json`
- `releaseArtwork.json`
- `releaseDetails.json`
- 검색 alias, badge, MV, notes 등은 큐레이션 우선

## 3. 우선순위 원칙
- 사용자 탐색에 직접 영향을 주는 메타가 우선이다.
- 팀명/alias/cover/핵심 handoff 링크/예정일이 notes보다 우선이다.
- latest_song/latest_album 분리를 훼손하는 단순화는 금지한다.

## 4. 누락 데이터 대응
### 4.1 Team missing
- watchlist/manual seed에 먼저 편입
- 이후 artist profile과 alias를 보강

### 4.2 Artwork missing
- placeholder 사용
- official/curated asset 확보 전까지 UI blocker로 취급하지 않음

### 4.3 Release detail missing
- minimal detail state 허용
- track list 없으면 album-level CTA만 노출

## 5. 중복/충돌 처리
- 같은 upcoming event는 대표 source 1건으로 dedupe
- official source가 있으면 news source를 대표 카드에서 숨긴다.
- 충돌하는 scheduled date는 source priority와 confidence 규칙으로 정리한다.

## 6. Alias 운영 원칙
- 공식명, 한글명, 약칭, 표기 변형을 search alias로 유지한다.
- 사용자 체감 검색 실패를 유발하는 케이스는 큐레이션 우선순위가 높다.
- alias는 장르 판정 라벨이 아니라 검색 편의 자산이다.

## 7. 브랜드 자산 운영 원칙
- 공식 배지/대표 이미지가 있으면 우선 사용
- 없으면 representative image
- 그래도 없으면 monogram fallback
- fallback은 임시 수단이며, 메이저/빈사용 팀부터 공식 자산 보강

## 8. QA 체크포인트
- 누락 데이터가 primary CTA를 제거하지 않아야 한다.
- duplicate upcoming article이 여러 카드로 드러나지 않아야 한다.
- alias 보강 후 team/release/upcoming 검색이 함께 개선되어야 한다.
