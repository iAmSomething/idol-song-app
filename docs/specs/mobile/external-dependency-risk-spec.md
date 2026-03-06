# External Dependency Risk Spec

## 1. 목적
이 문서는 모바일 앱이 의존하는 외부 서비스/데이터군의 리스크와 완화 전략을 정의한다.

## 2. 주요 외부 의존
- Spotify handoff
- YouTube Music handoff
- YouTube MV URL/video id
- agency/weverse/news source link
- weekly scan pipeline이 만든 JSON 산출물

## 3. 리스크 유형
### 3.1 Link fragility
- canonical URL이 바뀌거나 누락될 수 있다.
- 완화: 검색 fallback 유지

### 3.2 Data incompleteness
- releaseDetails, artwork, exact date가 늦게 채워질 수 있다.
- 완화: partial state 허용

### 3.3 Source duplication
- 동일 컴백에 대한 기사 다수가 존재할 수 있다.
- 완화: dedupe + 대표 source selection

### 3.4 Policy changes
- 외부 서비스 정책/링크 구조가 바뀔 수 있다.
- 완화: handoff builder 중앙화

### 3.5 Pipeline freshness gap
- 주간/이벤트 기반 업데이트가 늦을 수 있다.
- 완화: freshness 문서 기준의 stale handling

## 4. 화면 영향도
- Calendar: 중간
- Search: 중간
- Team Detail: 높음
- Release Detail: 높음
- Radar: 높음

## 5. 완화 원칙
- canonical -> search fallback
- artwork -> placeholder fallback
- missing detail -> minimal detail state
- duplicate source -> representative event
- stale exact date -> 내부 감지 후 review 흐름

## 6. QA 체크포인트
- 외부 의존 실패가 곧바로 crash나 빈 화면으로 이어지지 않아야 한다.
- fallback이 없는 single point dependency가 남아 있으면 안 된다.
