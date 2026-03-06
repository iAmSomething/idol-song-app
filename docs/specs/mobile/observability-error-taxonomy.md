# Observability and Error Taxonomy

## 1. 목적
이 문서는 모바일 앱에서 어떤 오류를 어떤 수준으로 기록하고, 어떤 실패를 사용자 피드백으로 드러내야 하는지 정의한다.

## 2. 원칙
- 모든 실패를 사용자에게 크게 보여주지 않는다.
- crash는 최소화하고, recoverable error는 degraded UI로 처리한다.
- 로그는 제품/운영 판단에 필요한 수준까지만 남긴다.

## 3. 오류 분류
### 3.1 Blocking
- screen render 자체가 불가한 오류
- 예: corrupted route param handling, fatal parser failure

### 3.2 Degraded
- 화면은 열리지만 일부 데이터/액션이 비는 오류
- 예: artwork missing, canonical handoff missing, MV missing

### 3.3 External-failure
- 외부 앱/브라우저 open 실패
- 예: invalid service URL, unsupported scheme

### 3.4 Data-quality
- duplicate upcoming articles, unknown source type, stale exact-date event

## 4. 사용자 피드백 원칙
- Blocking: full-page error or retry surface
- Degraded: partial UI + missing block fallback
- External-failure: toast/snackbar
- Data-quality: 일반 사용자에겐 숨기고 QA/logging으로 우선 감지

## 5. 로깅 포인트
- route validation failure
- selector normalize failure
- external handoff failure
- unknown source type fallback
- missing release detail on expected detail route
- search normalization unexpected empty result

## 6. 로그에 남기면 안 되는 것
- PII
- 과도한 원문 기사 본문
- 서비스 인증 토큰류
- 임시 디버그 copy

## 7. 대시보드/분석 해석 포인트
- 어떤 화면에서 blocking error가 많은가
- 어떤 서비스 handoff 실패가 많은가
- 어떤 selector fallback이 가장 자주 발생하는가
- stale/duplicate upcoming data 비율이 얼마나 되는가

## 8. QA 체크포인트
- blocking/degraded/external-failure의 사용자 피드백 방식이 일관되어야 한다.
- recoverable error가 crash로 이어지지 않아야 한다.
- log payload가 privacy spec을 위반하지 않아야 한다.
