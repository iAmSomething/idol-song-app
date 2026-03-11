# Trusted Upcoming Notification Events

## 목적

이 문서는 daily upcoming/news scan에서 `신뢰 가능한 upcoming signal`을 operator alert와 mobile push delivery 후보로 승격하는 canonical event contract를 정의한다.

범위는 아래까지다.

- trusted signal 판정
- persisted fingerprint / dedupe state
- canonical notification event row
- repo-native operator alert artifact
- mobile push registration / delivery outcome persistence

현재 문서 바깥인 것은 아래다.

- iOS / Android OS-level notification presentation policy의 세부 UX
- mobile large-text / accessibility polish

## 핵심 엔터티

### 1. `notification_signal_states`

역할:

- signal fingerprint 단위의 최신 관측 상태 저장
- unchanged rerun suppression의 기준점
- meaningful upgrade 판정을 위한 previous snapshot 저장

핵심 필드:

- `fingerprint_key`
- `entity_id`
- `upcoming_signal_id`
- `canonical_source_url`
- `scheduled_bucket`
- `latest_date_status`
- `latest_date_precision`
- `latest_confidence_score`
- `latest_confidence_band`
- `latest_source_type`
- `latest_source_tier`
- `is_active`
- `is_trusted`
- `last_emitted_dedupe_key`
- `last_emitted_reason`
- `last_emitted_reason_value`
- `cooldown_until`
- `payload`

### 2. `notification_events`

역할:

- downstream mobile push delivery가 읽는 canonical notification event queue
- operator alert artifact의 source row

핵심 필드:

- `event_type = trusted_upcoming_signal`
- `event_reason`
- `event_reason_value`
- `status`
- `entity_id`
- `upcoming_signal_id`
- `fingerprint_key`
- `dedupe_key`
- `cooldown_key`
- `cooldown_until`
- `secondary_reasons`
- `canonical_destination`
- `payload`

### 3. `mobile_push_registrations`

역할:

- mobile installation 단위의 Expo push token / permission / alert preference 보존
- 같은 token이 다른 installation으로 이동했을 때 active row를 하나로 유지

핵심 필드:

- `installation_id`
- `platform`
- `build_profile`
- `expo_push_token`
- `alerts_enabled`
- `permission_status`
- `is_active`
- `disabled_reason`
- `last_registered_at`
- `last_token_refreshed_at`
- `backend_request_id`

### 4. `notification_event_push_deliveries`

역할:

- canonical event fanout attempt row
- registration별 sent / failed / skipped outcome 기록

핵심 필드:

- `notification_event_id`
- `registration_id`
- `provider = expo`
- `status`
- `provider_message_id`
- `skip_reason`
- `failure_code`
- `attempt_count`
- `payload`
- `response_payload`
- `sent_at`

## Trusted 판정 규칙

signal은 아래 둘 중 하나면 trusted로 본다.

1. `source_tier >= official_social`
2. `confidence >= 0.80` 이고 동시에
   - `date_status in {scheduled, confirmed}` 또는
   - `date_precision != unknown`

source tier는 아래 순서를 쓴다.

- `agency_notice = 4`
- `weverse_notice = 3`
- `official_social = 2`
- `news_rss = 1`
- `manual = 0`

confidence band는 아래처럼 고정한다.

- `low < 0.80`
- `trusted >= 0.80`
- `high >= 0.90`

## Fingerprint / Dedupe

base fingerprint는 아래 축으로 만든다.

- `event_type`
- `entity slug`
- `normalized headline`
- `scheduled bucket`
- `canonical source url`

`scheduled bucket`은 아래 중 하나다.

- `scheduled_date` exact ISO date
- `scheduled_month` month key
- `unknown`

event dedupe key는 아래를 따른다.

- `fingerprint_key + primary reason + primary reason value`

즉 unchanged rerun은 같은 `dedupe_key`로 suppression 되고, meaningful upgrade는 새 `reason/value` 조합으로 한 번 더 event를 만든다.

## Trigger Matrix

primary reason은 한 run에서 최대 1개만 고른다. 다른 변화는 `secondary_reasons`로 payload에 남긴다.

우선순위:

1. `new_signal`
2. `date_status_upgrade`
3. `date_precision_gain`
4. `confidence_threshold_crossed`
5. `source_tier_upgrade`

upgrade 판정:

- `date_status`: `rumor -> scheduled -> confirmed`
- `date_precision`: `unknown -> month_only -> exact`
- `confidence_band`: `low -> trusted -> high`
- `source_tier`: 낮은 tier에서 높은 tier로 상승

## Canonical Destination

v1 destination은 보수적으로 `entity_detail` 하나로 고정한다.

payload:

```json
{
  "kind": "entity_detail",
  "entity_slug": "yena",
  "entity_id": "uuid",
  "upcoming_signal_id": "uuid",
  "scheduled_bucket": "2026-03-11",
  "preferred_tab": "team"
}
```

release-level canonical destination은 release mapping contract가 열리면 후속으로 확장한다.

## Operator Alert Artifact

daily workflow는 canonical event emission 뒤에 아래 artifact를 남긴다.

- `backend/reports/trusted_upcoming_notification_event_summary.json`
- `backend/reports/trusted_upcoming_operator_alert_report.md`

summary 최소 필드:

- `signals_considered`
- `trusted_signals`
- `events_emitted`
- `suppressed_unchanged`
- `suppressed_untrusted`
- `emitted_by_reason`
- `emitted_events[]`

push delivery worker는 아래 artifact도 남긴다.

- `backend/reports/mobile_push_delivery_summary.json`
- `backend/reports/mobile_push_delivery_report.md`

summary 최소 필드:

- `events_considered`
- `delivery_targets_considered`
- `sent`
- `failed`
- `skipped`
- `invalidated_registrations`
- `delivery_rows[]`

workflow summary에는 위 aggregate와 상위 emitted sample만 남긴다.

## 운영 규칙

- first run에서 trusted current signals는 `new_signal`로 event가 생성될 수 있다.
- 이후 rerun은 same `dedupe_key`가 있으면 조용히 suppress 한다.
- stale signal은 state row에서 `is_active=false`로 내리되 historical event row는 지우지 않는다.
- push delivery 이전 단계에서는 `notification_events.status = queued`를 기본값으로 쓴다.
- delivery worker는 registration별 row를 먼저 보고 unchanged rerun / max-attempt / skip reason을 보수적으로 유지한다.
- `DeviceNotRegistered`는 registration row를 즉시 비활성화하고 `disabled_reason = provider_invalid`로 내린다.

## 관련 구현

- schema migration: `backend/sql/migrations/0006_notification_events.sql`
- push delivery migration: `backend/sql/migrations/0007_mobile_push_delivery.sql`
- emission sync: `sync_trusted_upcoming_notification_events.py`
- delivery worker: `deliver_trusted_push_notifications.py`
- mobile registration route: `backend/src/routes/notifications.ts`
- workflow entrypoint: `.github/workflows/weekly-kpop-scan.yml`
- downstream umbrella: `#557`
