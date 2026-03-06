# Playlist Research

기준일: 2026-03-07

## 1. 결론 요약

- 플레이리스트 생성은 v1 범위에서 제외한다.
- 우선순위는 발매 발견, 컴백 추적, 외부 앱 handoff보다 낮다.
- Spotify는 공식 API와 OAuth 흐름 기준으로 구현 가능하다.
- YouTube Music은 공식 공개 문서 기준 직접 생성용 write API를 확인하지 못해 v1에서는 보류한다.
- Google 계열 대안이 필요하면 YouTube playlist 생성 또는 외부 링크 handoff를 우선 검토한다.

## 2. 왜 지금 바로 구현하지 않는가

현재 제품의 핵심 가치는 아래 3가지다.

1. verified release 발견
2. upcoming comeback 추적
3. Spotify, YouTube Music, source 원문으로 빠르게 이동

플레이리스트 생성은 위 가치 위에 얹는 확장 기능이다. 사용자 계정 OAuth, write permission, track identifier 정합성, 실패 복구, 중복 생성 방지까지 함께 풀어야 하므로 운영 복잡도가 높다. 따라서 v1 제품에는 포함하지 않고, 연구 메모와 후속 조건만 남기는 것이 맞다.

## 3. 플랫폼 판단

### 3.1 Spotify

판단:
- post-v1 후보로 유지한다.
- 3개 preset만 지원하는 제한형 기능으로 시작하면 현실성이 있다.

근거:
- Spotify Web API는 `Create Playlist`와 `Add Items to Playlist`를 공식 지원한다.
- playlist 생성에는 `playlist-modify-public` 또는 `playlist-modify-private` scope가 필요하다.
- 모바일 앱, 브라우저 앱, client secret을 안전하게 보관할 수 없는 환경에서는 Authorization Code with PKCE가 권장된다.

제품 관점 제약:
- 빈 playlist를 만든 뒤 track URI를 순서대로 추가해야 한다.
- release 데이터만으로는 부족하고, 실제 Spotify track URI 또는 stable search-to-track resolution이 필요하다.
- 같은 preset을 반복 실행할 때 같은 playlist를 계속 새로 만들지, 기존 playlist를 갱신할지 정책이 필요하다.

현재 결론:
- Spotify는 기술적으로 go 가능하다.
- 단, `verified release -> canonical Spotify track URI` 정합성이 먼저 확보되어야 한다.

### 3.2 YouTube Music

판단:
- v1 direct create는 보류한다.

근거:
- 이번 조사에서 확인된 Google의 공식 write 문서는 YouTube Data API의 `playlists.insert`와 `playlistItems.insert`다.
- 이는 YouTube channel playlist 생성/수정 문서이며, YouTube Music 전용 playlist 생성 write API는 공식 공개 문서에서 확인하지 못했다.
- 따라서 "YouTube Music에 직접 playlist를 만든다"는 경험은 공식 공개 API 기준으로 현재 명확하지 않다.

제품 관점 제약:
- YouTube playlist와 YouTube Music playlist는 사용자 기대치가 다를 수 있다.
- YouTube Music 전용 write 계약이 불명확한 상태에서 먼저 UI를 약속하면 제품 설명과 실제 결과가 어긋날 수 있다.

현재 결론:
- "YouTube Music 직접 생성"은 no-go가 아니라 hold다.
- 후속 조사에서 공식 공개 write API가 확인되기 전까지는 구현 후보에서 제외한다.

### 3.3 YouTube playlist 대안

판단:
- Google 계열 fallback으로는 검토 가치가 있다.

근거:
- YouTube Data API는 OAuth 2.0 기반으로 playlist 생성과 item 추가를 지원한다.
- write operation은 quota와 정책 준수가 필요하다.
- YouTube Data API 프로젝트는 기본적으로 일일 10,000 quota units를 가진다.

제품 관점 제약:
- 사용자가 기대하는 대상이 "YouTube Music 보관함"이 아니라 "YouTube channel playlist"가 된다.
- 앱 안 copy에서 "YouTube Music playlist"가 아니라 "YouTube playlist"라고 명확히 구분해야 한다.
- write scope 요청은 실제 기능 제공 시점에만 해야 하며, 이유를 사용자에게 명확히 설명해야 한다.

현재 결론:
- Spotify가 준비되기 전 임시 우회책으로 바로 선택할 수준은 아니다.
- 다만 "Google 계열 공유 가능한 playlist 링크"가 꼭 필요해지면 검토 우선순위가 올라갈 수 있다.

## 4. 추천 조합 유형

v1 이후에도 후보를 아래 3개로 제한한다.

### 4.1 이번 주 걸그룹 발매곡

추천 이유:
- 시간 범위가 짧아 중복 관리가 쉽다.
- 홈/캘린더의 "이번 주" 탐색 흐름과 잘 맞는다.
- 사용자가 결과를 이해하기 쉽다.

데이터 조건:
- verified release만 사용
- 주간 범위는 KST 기준 월요일 시작, 일요일 종료
- girl group 분류가 artist profile에 명시돼 있어야 함
- playlist item은 canonical playable track이 확인된 경우만 포함

### 4.2 이번 달 보이그룹 발매곡

추천 이유:
- 월간 캘린더와 바로 연결된다.
- 주간보다 볼륨이 크지만 still bounded use case다.
- 반복 실행 규칙을 정의하기 쉽다.

