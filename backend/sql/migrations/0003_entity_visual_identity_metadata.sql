alter table entities
  add column if not exists badge_image_url text,
  add column if not exists badge_source_url text,
  add column if not exists badge_source_label text,
  add column if not exists badge_kind text;

drop materialized view if exists entity_detail_projection;

create materialized view entity_detail_projection as
with official_link_summary as (
  select
    eol.entity_id,
    max(eol.url) filter (where eol.link_type = 'youtube') as youtube_url,
    max(eol.url) filter (where eol.link_type = 'x') as x_url,
    max(eol.url) filter (where eol.link_type = 'instagram') as instagram_url,
    max(eol.url) filter (where eol.link_type = 'artist_source') as artist_source_url
  from entity_official_links eol
  group by eol.entity_id
),
youtube_channel_summary as (
  select
    eyc.entity_id,
    min(yc.canonical_channel_url) filter (where eyc.channel_role in ('primary_team_channel', 'both')) as primary_team_channel_url,
    coalesce(
      array_agg(distinct yc.canonical_channel_url order by yc.canonical_channel_url)
        filter (where eyc.channel_role in ('mv_allowlist', 'both')),
      '{}'::text[]
    ) as mv_allowlist_urls
  from entity_youtube_channels eyc
  join youtube_channels yc on yc.id = eyc.youtube_channel_id
  group by eyc.entity_id
),
latest_release as (
  select distinct on (r.entity_id)
    r.entity_id,
    r.id as release_id,
    r.release_title,
    r.release_date,
    r.stream,
    r.release_kind
  from releases r
  order by
    r.entity_id,
    r.release_date desc,
    case when r.stream = 'album' then 0 else 1 end,
    r.release_title asc
),
next_upcoming as (
  select distinct on (u.entity_id)
    u.entity_id,
    u.id as upcoming_signal_id,
    u.headline,
    u.scheduled_date,
    u.scheduled_month,
    u.date_precision,
    u.date_status,
    u.release_format,
    u.confidence_score,
    u.latest_seen_at
  from upcoming_signals u
  where
    u.is_active = true
    and u.date_precision = 'exact'
    and u.scheduled_date >= timezone('Asia/Seoul', now())::date
  order by
    u.entity_id,
    u.scheduled_date asc,
    u.confidence_score desc nulls last,
    u.latest_seen_at desc nulls last,
    u.id
),
recent_albums as (
  select
    ranked.entity_id,
    jsonb_agg(
      jsonb_build_object(
        'release_id', ranked.release_id::text,
        'release_title', ranked.release_title,
        'release_date', ranked.release_date::text,
        'stream', ranked.stream,
        'release_kind', ranked.release_kind
      )
      order by ranked.release_date desc, ranked.release_title asc
    ) as recent_albums
  from (
    select
      r.entity_id,
      r.id as release_id,
      r.release_title,
      r.release_date,
      r.stream,
      r.release_kind,
      row_number() over (
        partition by r.entity_id
        order by r.release_date desc, r.release_title asc
      ) as release_rank
    from releases r
    where r.stream = 'album'
  ) ranked
  where ranked.release_rank <= 12
  group by ranked.entity_id
),
source_timeline as (
  select
    timeline.entity_id,
    jsonb_agg(timeline.payload order by timeline.sort_at desc, timeline.sort_headline asc) as source_timeline
  from (
    select
      us.entity_id,
      coalesce(uss.published_at, us.latest_seen_at, us.first_seen_at, now()) as sort_at,
      us.headline as sort_headline,
      row_number() over (
        partition by us.entity_id
        order by coalesce(uss.published_at, us.latest_seen_at, us.first_seen_at, now()) desc, us.headline asc
      ) as timeline_rank,
      jsonb_build_object(
        'headline', us.headline,
        'scheduled_date', us.scheduled_date::text,
        'scheduled_month', us.scheduled_month::text,
        'date_precision', us.date_precision,
        'date_status', us.date_status,
        'release_format', us.release_format,
        'confidence_score', us.confidence_score,
        'source_type', uss.source_type,
        'source_url', uss.source_url,
        'source_domain', uss.source_domain,
        'published_at', coalesce(uss.published_at, us.latest_seen_at, us.first_seen_at)
      ) as payload
    from upcoming_signals us
    left join upcoming_signal_sources uss on uss.upcoming_signal_id = us.id
    where us.is_active = true
  ) timeline
  where timeline.timeline_rank <= 12
  group by timeline.entity_id
)
select
  e.id as entity_id,
  e.slug as entity_slug,
  jsonb_build_object(
    'identity', jsonb_build_object(
      'entity_slug', e.slug,
      'display_name', e.display_name,
      'canonical_name', e.canonical_name,
      'entity_type', e.entity_type,
      'agency_name', e.agency_name,
      'debut_year', e.debut_year,
      'badge_image_url', e.badge_image_url,
      'badge_source_url', e.badge_source_url,
      'badge_source_label', e.badge_source_label,
      'badge_kind', e.badge_kind,
      'representative_image_url', e.representative_image_url,
      'representative_image_source', e.representative_image_source
    ),
    'official_links', jsonb_strip_nulls(
      jsonb_build_object(
        'youtube', ols.youtube_url,
        'x', ols.x_url,
        'instagram', ols.instagram_url
      )
    ),
    'youtube_channels', jsonb_build_object(
      'primary_team_channel_url', ycs.primary_team_channel_url,
      'mv_allowlist_urls', to_jsonb(coalesce(ycs.mv_allowlist_urls, '{}'::text[]))
    ),
    'tracking_state', jsonb_build_object(
      'tier', ets.tier,
      'watch_reason', ets.watch_reason,
      'tracking_status', ets.tracking_status
    ),
    'next_upcoming', case
      when nu.entity_id is null then null
      else jsonb_build_object(
        'upcoming_signal_id', nu.upcoming_signal_id::text,
        'headline', nu.headline,
        'scheduled_date', nu.scheduled_date::text,
        'scheduled_month', nu.scheduled_month::text,
        'date_precision', nu.date_precision,
        'date_status', nu.date_status,
        'release_format', nu.release_format,
        'confidence_score', nu.confidence_score,
        'latest_seen_at', nu.latest_seen_at
      )
    end,
    'latest_release', case
      when lr.entity_id is null then null
      else jsonb_build_object(
        'release_id', lr.release_id::text,
        'release_title', lr.release_title,
        'release_date', lr.release_date::text,
        'stream', lr.stream,
        'release_kind', lr.release_kind
      )
    end,
    'recent_albums', coalesce(ra.recent_albums, '[]'::jsonb),
    'source_timeline', coalesce(st.source_timeline, '[]'::jsonb),
    'artist_source_url', ols.artist_source_url
  ) as payload,
  now() as generated_at
from entities e
left join entity_tracking_state ets on ets.entity_id = e.id
left join official_link_summary ols on ols.entity_id = e.id
left join youtube_channel_summary ycs on ycs.entity_id = e.id
left join latest_release lr on lr.entity_id = e.id
left join next_upcoming nu on nu.entity_id = e.id
left join recent_albums ra on ra.entity_id = e.id
left join source_timeline st on st.entity_id = e.id
with no data;

create unique index if not exists idx_entity_detail_projection_entity_id
  on entity_detail_projection (entity_id);

create unique index if not exists idx_entity_detail_projection_slug
  on entity_detail_projection (entity_slug);
