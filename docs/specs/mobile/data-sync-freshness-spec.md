# Data Sync and Freshness Spec

## 1. 목적
이 문서는 모바일 앱이 웹/운영 파이프라인에서 생성된 JSON 데이터를 어떤 신선도 기준으로 소비하고, 어떤 시점에 갱신해야 하는지 정의한다.

## 2. 데이터 계층
### 2.1 Stable profile data
- `artistProfiles.json`
- `releaseArtwork.json`
- `releaseDetails.json`
- 성격: 수동/반자동 보강 데이터
- 기대 갱신 빈도: 낮음

### 2.2 Rolling release data
- `releases.json`
- 성격: 발매 확정 데이터
- 기대 갱신 빈도: known comeback date window 중심

### 2.3 Rolling upcoming data
- `watchlist.json`
- `upcomingCandidates.json`
- 성격: 주기 스캔 기반 예정 데이터
- 기대 갱신 빈도: 주 3회 이상

## 3. 신선도 기대치
### 3.1 Upcoming
- 월/수/금 오전 9시 KST 스캔 결과 기준 최신 상태여야 한다.
- exact date 없는 월 단위 일정도 유지하되, stale 표시는 가능해야 한다.

### 3.2 Release core
- exact comeback date가 있는 항목은 `D-1`, `D-day`, `D+1` window에서 갱신된다고 가정한다.
- D-day 이전에는 partial metadata가 허용된다.

### 3.3 Enrichment
- credits, notes, MV, artwork는 발매 직후 즉시 완전하지 않아도 된다.
- partial state를 정상 상태로 렌더링해야 한다.

## 4. 모바일 소비 원칙
- 모바일은 JSON이 완전하지 않다는 전제를 가진다.
- freshness 미달은 crash 원인이 아니라 표시 모델 fallback으로 처리한다.
- raw dataset updated_at이 있으면 이를 우선 사용하고, 없으면 file-bundle build time 기준으로만 해석한다.

## 5. Freshness UI 정책
### 5.1 사용자 노출 범위
- 일반 사용자에게 내부 운영 시간표를 그대로 보여주지 않는다.
- 대신 필요 시 `최근 업데이트됨`, `발매 후 정보 보강 중` 같은 상태 문구를 쓴다.

### 5.2 예정 정보
- scheduled event가 exact date이고 현재 시점이 D+2를 넘었는데 verified release가 없으면 review-needed 상태로 간주할 수 있다.
- 이 상태는 v1에서 사용자에게 직접 노출하지 않아도 되지만, 내부 로깅/QA에서는 감지 가능해야 한다.

## 6. 캐싱/번들 정책
- v1은 bundled static dataset 또는 versioned remote JSON 중 하나를 고정해 사용한다.
- mixed source를 동시에 해석하는 로직은 금지한다.
- 동일 빌드에서 dataset version이 섞이면 안 된다.

## 7. selector 계약
- selector는 missing field, stale record, duplicate upcoming event를 처리해야 한다.
- freshness 규칙은 selector 또는 adapter 단계에서 normalized flag로 전달한다.

## 8. 예외 처리
- releaseDetails 없음: Release Detail은 최소 metadata + track placeholder로 렌더링
- artwork 없음: placeholder cover 사용
- canonical handoff 없음: 검색 fallback 사용
- upcoming duplicate articles: dedupe된 대표 event 1개만 표시

## 9. QA 체크포인트
- partial upcoming/release data에서도 화면이 깨지지 않아야 한다.
- stale/missing metadata가 primary CTA를 막지 않아야 한다.
- 같은 exact date event가 중복 source로 들어와도 대표 카드 1개로 정리되어야 한다.