데이터 조건:
- verified release만 사용
- 현재 선택 월 기준
- boy group 분류가 artist profile에 명시돼 있어야 함
- 같은 release의 중복 버전은 한 번만 반영

### 4.3 특정 팀의 최근 verified releases

추천 이유:
- 팀 상세 페이지와 연결이 쉽다.
- 범위를 "최근 N건" 또는 "최근 N일"로 제한할 수 있다.
- 사용자가 의도를 명확히 이해한다.

데이터 조건:
- verified release만 사용
- 팀 이름 canonical match가 가능해야 함
- 최근 범위는 `최근 5건` 또는 `최근 180일` 같은 고정 규칙으로 제한

## 5. 비추천 조합 유형

### 5.1 특정 팀 전체곡

비추천 이유:
- 현재 저장소는 완전한 디스코그래피 보장을 목표로 하지 않는다.
- 버전 중복, 리패키지, 일본어판, instrumentals, OST 포함 규칙이 바로 복잡해진다.
- "전체곡"은 누락이 생길 때 신뢰 하락이 크다.

결론:
- 연구 메모까지만 유지하고 v1 후보에서 제외한다.

### 5.2 upcoming candidate 기반 playlist

비추천 이유:
- exact release가 아닌 future candidate는 실제 playable track이 아직 없을 수 있다.
- teaser, rumor, date shift가 playlist 경험을 깨뜨린다.

결론:
- upcoming 데이터는 알림과 source handoff용으로만 사용한다.

### 5.3 플랫폼 동시 생성

비추천 이유:
- Spotify와 Google 계열의 auth, identifier, failure mode가 다르다.
- 첫 구현에서 두 플랫폼을 동시에 묶으면 실패 원인 분리가 어렵다.

결론:
- 첫 구현은 Spotify only가 맞다.

## 6. 후속 구현 전제조건

### 6.1 데이터 전제

- verified release마다 canonical playable target을 식별할 수 있어야 한다.
- Spotify는 track URI 또는 최소한 deterministic search query가 필요하다.
- release 단위 데이터를 track 단위로 축소하는 규칙이 필요하다.
- 중복 version 제거 규칙이 있어야 한다.

### 6.2 계정 및 권한 전제

- 사용자별 OAuth 로그인 상태를 유지해야 한다.
- Spotify는 playlist write scope를 실제 실행 시점에 요청해야 한다.
- Google 계열 fallback을 쓸 경우 YouTube Data API write scope와 정책 고지가 필요하다.

### 6.3 제품 전제

- 버튼 copy는 "내 계정에 playlist 생성"처럼 write action임을 분명히 해야 한다.
- 실패 시 partial success를 설명해야 한다.
- 이미 생성한 playlist를 재사용할지, 매번 새 playlist를 만들지 정책을 고정해야 한다.

### 6.4 운영 전제

- user + preset + time window 기준 idempotency key가 필요하다.
- 생성 로그와 실패 로그를 남겨야 한다.
- playlist 갱신이 허용되면 overwrite 범위와 rollback 규칙을 정해야 한다.

## 7. 추천 구현 순서

### Phase 1

- Spotify only
- preset 3종만 지원
- 새 playlist 생성만 허용
- verified release만 사용
- canonical track URI가 없는 항목은 skip

### Phase 2

- 기존 playlist 재사용 또는 갱신 정책 도입
- 생성 결과를 팀/월 단위로 다시 열 수 있는 링크 저장
- skip 항목 요약 피드백 제공

### Phase 3

- YouTube playlist fallback 실험
- YouTube Music direct create는 공식 공개 write API가 확인될 때만 재평가

## 8. 후속 구현 이슈로 쪼개는 기준

후속 이슈는 최소 아래 4개로 분리하는 것이 적절하다.

1. Spotify OAuth 및 playlist write flow 설계
2. verified release -> canonical Spotify track mapping 정합성 보강
3. preset 3종 생성 규칙과 idempotency 정책 정의
4. YouTube playlist fallback 가능 여부와 UX copy 정리

## 9. 최종 판단

- 지금 단계의 최종 결정은 `research complete, implementation deferred`다.
- 제품 우선순위는 여전히 release discovery, comeback tracking, service handoff가 먼저다.
- 실제 구현 착수 조건은 Spotify-only 범위 확정과 canonical track mapping 준비다.
- YouTube Music direct create는 공식 공개 문서가 확인되기 전까지 backlog hold로 남긴다.

## 10. 참고 자료

공식 문서 기준 링크:

- Spotify Create Playlist: https://developer.spotify.com/documentation/web-api/reference/create-playlist
- Spotify Add Items to Playlist: https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist
- Spotify Authorization: https://developer.spotify.com/documentation/web-api/concepts/authorization
- Spotify Authorization Code with PKCE: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- YouTube Data API Overview: https://developers.google.com/youtube/v3/getting-started
- YouTube Playlists: https://developers.google.com/youtube/v3/docs/playlists
- YouTube PlaylistItems insert: https://developers.google.com/youtube/v3/docs/playlistItems/insert
- YouTube Playlist implementation guide: https://developers.google.com/youtube/v3/guides/implementation/playlists
- YouTube API Services Developer Policies: https://developers.google.com/youtube/terms/developer-policies

참고 메모:
- "YouTube Music direct create 보류"는 공식 공개 문서에서 YouTube Music 전용 write endpoint를 확인하지 못했다는 조사 결과에 근거한 판단이다.
- 즉, 불가능 판정이 아니라 "공식 공개 API 기준 근거 부족" 상태로 본다.
