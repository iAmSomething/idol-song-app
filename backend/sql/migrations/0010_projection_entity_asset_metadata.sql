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
entity_metadata_summary as (
  select
    emf.entity_id,
    jsonb_object_agg(
      emf.field_key,
      jsonb_build_object(
        'value', emf.value_json,
        'status', emf.status,
        'provenance', emf.provenance,
        'source_url', emf.source_url,
        'review_notes', emf.review_notes
      )
    ) as field_metadata
  from entity_metadata_fields emf
  group by emf.entity_id
),
upcoming_source_choice as (
  select distinct on (uss.upcoming_signal_id)
    uss.upcoming_signal_id,
    uss.source_type,
    uss.source_url,
    uss.source_domain,
    uss.evidence_summary,
    uss.published_at,
    count(*) over (partition by uss.upcoming_signal_id) as source_count
  from upcoming_signal_sources uss
  order by
    uss.upcoming_signal_id,
    case uss.source_type
      when 'agency_notice' then 0
      when 'weverse_notice' then 1
      when 'official_social' then 2
      when 'news_rss' then 3
      else 4
    end,
    uss.published_at desc nulls last,
    uss.source_url asc
),
release_card_base as (
  select
    r.entity_id,
    r.id as release_id,
    r.release_title,
    r.release_date,
    r.stream,
    r.release_kind,
    r.release_format,
    ra.cover_image_url,
    ra.thumbnail_image_url,
    ra.artwork_source_type,
    ra.artwork_source_url,
    ra.artwork_status,
    ra.artwork_provenance
  from releases r
  left join release_artwork ra on ra.release_id = r.id
),
latest_release as (
  select distinct on (rc.entity_id)
    rc.entity_id,
    rc.release_id,
    rc.release_title,
    rc.release_date,
    rc.stream,
    rc.release_kind,
    rc.release_format,
    rc.cover_image_url,
    rc.thumbnail_image_url,
    rc.artwork_source_type,
    rc.artwork_source_url,
    rc.artwork_status,
    rc.artwork_provenance
  from release_card_base rc
  order by
    rc.entity_id,
    rc.release_date desc,
    case when rc.stream = 'album' then 0 else 1 end,
    rc.release_title asc
),
next_upcoming as (
  select distinct on (u.entity_id)
    u.entity_id,
    u.id as upcoming_signal_id,
    u.headline,
    u.scheduled_date,
    coalesce(
      to_char(u.scheduled_month, 'YYYY-MM'),
      to_char(date_trunc('month', u.scheduled_date::timestamp)::date, 'YYYY-MM')
    ) as scheduled_month,
    u.date_precision,
    u.date_status,
    u.release_format,
    u.confidence_score,
    u.latest_seen_at,
    usc.source_type,
    usc.source_url,
    usc.source_domain,
    usc.evidence_summary,
    coalesce(usc.source_count, 0) as source_count
  from upcoming_signals u
  left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
        'release_kind', ranked.release_kind,
        'release_format', ranked.release_format,
        'artwork', case
          when ranked.cover_image_url is null
            and ranked.thumbnail_image_url is null
            and ranked.artwork_source_type is null
            and ranked.artwork_source_url is null
            and ranked.artwork_status is null
            and ranked.artwork_provenance is null
            then null
          else jsonb_build_object(
            'cover_image_url', ranked.cover_image_url,
            'thumbnail_image_url', ranked.thumbnail_image_url,
            'artwork_source_type', ranked.artwork_source_type,
            'artwork_source_url', ranked.artwork_source_url,
            'artwork_status', ranked.artwork_status,
            'artwork_provenance', ranked.artwork_provenance,
            'is_placeholder', ranked.artwork_status = 'placeholder'
          )
        end
      )
      order by ranked.release_date desc, ranked.release_title asc
    ) as recent_albums
  from (
    select
      rc.entity_id,
      rc.release_id,
      rc.release_title,
      rc.release_date,
      rc.stream,
      rc.release_kind,
      rc.release_format,
      rc.cover_image_url,
      rc.thumbnail_image_url,
      rc.artwork_source_type,
      rc.artwork_source_url,
      rc.artwork_status,
      rc.artwork_provenance,
      row_number() over (
        partition by rc.entity_id
        order by rc.release_date desc, rc.release_title asc
      ) as release_rank
    from release_card_base rc
    where rc.stream = 'album'
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
        'event_type', case
          when lower(us.headline) like '%tracklist%' then 'tracklist_reveal'
          when us.scheduled_date is not null and us.date_status = 'confirmed' then 'official_announcement'
          when us.scheduled_date is not null or us.scheduled_month is not null then 'date_update'
          else 'first_signal'
        end,
        'headline', us.headline,
        'occurred_at', coalesce(uss.published_at, us.latest_seen_at, us.first_seen_at),
        'summary', nullif(
          concat_ws(
            ' · ',
            nullif(us.release_format, ''),
            nullif(us.date_status, ''),
            coalesce(us.scheduled_date::text, to_char(us.scheduled_month, 'YYYY-MM'))
          ),
          ''
        ),
        'scheduled_date', us.scheduled_date::text,
        'scheduled_month', coalesce(
          to_char(us.scheduled_month, 'YYYY-MM'),
          case
            when us.scheduled_date is null then null
            else to_char(date_trunc('month', us.scheduled_date::timestamp)::date, 'YYYY-MM')
          end
        ),
        'date_precision', us.date_precision,
        'date_status', us.date_status,
        'release_format', us.release_format,
        'confidence_score', us.confidence_score,
        'source_type', uss.source_type,
        'source_url', uss.source_url,
        'source_domain', uss.source_domain,
        'published_at', coalesce(uss.published_at, us.latest_seen_at, us.first_seen_at),
        'evidence_summary', uss.evidence_summary,
        'source_count', coalesce(
          usc.source_count,
          case when uss.upcoming_signal_id is null then 0 else 1 end
        )
      ) as payload
    from upcoming_signals us
    left join upcoming_signal_sources uss on uss.upcoming_signal_id = us.id
    left join upcoming_source_choice usc on usc.upcoming_signal_id = us.id
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
      'representative_image_source', e.representative_image_source,
      'field_metadata', coalesce(ems.field_metadata, '{}'::jsonb)
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
        'scheduled_month', nu.scheduled_month,
        'date_precision', nu.date_precision,
        'date_status', nu.date_status,
        'release_format', nu.release_format,
        'confidence_score', nu.confidence_score,
        'latest_seen_at', nu.latest_seen_at,
        'source_type', nu.source_type,
        'source_url', nu.source_url,
        'source_domain', nu.source_domain,
        'evidence_summary', nu.evidence_summary,
        'source_count', nu.source_count
      )
    end,
    'latest_release', case
      when lr.entity_id is null then null
      else jsonb_build_object(
        'release_id', lr.release_id::text,
        'release_title', lr.release_title,
        'release_date', lr.release_date::text,
        'stream', lr.stream,
        'release_kind', lr.release_kind,
        'release_format', lr.release_format,
        'artwork', case
          when lr.cover_image_url is null
            and lr.thumbnail_image_url is null
            and lr.artwork_source_type is null
            and lr.artwork_source_url is null
            and lr.artwork_status is null
            and lr.artwork_provenance is null
            then null
          else jsonb_build_object(
            'cover_image_url', lr.cover_image_url,
            'thumbnail_image_url', lr.thumbnail_image_url,
            'artwork_source_type', lr.artwork_source_type,
            'artwork_source_url', lr.artwork_source_url,
            'artwork_status', lr.artwork_status,
            'artwork_provenance', lr.artwork_provenance,
            'is_placeholder', lr.artwork_status = 'placeholder'
          )
        end
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
left join entity_metadata_summary ems on ems.entity_id = e.id
left join latest_release lr on lr.entity_id = e.id
left join next_upcoming nu on nu.entity_id = e.id
left join recent_albums ra on ra.entity_id = e.id
left join source_timeline st on st.entity_id = e.id
with no data;

create unique index if not exists idx_entity_detail_projection_entity_id
  on entity_detail_projection (entity_id);

create unique index if not exists idx_entity_detail_projection_slug
  on entity_detail_projection (entity_slug);

drop materialized view if exists release_detail_projection;

create materialized view release_detail_projection as
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
    'detail_metadata', jsonb_build_object(
      'status', r.detail_status,
      'provenance', r.detail_provenance
    ),
    'title_track_metadata', jsonb_build_object(
      'status', r.title_track_status,
      'provenance', r.title_track_provenance
    ),
    'artwork', case
      when ra.release_id is null then null
      else jsonb_strip_nulls(
        jsonb_build_object(
          'cover_image_url', ra.cover_image_url,
          'thumbnail_image_url', ra.thumbnail_image_url,
          'artwork_source_type', ra.artwork_source_type,
          'artwork_source_url', ra.artwork_source_url,
          'artwork_status', ra.artwork_status,
          'artwork_provenance', ra.artwork_provenance,
          'is_placeholder', ra.artwork_status = 'placeholder'
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
