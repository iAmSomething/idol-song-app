# Structured Backend Logging Policy

이 문서는 backend read API / runtime path에서 어떤 로그를 남기고 어떤 정보는
명시적으로 제외하거나 redaction 할지 고정한다.

대상 코드:

- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/runtime-failures.ts`
- `backend/src/lib/logging.ts`

## 목표

- production에서도 안전하게 남길 수 있는 field shape를 고정한다.
- 요청당 여러 줄이 아닌, 의도된 한 줄 summary와 domain-specific warning/error만 남긴다.
- runtime-fatal, readiness degradation, rate-limit hit 같은 운영 이벤트를 구분한다.

## 공통 원칙

- 모든 로그는 구조화된 key-value payload를 가진다.
- `service=idol-song-app-backend`를 base field로 고정한다.
- `app_env`는 `development`, `preview`, `production` 중 하나다.
- request-scoped 로그는 `request_id`를 반드시 가진다.
- process-level fatal log는 `failure_class`와 `exit_code`를 반드시 가진다.

## 로그 분류

### 1. Request Summary

성공 또는 client/policy error 요청에 대해 한 줄만 남기는 routine log다.

필수 필드:

- `request_id`
- `method`
- `route`
- `status_code`
- `duration_ms`

message:

- success: `Request completed`
- 4xx: `Request completed with client or policy error`
- 5xx: `Request completed with server error`

### 2. Request Error

예상하지 못한 request-scoped failure는 error handler에서 별도 error log를 남긴다.

필수 필드:

- `request_id`
- `err`

선택 필드:

- `route`
- `method`

### 3. Domain Warning

운영적으로 봐야 하지만 fatal은 아닌 이벤트다.

예:

- rate limit exceeded
- degraded / not_ready readiness

추가 필드 예:

- `rate_limit_bucket`
- `rate_limit_limit`
- `rate_limit_retry_after_seconds`
- `ready_status`
- `readiness_reasons`
- `projection_status`
- `projection_lag_minutes`
- `dependency_states`

### 4. Runtime Fatal / Bootstrap Failure

process-level failure는 request 로그와 절대 섞지 않는다.

필수 필드:

- `failure_class`
- `exit_code`

가능한 `failure_class`:

- `bootstrap`
- `uncaughtException`
- `unhandledRejection`

추가 필드:

- `signal`
- `shutdown_reason`
- `shutdown_timeout_ms`
- `err`
- `rejection_reason`
- `thrown_value`

## Noise Budget

기본 원칙은 "routine success는 한 줄, known noisy probe는 기본적으로 무음"이다.

### 로그를 남기는 경로

- `/v1/**` public read route success
- `/v1/**` client/policy error
- `/v1/**` unexpected server error
- degraded / not_ready `/ready`
- rate-limit hit
- bootstrap failure
- runtime-fatal failure

### 기본적으로 로그를 남기지 않는 경로

- successful `/health`
- healthy `/ready`
- successful `OPTIONS` preflight
- automatic `incoming request` / `request completed` pair

## Redaction / Omission Policy

### 반드시 redaction 하는 path

- `req.headers.authorization`
- `req.headers.cookie`
- `req.headers.set-cookie`
- `req.headers.x-forwarded-for`
- `headers.authorization`
- `headers.cookie`
- `headers.set-cookie`
- `headers.x-forwarded-for`

censor value는 `[Redacted]`로 고정한다.

### routine log에서 아예 제외하는 값

- request body
- raw query string 전체
- remote IP / `remoteAddress`
- raw cookie
- raw authorization token
- full forwarded chain

운영상 route-level reasoning이 필요하면 full URL 대신 `route` pattern과 개별 domain field를 남긴다.

## Environment Verbosity

### development

- level: `debug`
- local debugging을 위해 가장 높은 verbosity를 허용한다.
- 단, redaction / omission 규칙은 preview / production과 동일하게 유지한다.

### preview

- level: `info`
- rehearsal / smoke / rollout 판단에 필요한 request summary, warn, error만 남긴다.

### production

- level: `info`
- preview와 같은 field shape를 유지한다.
- probe noise와 duplicate request-pair logging은 허용하지 않는다.

## Verification

- `backend/src/lib/logging.test.ts`
  - env별 log level
  - redaction path 존재
  - request-summary skip/include 규칙
- manual inspection
  - development: `/v1/search` success가 summary 한 줄인지 확인
  - preview: `/health` success가 routine log에 남지 않는지 확인
  - preview: degraded `/ready`가 warn payload를 남기는지 확인
