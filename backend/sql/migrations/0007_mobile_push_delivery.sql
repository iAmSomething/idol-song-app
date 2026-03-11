create table if not exists mobile_push_registrations (
  id uuid primary key default gen_random_uuid(),
  installation_id text not null,
  platform text not null check (platform in ('ios', 'android')),
  build_profile text not null check (build_profile in ('development', 'preview', 'production')),
  expo_push_token text,
  alerts_enabled boolean not null default true,
  permission_status text not null check (
    permission_status in ('not_determined', 'denied', 'granted', 'provisional')
  ),
  device_locale text,
  app_version text,
  backend_request_id text,
  is_active boolean not null default false,
  disabled_reason text check (
    disabled_reason is null or disabled_reason in (
      'alerts_disabled',
      'permission_denied',
      'permission_not_determined',
      'token_missing',
      'provider_invalid',
      'superseded',
      'manual_reset',
      'project_unconfigured',
      'device_unavailable'
    )
  ),
  last_seen_at timestamptz not null default now(),
  last_registered_at timestamptz,
  last_token_refreshed_at timestamptz,
  disabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_registrations_installation_id_key unique (installation_id)
);

create unique index if not exists idx_mobile_push_registrations_expo_push_token
  on mobile_push_registrations (expo_push_token)
  where expo_push_token is not null;

create index if not exists idx_mobile_push_registrations_active
  on mobile_push_registrations (is_active, alerts_enabled, permission_status);

create index if not exists idx_mobile_push_registrations_seen_at
  on mobile_push_registrations (last_seen_at desc);

create table if not exists notification_event_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_event_id uuid not null references notification_events(id) on delete cascade,
  registration_id uuid not null references mobile_push_registrations(id) on delete cascade,
  provider text not null check (provider in ('expo')),
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  skip_reason text,
  failure_code text,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  payload jsonb not null,
  response_payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_event_push_deliveries_event_device_key unique (notification_event_id, registration_id)
);

create index if not exists idx_notification_event_push_deliveries_status
  on notification_event_push_deliveries (status, created_at desc);

create index if not exists idx_notification_event_push_deliveries_registration
  on notification_event_push_deliveries (registration_id, created_at desc);
