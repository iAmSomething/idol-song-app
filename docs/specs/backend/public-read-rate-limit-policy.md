# Public Read Rate-Limit Policy

## 1. 목적

이 문서는 public read API가 익명 무제한 트래픽을 전제로 동작하지 않도록
endpoint별 rate-limit 정책과 over-limit 응답 계약을 고정한다.

목표는 두 가지다.

- 정상적인 web/mobile 사용은 막지 않는다.
- 실수성 burst나 hostile high-volume traffic에는 deterministic하게 감속한다.

## 2. 적용 범위

현재 policy는 아래 public read surface에 적용한다.

| bucket | routes |
| --- | --- |
| `search` | `GET /v1/search` |
| `calendarMonth` | `GET /v1/calendar/month` |
| `entityDetail` | `GET /v1/entities/:slug`, `GET /v1/entities/:slug/channels` |
| `releaseDetail` | `GET /v1/releases/:id`, `GET /v1/releases/lookup` |
| `radar` | `GET /v1/radar` |

비적용 범위:

- `GET /health`
- `GET /ready`
- `GET /v1/review/*`

review endpoint는 operator surface라 별도 인증/운영 정책 이슈에서 다룬다.

## 3. Current Runtime Model

현재 구현은 single-process Fastify runtime 기준의 in-memory fixed-window limiter다.

의미:

- 한 instance 안에서는 deterministic하다.
- same-client burst에 즉시 반응한다.
- multi-instance global quota는 아니다.

즉 이 계층은 edge firewall 대체재가 아니라 application-level abuse brake다.

## 4. Client Identity Rule

limiter key는 client IP 기반이다.

우선순위:

1. `CF-Connecting-IP`
2. `X-Forwarded-For` 첫 번째 값
3. `X-Real-IP`
4. Fastify `request.ip`

원칙:

- raw IP 값 자체를 응답 payload에 다시 싣지 않는다.
- 응답에는 `rate_limit_identifier_kind = ip`만 남긴다.

## 5. Default Policy

window는 모든 bucket에서 `60초` fixed window를 사용한다.

### 5.1 Development

| bucket | limit / 60s |
| --- | --- |
| `search` | `600` |
| `calendarMonth` | `300` |
| `entityDetail` | `300` |
| `releaseDetail` | `300` |
| `radar` | `120` |

개발 환경은 local QA와 반복 테스트를 막지 않도록 가장 느슨하다.

### 5.2 Preview

| bucket | limit / 60s |
| --- | --- |
| `search` | `240` |
| `calendarMonth` | `180` |
| `entityDetail` | `240` |
| `releaseDetail` | `240` |
| `radar` | `90` |

preview는 production보다 여유 있지만, over-limit contract 자체는 production과 동일해야 한다.

### 5.3 Production

| bucket | limit / 60s |
| --- | --- |
| `search` | `180` |
| `calendarMonth` | `120` |
| `entityDetail` | `180` |
| `releaseDetail` | `180` |
| `radar` | `60` |

의도:

- search의 live typing / retry는 흡수한다.
- detail/calendar/radar의 반복 refresh는 허용하되 scraper-style burst는 감속한다.

## 6. Deterministic Over-limit Contract

limit를 초과하면 backend는 internal error가 아니라 explicit `429 rate_limited`를 반환한다.

```json
{
  "meta": {
    "request_id": "uuid-or-trace-id",
    "timezone": "Asia/Seoul",
    "rate_limit_bucket": "search",
    "rate_limit_limit": 180,
    "rate_limit_remaining": 0,
    "rate_limit_reset_at": "2026-03-08T12:01:00.000Z",
    "rate_limit_retry_after_seconds": 17,
    "rate_limit_window_seconds": 60,
    "rate_limit_identifier_kind": "ip"
  },
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded."
  }
}
```

header contract:

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
- `Retry-After` (`429`일 때만)
- `X-RateLimit-Bucket`

## 7. Noise / Logging Rule

rate-limit hit는 warn level 한 줄만 남긴다.

남기는 필드:

- `request_id`
- `rate_limit_bucket`
- `rate_limit_identifier_kind`
- `rate_limit_limit`
- `rate_limit_retry_after_seconds`

남기지 않는 것:

- raw IP
- full request header dump
- query/body 전체 payload

## 8. QA Rule

rate-limit verification은 아래 두 축으로 본다.

1. targeted burst test
   - 같은 client identifier로 limit 초과 시 `429 rate_limited`
2. manual smoke
   - 다른 client identifier는 같은 window에서도 정상 `200`
   - response header와 envelope meta가 QA-visible

## 9. Follow-up Considerations

later production traffic가 multi-instance 또는 CDN edge 기준으로 커지면 아래를 재검토한다.

- shared store 기반 limiter
- authenticated client tier 분리
- operator endpoint 전용 policy
- edge/CDN-level coarse rate limiting
