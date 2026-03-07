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
- tracked team 신규 추가 시 `search_aliases`에는 최소 1개의 Korean-searchable alias를 같이 넣는다.
- 공식 한글명이 없으면 아래 우선순위로 fallback을 정한다.
  1. 국내 기사/커뮤니티에서 널리 쓰는 한글 표기
  2. 발음 기반 Hangul rendering
  3. 제품 내에서 일관되게 쓰는 보수적 transcription
- 약칭/닉네임은 널리 쓰이고 다른 팀과 충돌 위험이 낮을 때만 추가한다.
- 사용자 체감 검색 실패를 유발하는 케이스는 큐레이션 우선순위가 높다.
- alias는 장르 판정 라벨이 아니라 검색 편의 자산이다.

## 6.a Missing Entity Triage
- 검색 실패 제보가 들어오면 먼저 `artistProfiles.json`, `watchlist.json`, `releases.json`, `upcomingCandidates.json`에 엔티티가 아예 없는지 확인한다.
- 엔티티 부재가 원인이면 alias 이슈로 우회하지 않고 onboarding 이슈로 분리한다.
- in-scope 팀으로 판단되면 최소 아래 세트를 같은 턴에 넣는다.
  - `artistProfiles.json`의 canonical name, slug, Korean-searchable alias
  - `tracking_watchlist.json`과 `web/src/data/watchlist.json`의 최소 watchlist row
- verified release나 upcoming fact가 아직 없어도, team search와 team navigation이 되도록 profile/watchlist 기준 엔트리를 우선 연다.

## 6.b Solo Artist Inclusion
- 솔로 아티스트도 K-pop release/upcoming 탐색 대상이면 group/unit와 같은 tracked entity로 취급한다.
- 우선 포함 기준은 아래를 모두 만족하는 경우다.
  - K-pop idol ecosystem 안에서 활동하는 명확한 stage name이 있다.
  - 국내 사용자가 실제로 검색할 영어명 또는 한글명이 있다.
  - onboarding 시점에 방어 가능한 official link를 최소 1개 이상 붙일 수 있다.
- 아래 케이스는 기본 포함 대상에서 제외한다.
  - 배우/예능인 중심으로만 소비되고 music-tracking 목적이 약한 케이스
  - OST/feature 중심으로만 드문드문 등장해 독립 comeback tracking 가치가 낮은 케이스
  - official identity link가 전혀 없어 name-only placeholder밖에 만들 수 없는 케이스
- 솔로 아티스트 onboarding 최소 세트는 team missing triage와 동일하되, `search_aliases`에는 Korean-searchable 표기를 반드시 1개 이상 넣는다.
- 2026-03-07 초기 pass 기준 tracked solo set은 `YENA`, `CHUU`, `Yves`, `JEON SOMI`, `KWON EUNBI`, `CHUNG HA`, `YUJU`를 포함한다.

## 7. 브랜드 자산 운영 원칙
- 공식 배지/대표 이미지가 있으면 우선 사용
- 없으면 representative image
- 그래도 없으면 monogram fallback
- fallback은 임시 수단이며, 메이저/빈사용 팀부터 공식 자산 보강

## 8. QA 체크포인트
- 누락 데이터가 primary CTA를 제거하지 않아야 한다.
- duplicate upcoming article이 여러 카드로 드러나지 않아야 한다.
- alias 보강 후 team/release/upcoming 검색이 함께 개선되어야 한다.
