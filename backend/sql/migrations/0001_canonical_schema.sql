create extension if not exists pgcrypto;

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  canonical_name text not null,
  display_name text not null,
  entity_type text not null check (entity_type in ('group', 'solo', 'unit', 'project')),
  agency_name text,
  debut_year integer check (debut_year is null or debut_year between 1900 and 2100),
  representative_image_url text,
  representative_image_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  alias text not null,
  alias_type text not null check (alias_type in ('official_ko', 'common_ko', 'shorthand', 'nickname', 'romanized', 'legacy', 'search_seed')),
  normalized_alias text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint entity_aliases_entity_id_alias_key unique (entity_id, alias)
);

create table if not exists entity_official_links (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  link_type text not null check (link_type in ('youtube', 'x', 'instagram', 'website', 'artist_source')),
  url text not null,
  is_primary boolean not null default false,
  provenance text,
  created_at timestamptz not null default now(),
  constraint entity_official_links_entity_id_link_type_url_key unique (entity_id, link_type, url)
);

create table if not exists youtube_channels (
  id uuid primary key default gen_random_uuid(),
  canonical_channel_url text not null unique,
  channel_label text not null,
  owner_type text not null check (owner_type in ('team', 'label', 'distributor', 'other_official')),
  display_in_team_links boolean not null default false,
  allow_mv_uploads boolean not null default false,
  provenance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entity_youtube_channels (
  entity_id uuid not null references entities(id) on delete cascade,
  youtube_channel_id uuid not null references youtube_channels(id) on delete cascade,
  channel_role text not null check (channel_role in ('primary_team_channel', 'mv_allowlist', 'both')),
  created_at timestamptz not null default now(),
  primary key (entity_id, youtube_channel_id)
);

create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  release_title text not null,
  normalized_release_title text not null,
  release_date date not null,
  stream text not null check (stream in ('song', 'album')),
  release_kind text,
  release_format text,
  source_url text,
  artist_source_url text,
  musicbrainz_artist_id text,
  musicbrainz_release_group_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint releases_entity_id_normalized_release_title_release_date_stream_key
    unique (entity_id, normalized_release_title, release_date, stream)
);

create table if not exists release_artwork (
  release_id uuid primary key references releases(id) on delete cascade,
  cover_image_url text,
  thumbnail_image_url text,
  artwork_source_type text,
  artwork_source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  track_order integer not null check (track_order > 0),
  track_title text not null,
  normalized_track_title text not null,
  is_title_track boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracks_release_id_track_order_key unique (release_id, track_order)
);

create table if not exists release_service_links (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  service_type text not null check (service_type in ('spotify', 'youtube_music', 'youtube_mv')),
  url text,
  status text not null check (status in ('canonical', 'manual_override', 'relation_match', 'needs_review', 'unresolved', 'no_link')),
  provenance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_service_links_release_id_service_type_key unique (release_id, service_type)
);

create table if not exists track_service_links (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  service_type text not null check (service_type in ('spotify', 'youtube_music')),
  url text,
  status text not null check (status in ('canonical', 'unresolved', 'no_link')),
  provenance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_service_links_track_id_service_type_key unique (track_id, service_type)
);

create table if not exists upcoming_signals (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  headline text not null,
  normalized_headline text not null,
  scheduled_date date,
  scheduled_month date,
  date_precision text not null check (date_precision in ('exact', 'month_only', 'unknown')),
  date_status text not null check (date_status in ('confirmed', 'scheduled', 'rumor')),
  release_format text,
  confidence_score numeric(4,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  tracking_status text,
  first_seen_at timestamptz,
  latest_seen_at timestamptz,
  is_active boolean not null default true,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (date_precision = 'exact' and scheduled_date is not null and scheduled_month is null) or
    (
      date_precision = 'month_only'
      and scheduled_date is null
      and scheduled_month is not null
      and scheduled_month = date_trunc('month', scheduled_month::timestamp)::date
    ) or
    (date_precision = 'unknown' and scheduled_date is null and scheduled_month is null)
  )
);

create table if not exists upcoming_signal_sources (
  id uuid primary key default gen_random_uuid(),
  upcoming_signal_id uuid not null references upcoming_signals(id) on delete cascade,
  source_type text not null check (source_type in ('news_rss', 'weverse_notice', 'agency_notice', 'official_social', 'manual')),
  source_url text not null,
  source_domain text,
  published_at timestamptz,
  search_term text,
  evidence_summary text,
  created_at timestamptz not null default now(),
  constraint upcoming_signal_sources_upcoming_signal_id_source_url_key
    unique (upcoming_signal_id, source_url)
);

create table if not exists entity_tracking_state (
  entity_id uuid primary key references entities(id) on delete cascade,
  tier text not null,
  watch_reason text not null,
  tracking_status text not null,
  latest_verified_release_id uuid references releases(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists review_tasks (
  id uuid primary key default gen_random_uuid(),
  review_type text not null check (review_type in ('upcoming_signal', 'mv_candidate', 'entity_onboarding', 'alias_gap')),
  status text not null check (status in ('open', 'resolved', 'dismissed')),
  entity_id uuid references entities(id) on delete set null,
  release_id uuid references releases(id) on delete set null,
  upcoming_signal_id uuid references upcoming_signals(id) on delete set null,
  review_reason text[],
  recommended_action text,
  payload jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists release_link_overrides (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  service_type text not null check (service_type in ('youtube_music', 'youtube_mv')),
  override_url text,
  override_video_id text,
  provenance text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_link_overrides_release_id_service_type_key unique (release_id, service_type)
);

create index if not exists idx_entity_aliases_normalized_alias
  on entity_aliases (normalized_alias);

create index if not exists idx_entity_official_links_entity_id
  on entity_official_links (entity_id);

create index if not exists idx_releases_entity_id_release_date
  on releases (entity_id, release_date desc);

create index if not exists idx_releases_release_date
  on releases (release_date desc);

create index if not exists idx_releases_musicbrainz_release_group_id
  on releases (musicbrainz_release_group_id);

create index if not exists idx_upcoming_signals_entity_id
  on upcoming_signals (entity_id);

create index if not exists idx_upcoming_signals_scheduled_date
  on upcoming_signals (scheduled_date);

create index if not exists idx_upcoming_signals_scheduled_month
  on upcoming_signals (scheduled_month);

create index if not exists idx_upcoming_signals_dedupe_key
  on upcoming_signals (dedupe_key);

create index if not exists idx_entity_tracking_state_tracking_status
  on entity_tracking_state (tracking_status);

create index if not exists idx_review_tasks_status_review_type
  on review_tasks (status, review_type);

create index if not exists idx_release_service_links_status
  on release_service_links (status);
