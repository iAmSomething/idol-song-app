create table if not exists notification_signal_states (
  fingerprint_key text primary key,
  event_type text not null check (event_type in ('trusted_upcoming_signal')),
  entity_id uuid references entities(id) on delete set null,
  upcoming_signal_id uuid references upcoming_signals(id) on delete set null,
  canonical_source_url text,
  canonical_source_domain text,
  scheduled_bucket text not null,
  latest_date_status text not null check (latest_date_status in ('confirmed', 'scheduled', 'rumor')),
  latest_date_precision text not null check (latest_date_precision in ('exact', 'month_only', 'unknown')),
  latest_confidence_score numeric(4,2) check (
    latest_confidence_score is null or (latest_confidence_score >= 0 and latest_confidence_score <= 1)
  ),
  latest_confidence_band text not null check (latest_confidence_band in ('low', 'trusted', 'high')),
  latest_source_type text not null check (
    latest_source_type in ('news_rss', 'weverse_notice', 'agency_notice', 'official_social', 'manual')
  ),
  latest_source_tier integer not null check (latest_source_tier between 0 and 4),
  is_active boolean not null default true,
  is_trusted boolean not null default false,
  last_seen_at timestamptz not null default now(),
  last_emitted_dedupe_key text,
  last_emitted_reason text check (
    last_emitted_reason is null or last_emitted_reason in (
      'new_signal',
      'date_status_upgrade',
      'date_precision_gain',
      'confidence_threshold_crossed',
      'source_tier_upgrade'
    )
  ),
  last_emitted_reason_value text,
  last_emitted_at timestamptz,
  cooldown_until timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('trusted_upcoming_signal')),
  event_reason text not null check (
    event_reason in (
      'new_signal',
      'date_status_upgrade',
      'date_precision_gain',
      'confidence_threshold_crossed',
      'source_tier_upgrade'
    )
  ),
  event_reason_value text not null,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped', 'suppressed')),
  entity_id uuid references entities(id) on delete set null,
  upcoming_signal_id uuid references upcoming_signals(id) on delete set null,
  fingerprint_key text not null references notification_signal_states(fingerprint_key) on delete cascade,
  dedupe_key text not null,
  cooldown_key text not null,
  cooldown_until timestamptz,
  secondary_reasons text[] not null default '{}',
  canonical_destination jsonb not null,
  payload jsonb not null,
  emitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint notification_events_dedupe_key_key unique (dedupe_key)
);

create index if not exists idx_notification_signal_states_last_seen_at
  on notification_signal_states (last_seen_at desc);

create index if not exists idx_notification_signal_states_is_active
  on notification_signal_states (is_active, event_type);

create index if not exists idx_notification_events_status_event_type
  on notification_events (status, event_type);

create index if not exists idx_notification_events_fingerprint_emitted_at
  on notification_events (fingerprint_key, emitted_at desc);
