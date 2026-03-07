create or replace function projection_normalize_text(value text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(
            replace(
              replace(
                replace(
                  replace(
                    replace(coalesce(value, ''), '×', 'x'),
                    '✕',
                    'x'
                  ),
                  '&',
                  ' and '
                ),
                '''',
                ''
              ),
              '’',
              ''
            )
          ),
          '[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

create or replace function extract_youtube_video_id(url text)
returns text
language sql
immutable
as $$
  select case
    when url is null then null
    when substring(url from '[?&]v=([A-Za-z0-9_-]{6,})') is not null then substring(url from '[?&]v=([A-Za-z0-9_-]{6,})')
    when substring(url from 'youtu\.be/([A-Za-z0-9_-]{6,})') is not null then substring(url from 'youtu\.be/([A-Za-z0-9_-]{6,})')
    when substring(url from '/shorts/([A-Za-z0-9_-]{6,})') is not null then substring(url from '/shorts/([A-Za-z0-9_-]{6,})')
    when substring(url from '/embed/([A-Za-z0-9_-]{6,})') is not null then substring(url from '/embed/([A-Za-z0-9_-]{6,})')
    else null
  end
$$;

create materialized view if not exists entity_search_documents as
with latest_release as (
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
    u.headline,
    u.scheduled_date,
    u.date_precision,
    u.date_status,
    u.confidence_score
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
alias_sets as (
  select
    e.id as entity_id,
    coalesce(array_agg(distinct ea.alias order by ea.alias) filter (where ea.alias is not null), '{}'::text[]) as aliases,
    coalesce(
      array_agg(distinct ea.normalized_alias order by ea.normalized_alias) filter (where ea.normalized_alias is not null),
      '{}'::text[]
    ) as normalized_aliases
  from entities e
  left join entity_aliases ea on ea.entity_id = e.id
  group by e.id
)
select
  e.id as entity_id,
  e.slug as entity_slug,
  array(
    select distinct term
    from unnest(
      array[
        projection_normalize_text(e.slug),
        projection_normalize_text(e.canonical_name),
        projection_normalize_text(e.display_name)
      ] || alias_sets.normalized_aliases
    ) as term
    where term is not null and term <> ''
    order by term
  ) as normalized_terms,
  array(
    select distinct alias_value
    from unnest(
      array[e.canonical_name, e.display_name] || alias_sets.aliases
    ) as alias_value
    where alias_value is not null and alias_value <> ''
    order by alias_value
  ) as aliases,
  latest_release.release_date as latest_release_date,
  next_upcoming.scheduled_date as next_upcoming_date,
  jsonb_build_object(
    'entity_slug', e.slug,
    'display_name', e.display_name,
    'canonical_name', e.canonical_name,
    'entity_type', e.entity_type,
    'agency_name', e.agency_name,
    'aliases', to_jsonb(
      array(
        select distinct alias_value
        from unnest(array[e.canonical_name, e.display_name] || alias_sets.aliases) as alias_value
        where alias_value is not null and alias_value <> ''
        order by alias_value
      )
    ),
    'normalized_terms', to_jsonb(
      array(
        select distinct term
        from unnest(
          array[
            projection_normalize_text(e.slug),
            projection_normalize_text(e.canonical_name),
            projection_normalize_text(e.display_name)
          ] || alias_sets.normalized_aliases
        ) as term
        where term is not null and term <> ''
        order by term
      )
    ),
    'latest_release', case
      when latest_release.entity_id is null then null
      else jsonb_build_object(
        'release_id', latest_release.release_id::text,
        'release_title', latest_release.release_title,
        'release_date', latest_release.release_date::text,
        'stream', latest_release.stream,
        'release_kind', latest_release.release_kind
      )
    end,
    'next_upcoming', case
      when next_upcoming.entity_id is null then null
      else jsonb_build_object(
        'headline', next_upcoming.headline,
        'scheduled_date', next_upcoming.scheduled_date::text,
        'date_precision', next_upcoming.date_precision,
        'date_status', next_upcoming.date_status,
        'confidence_score', next_upcoming.confidence_score
      )
    end
  ) as payload,
  now() as generated_at
from entities e
join alias_sets on alias_sets.entity_id = e.id
left join latest_release on latest_release.entity_id = e.id
left join next_upcoming on next_upcoming.entity_id = e.id
with no data;

create unique index if not exists idx_entity_search_documents_entity_id
  on entity_search_documents (entity_id);

create unique index if not exists idx_entity_search_documents_slug
  on entity_search_documents (entity_slug);

create index if not exists idx_entity_search_documents_normalized_terms
  on entity_search_documents using gin (normalized_terms);

create materialized view if not exists release_detail_projection as
with release_service_summary as (
  select
    rsl.release_id,
    max(rsl.url) filter (where rsl.service_type = 'spotify') as spotify_url,
    max(rsl.status) filter (where rsl.service_type = 'spotify') as spotify_status,
    max(rsl.provenance) filter (where rsl.service_type = 'spotify') as spotify_provenance,
    max(rsl.url) filter (where rsl.service_type = 'youtube_music') as youtube_music_url,
    max(rsl.status) filter (where rsl.service_type = 'youtube_music') as youtube_music_status,
    max(rsl.provenance) filter (where rsl.service_type = 'youtube_music') as youtube_music_provenance,
    max(rsl.url) filter (where rsl.service_type = 'youtube_mv') as youtube_mv_url,
    max(rsl.status) filter (where rsl.service_type = 'youtube_mv') as youtube_mv_status,
    max(rsl.provenance) filter (where rsl.service_type = 'youtube_mv') as youtube_mv_provenance
  from release_service_links rsl
  group by rsl.release_id
),
track_service_summary as (
  select
    tsl.track_id,
    max(tsl.url) filter (where tsl.service_type = 'spotify') as spotify_url,
    max(tsl.status) filter (where tsl.service_type = 'spotify') as spotify_status,
    max(tsl.provenance) filter (where tsl.service_type = 'spotify') as spotify_provenance,
    max(tsl.url) filter (where tsl.service_type = 'youtube_music') as youtube_music_url,
    max(tsl.status) filter (where tsl.service_type = 'youtube_music') as youtube_music_status,
    max(tsl.provenance) filter (where tsl.service_type = 'youtube_music') as youtube_music_provenance
  from track_service_links tsl
  group by tsl.track_id
),
tracks_payload as (
  select
    t.release_id,
    jsonb_agg(
      jsonb_build_object(
        'track_id', t.id::text,
        'order', t.track_order,
        'title', t.track_title,
        'is_title_track', coalesce(t.is_title_track, false),
        'spotify', case
          when tss.spotify_url is null and tss.spotify_status is null then null
          else jsonb_build_object(
            'url', tss.spotify_url,
            'status', coalesce(tss.spotify_status, 'no_link'),
            'provenance', tss.spotify_provenance
          )
        end,
        'youtube_music', case
          when tss.youtube_music_url is null and tss.youtube_music_status is null then null
          else jsonb_build_object(
            'url', tss.youtube_music_url,
            'status', coalesce(tss.youtube_music_status, 'no_link'),
            'provenance', tss.youtube_music_provenance
          )
        end
      )
      order by t.track_order
    ) as tracks
  from tracks t
  left join track_service_summary tss on tss.track_id = t.id
  group by t.release_id
),
youtube_mv_override as (
  select
    rlo.release_id,
    max(rlo.override_video_id) filter (where rlo.service_type = 'youtube_mv') as override_video_id
  from release_link_overrides rlo
  group by rlo.release_id
)
select
  r.id as release_id,
  e.id as entity_id,
  e.slug as entity_slug,
  r.normalized_release_title,
  r.release_date,
  r.stream,
  jsonb_build_object(
    'release', jsonb_build_object(
      'release_id', r.id::text,
      'entity_slug', e.slug,
      'display_name', e.display_name,
      'release_title', r.release_title,
      'release_date', r.release_date::text,
      'stream', r.stream,
      'release_kind', r.release_kind
    ),
    'artwork', case
      when ra.release_id is null then null
      else jsonb_strip_nulls(
        jsonb_build_object(
          'cover_image_url', ra.cover_image_url,
          'thumbnail_image_url', ra.thumbnail_image_url,
          'artwork_source_type', ra.artwork_source_type,
          'artwork_source_url', ra.artwork_source_url
        )
      )
    end,
    'service_links', jsonb_build_object(
      'spotify', jsonb_build_object(
        'url', rss.spotify_url,
        'status', coalesce(rss.spotify_status, 'no_link'),
        'provenance', rss.spotify_provenance
      ),
      'youtube_music', jsonb_build_object(
        'url', rss.youtube_music_url,
        'status', coalesce(rss.youtube_music_status, 'no_link'),
        'provenance', rss.youtube_music_provenance
      )
    ),
    'tracks', coalesce(tp.tracks, '[]'::jsonb),
    'mv', jsonb_build_object(
      'url', rss.youtube_mv_url,
      'video_id', coalesce(yvo.override_video_id, extract_youtube_video_id(rss.youtube_mv_url)),
      'status', coalesce(rss.youtube_mv_status, 'no_link'),
      'provenance', rss.youtube_mv_provenance
    ),
    'credits', '[]'::jsonb,
    'charts', '[]'::jsonb,
    'notes', to_jsonb(r.notes)
  ) as payload,
  now() as generated_at
from releases r
join entities e on e.id = r.entity_id
left join release_artwork ra on ra.release_id = r.id
left join release_service_summary rss on rss.release_id = r.id
left join tracks_payload tp on tp.release_id = r.id
left join youtube_mv_override yvo on yvo.release_id = r.id
with no data;

create unique index if not exists idx_release_detail_projection_release_id
  on release_detail_projection (release_id);

create unique index if not exists idx_release_detail_projection_legacy_lookup
  on release_detail_projection (entity_slug, normalized_release_title, release_date, stream);

create materialized view if not exists entity_detail_projection as
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
      'badge_image_url', null,
      'representative_image_url', e.representative_image_url
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

create materialized view if not exists calendar_month_projection as
with current_clock as (
  select
    timezone('Asia/Seoul', now())::date as current_date_kst,
    date_trunc('month', timezone('Asia/Seoul', now()))::date as current_month_kst
),
all_months as (
  select date_trunc('month', r.release_date::timestamp)::date as month_start
  from releases r
  union
  select date_trunc('month', u.scheduled_date::timestamp)::date
  from upcoming_signals u
  where u.is_active = true and u.date_precision = 'exact' and u.scheduled_date is not null
  union
  select u.scheduled_month
  from upcoming_signals u
  where u.is_active = true and u.date_precision = 'month_only' and u.scheduled_month is not null
),
month_bounds as (
  select
    coalesce(min(all_months.month_start), min(current_clock.current_month_kst)) as min_month,
    coalesce(max(all_months.month_start), min(current_clock.current_month_kst)) as max_month
  from all_months
  cross join current_clock
),
month_keys as (
  select generate_series(month_bounds.min_month, month_bounds.max_month, interval '1 month')::date as month_start
  from month_bounds
),
nearest_upcoming as (
  select
    u.id as upcoming_signal_id,
    e.slug as entity_slug,
    e.display_name,
    u.scheduled_date,
    u.date_precision,
    u.date_status,
    u.headline,
    u.confidence_score
  from upcoming_signals u
  join entities e on e.id = u.entity_id
  cross join current_clock
  where
    u.is_active = true
    and u.date_precision = 'exact'
    and u.scheduled_date >= current_clock.current_date_kst
  order by
    u.scheduled_date asc,
    u.confidence_score desc nulls last,
    e.display_name asc,
    u.id
  limit 1
)
select
  month_keys.month_start,
  to_char(month_keys.month_start, 'YYYY-MM') as month_key,
  jsonb_build_object(
    'summary', jsonb_build_object(
      'verified_count', (
        select count(*)
        from releases r
        where date_trunc('month', r.release_date::timestamp)::date = month_keys.month_start
      ),
      'exact_upcoming_count', (
        select count(*)
        from upcoming_signals u
        where
          u.is_active = true
          and u.date_precision = 'exact'
          and date_trunc('month', u.scheduled_date::timestamp)::date = month_keys.month_start
      ),
      'month_only_upcoming_count', (
        select count(*)
        from upcoming_signals u
        where
          u.is_active = true
          and u.date_precision = 'month_only'
          and u.scheduled_month = month_keys.month_start
      )
    ),
    'nearest_upcoming', (
      select case
        when nearest_upcoming.upcoming_signal_id is null then null
        else jsonb_build_object(
          'upcoming_signal_id', nearest_upcoming.upcoming_signal_id::text,
          'entity_slug', nearest_upcoming.entity_slug,
          'display_name', nearest_upcoming.display_name,
          'scheduled_date', nearest_upcoming.scheduled_date::text,
          'date_precision', nearest_upcoming.date_precision,
          'date_status', nearest_upcoming.date_status,
          'headline', nearest_upcoming.headline,
          'confidence_score', nearest_upcoming.confidence_score
        )
      end
      from nearest_upcoming
    ),
    'days', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'date', day_bucket.day_date::text,
            'verified_releases', day_bucket.verified_releases,
            'exact_upcoming', day_bucket.exact_upcoming
          )
          order by day_bucket.day_date
        ),
        '[]'::jsonb
      )
      from (
        select
          day_keys.day_date,
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'release_id', r.id::text,
                  'entity_slug', e.slug,
                  'display_name', e.display_name,
                  'release_title', r.release_title,
                  'stream', r.stream,
                  'release_kind', r.release_kind
                )
                order by e.display_name asc, r.release_title asc
              ),
              '[]'::jsonb
            )
            from releases r
            join entities e on e.id = r.entity_id
            where r.release_date = day_keys.day_date
          ) as verified_releases,
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'upcoming_signal_id', u.id::text,
                  'entity_slug', e.slug,
                  'display_name', e.display_name,
                  'scheduled_date', u.scheduled_date::text,
                  'date_precision', u.date_precision,
                  'date_status', u.date_status,
                  'headline', u.headline,
                  'confidence_score', u.confidence_score,
                  'release_format', u.release_format
                )
                order by u.scheduled_date asc, u.confidence_score desc nulls last, e.display_name asc, u.headline asc
              ),
              '[]'::jsonb
            )
            from upcoming_signals u
            join entities e on e.id = u.entity_id
            where
              u.is_active = true
              and u.date_precision = 'exact'
              and u.scheduled_date = day_keys.day_date
          ) as exact_upcoming
        from (
          select distinct day_date
          from (
            select r.release_date as day_date
            from releases r
            where date_trunc('month', r.release_date::timestamp)::date = month_keys.month_start
            union
            select u.scheduled_date as day_date
            from upcoming_signals u
            where
              u.is_active = true
              and u.date_precision = 'exact'
              and date_trunc('month', u.scheduled_date::timestamp)::date = month_keys.month_start
          ) raw_days
        ) day_keys
      ) day_bucket
    ),
    'month_only_upcoming', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'upcoming_signal_id', u.id::text,
            'entity_slug', e.slug,
            'display_name', e.display_name,
            'scheduled_month', u.scheduled_month::text,
            'date_precision', u.date_precision,
            'date_status', u.date_status,
            'headline', u.headline,
            'confidence_score', u.confidence_score,
            'release_format', u.release_format
          )
          order by
            case u.date_status when 'confirmed' then 0 when 'scheduled' then 1 else 2 end,
            u.confidence_score desc nulls last,
            e.display_name asc,
            u.headline asc
        ),
        '[]'::jsonb
      )
      from upcoming_signals u
      join entities e on e.id = u.entity_id
      where
        u.is_active = true
        and u.date_precision = 'month_only'
        and u.scheduled_month = month_keys.month_start
    ),
    'verified_list', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'release_id', r.id::text,
            'entity_slug', e.slug,
            'display_name', e.display_name,
            'release_title', r.release_title,
            'release_date', r.release_date::text,
            'stream', r.stream,
            'release_kind', r.release_kind
          )
          order by r.release_date asc, e.display_name asc, r.release_title asc
        ),
        '[]'::jsonb
      )
      from releases r
      join entities e on e.id = r.entity_id
      where date_trunc('month', r.release_date::timestamp)::date = month_keys.month_start
    ),
    'scheduled_list', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'upcoming_signal_id', u.id::text,
            'entity_slug', e.slug,
            'display_name', e.display_name,
            'headline', u.headline,
            'scheduled_date', u.scheduled_date::text,
            'scheduled_month', u.scheduled_month::text,
            'date_precision', u.date_precision,
            'date_status', u.date_status,
            'confidence_score', u.confidence_score,
            'release_format', u.release_format
          )
          order by
            case when u.date_precision = 'exact' then 0 when u.date_precision = 'month_only' then 1 else 2 end,
            coalesce(u.scheduled_date, u.scheduled_month) asc,
            case u.date_status when 'confirmed' then 0 when 'scheduled' then 1 else 2 end,
            u.confidence_score desc nulls last,
            e.display_name asc,
            u.headline asc
        ),
        '[]'::jsonb
      )
      from upcoming_signals u
      join entities e on e.id = u.entity_id
      where
        u.is_active = true
        and (
          (u.date_precision = 'exact' and date_trunc('month', u.scheduled_date::timestamp)::date = month_keys.month_start)
          or (u.date_precision = 'month_only' and u.scheduled_month = month_keys.month_start)
        )
    )
  ) as payload,
  now() as generated_at
from month_keys
with no data;

create unique index if not exists idx_calendar_month_projection_month_start
  on calendar_month_projection (month_start);

create unique index if not exists idx_calendar_month_projection_month_key
  on calendar_month_projection (month_key);

create materialized view if not exists radar_projection as
with current_clock as (
  select
    timezone('Asia/Seoul', now())::date as current_date_kst,
    extract(year from timezone('Asia/Seoul', now()))::integer as current_year_kst
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
latest_signal as (
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
    u.latest_seen_at,
    u.first_seen_at
  from upcoming_signals u
  where u.is_active = true
  order by
    u.entity_id,
    coalesce(u.latest_seen_at, u.first_seen_at) desc nulls last,
    u.confidence_score desc nulls last,
    u.headline asc
),
featured_upcoming as (
  select
    u.id as upcoming_signal_id,
    e.slug as entity_slug,
    e.display_name,
    u.headline,
    u.scheduled_date,
    u.date_precision,
    u.date_status,
    u.confidence_score,
    u.release_format
  from upcoming_signals u
  join entities e on e.id = u.entity_id
  cross join current_clock
  where
    u.is_active = true
    and u.date_precision = 'exact'
    and u.scheduled_date >= current_clock.current_date_kst
  order by
    u.scheduled_date asc,
    case u.date_status when 'confirmed' then 0 when 'scheduled' then 1 else 2 end,
    u.confidence_score desc nulls last,
    e.display_name asc,
    u.headline asc
  limit 1
),
weekly_upcoming as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'upcoming_signal_id', u.id::text,
        'entity_slug', e.slug,
        'display_name', e.display_name,
        'headline', u.headline,
        'scheduled_date', u.scheduled_date::text,
        'date_precision', u.date_precision,
        'date_status', u.date_status,
        'confidence_score', u.confidence_score,
        'release_format', u.release_format
      )
      order by
        u.scheduled_date asc,
        case u.date_status when 'confirmed' then 0 when 'scheduled' then 1 else 2 end,
        u.confidence_score desc nulls last,
        e.display_name asc,
        u.headline asc
    ),
    '[]'::jsonb
  ) as payload
  from upcoming_signals u
  join entities e on e.id = u.entity_id
  cross join current_clock
  where
    u.is_active = true
    and u.date_precision = 'exact'
    and u.scheduled_date >= current_clock.current_date_kst
    and u.scheduled_date <= current_clock.current_date_kst + 7
),
change_feed as (
  select coalesce(
    jsonb_agg(feed.payload order by feed.sort_at desc, feed.display_name asc) filter (where feed.feed_rank <= 20),
    '[]'::jsonb
  ) as payload
  from (
    select
      feed_rows.*,
      row_number() over (order by feed_rows.sort_at desc, feed_rows.display_name asc) as feed_rank
    from (
      select
        r.updated_at as sort_at,
        e.display_name,
        jsonb_build_object(
          'kind', 'verified_release',
          'entity_slug', e.slug,
          'display_name', e.display_name,
          'release_id', r.id::text,
          'release_title', r.release_title,
          'release_date', r.release_date::text,
          'stream', r.stream,
          'release_kind', r.release_kind,
          'occurred_at', r.updated_at
        ) as payload
      from releases r
      join entities e on e.id = r.entity_id
      cross join current_clock
      where r.release_date >= current_clock.current_date_kst - 30

      union all

      select
        coalesce(u.latest_seen_at, u.first_seen_at, now()) as sort_at,
        e.display_name,
        jsonb_build_object(
          'kind', 'upcoming_signal',
          'entity_slug', e.slug,
          'display_name', e.display_name,
          'upcoming_signal_id', u.id::text,
          'headline', u.headline,
          'scheduled_date', u.scheduled_date::text,
          'scheduled_month', u.scheduled_month::text,
          'date_precision', u.date_precision,
          'date_status', u.date_status,
          'confidence_score', u.confidence_score,
          'occurred_at', coalesce(u.latest_seen_at, u.first_seen_at)
        ) as payload
      from upcoming_signals u
      join entities e on e.id = u.entity_id
      cross join current_clock
      where coalesce(u.latest_seen_at, u.first_seen_at, now()) >= now() - interval '30 days'
    ) feed_rows
  ) feed
),
long_gap as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entity_slug', ranked.entity_slug,
        'display_name', ranked.display_name,
        'watch_reason', ranked.watch_reason,
        'latest_release', jsonb_build_object(
          'release_id', ranked.release_id::text,
          'release_title', ranked.release_title,
          'release_date', ranked.release_date::text,
          'stream', ranked.stream,
          'release_kind', ranked.release_kind
        ),
        'gap_days', ranked.gap_days,
        'has_upcoming_signal', ranked.has_upcoming_signal,
        'latest_signal', ranked.latest_signal
      )
      order by ranked.sort_has_signal asc, ranked.sort_confidence desc, ranked.sort_signal_at desc, ranked.gap_days desc, ranked.display_name asc
    ),
    '[]'::jsonb
  ) as payload
  from (
    select
      e.slug as entity_slug,
      e.display_name,
      ets.watch_reason,
      lr.release_id,
      lr.release_title,
      lr.release_date,
      lr.stream,
      lr.release_kind,
      (timezone('Asia/Seoul', now())::date - lr.release_date) as gap_days,
      (ls.upcoming_signal_id is not null) as has_upcoming_signal,
      case
        when ls.upcoming_signal_id is null then null
        else jsonb_build_object(
          'upcoming_signal_id', ls.upcoming_signal_id::text,
          'headline', ls.headline,
          'scheduled_date', ls.scheduled_date::text,
          'scheduled_month', ls.scheduled_month::text,
          'date_precision', ls.date_precision,
          'date_status', ls.date_status,
          'release_format', ls.release_format,
          'confidence_score', ls.confidence_score,
          'latest_seen_at', ls.latest_seen_at
        )
      end as latest_signal,
      case when ls.upcoming_signal_id is not null then 0 else 1 end as sort_has_signal,
      coalesce(ls.confidence_score, -1) as sort_confidence,
      extract(epoch from coalesce(ls.latest_seen_at, ls.first_seen_at, to_timestamp(0))) as sort_signal_at
    from entity_tracking_state ets
    join entities e on e.id = ets.entity_id
    join latest_release lr on lr.entity_id = ets.entity_id
    left join latest_signal ls on ls.entity_id = ets.entity_id
    where
      ets.watch_reason = 'long_gap'
      and lr.release_date <= timezone('Asia/Seoul', now())::date - 365
  ) ranked
),
rookie as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entity_slug', ranked.entity_slug,
        'display_name', ranked.display_name,
        'debut_year', ranked.debut_year,
        'latest_release', ranked.latest_release,
        'has_upcoming_signal', ranked.has_upcoming_signal,
        'latest_signal', ranked.latest_signal
      )
      order by ranked.sort_has_signal asc, ranked.sort_release_date desc, ranked.debut_year desc nulls last, ranked.display_name asc
    ),
    '[]'::jsonb
  ) as payload
  from (
    select
      e.slug as entity_slug,
      e.display_name,
      e.debut_year,
      case
        when lr.release_id is null then null
        else jsonb_build_object(
          'release_id', lr.release_id::text,
          'release_title', lr.release_title,
          'release_date', lr.release_date::text,
          'stream', lr.stream,
          'release_kind', lr.release_kind
        )
      end as latest_release,
      (ls.upcoming_signal_id is not null) as has_upcoming_signal,
      case
        when ls.upcoming_signal_id is null then null
        else jsonb_build_object(
          'upcoming_signal_id', ls.upcoming_signal_id::text,
          'headline', ls.headline,
          'scheduled_date', ls.scheduled_date::text,
          'scheduled_month', ls.scheduled_month::text,
          'date_precision', ls.date_precision,
          'date_status', ls.date_status,
          'release_format', ls.release_format,
          'confidence_score', ls.confidence_score,
          'latest_seen_at', ls.latest_seen_at
        )
      end as latest_signal,
      case when ls.upcoming_signal_id is not null then 0 else 1 end as sort_has_signal,
      coalesce(extract(epoch from lr.release_date::timestamp), 0) as sort_release_date
    from entities e
    cross join current_clock
    left join latest_release lr on lr.entity_id = e.id
    left join latest_signal ls on ls.entity_id = e.id
    where
      e.debut_year is not null
      and e.debut_year between current_clock.current_year_kst - 1 and current_clock.current_year_kst
  ) ranked
)
select
  'default'::text as projection_key,
  jsonb_build_object(
    'featured_upcoming', (
      select case
        when featured_upcoming.upcoming_signal_id is null then null
        else jsonb_build_object(
          'upcoming_signal_id', featured_upcoming.upcoming_signal_id::text,
          'entity_slug', featured_upcoming.entity_slug,
          'display_name', featured_upcoming.display_name,
          'headline', featured_upcoming.headline,
          'scheduled_date', featured_upcoming.scheduled_date::text,
          'date_precision', featured_upcoming.date_precision,
          'date_status', featured_upcoming.date_status,
          'confidence_score', featured_upcoming.confidence_score,
          'release_format', featured_upcoming.release_format
        )
      end
      from featured_upcoming
    ),
    'weekly_upcoming', (select weekly_upcoming.payload from weekly_upcoming),
    'change_feed', (select change_feed.payload from change_feed),
    'long_gap', (select long_gap.payload from long_gap),
    'rookie', (select rookie.payload from rookie)
  ) as payload,
  now() as generated_at
with no data;

create unique index if not exists idx_radar_projection_key
  on radar_projection (projection_key);
