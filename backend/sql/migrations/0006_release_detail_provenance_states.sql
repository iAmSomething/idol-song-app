alter table releases
  add column if not exists detail_status text
    check (detail_status in ('verified', 'inferred', 'manual_override', 'review_needed', 'unresolved')),
  add column if not exists detail_provenance text,
  add column if not exists title_track_status text
    check (title_track_status in ('verified', 'inferred', 'manual_override', 'review_needed', 'unresolved')),
  add column if not exists title_track_provenance text;

update releases
set
  detail_status = coalesce(detail_status, 'unresolved'),
  detail_provenance = coalesce(detail_provenance, 'legacy_backfill_pending'),
  title_track_status = coalesce(title_track_status, 'unresolved'),
  title_track_provenance = coalesce(title_track_provenance, 'legacy_backfill_pending')
where
  detail_status is null
  or detail_provenance is null
  or title_track_status is null
  or title_track_provenance is null;

alter table releases
  alter column detail_status set default 'unresolved',
  alter column detail_status set not null,
  alter column detail_provenance set default 'legacy_backfill_pending',
  alter column detail_provenance set not null,
  alter column title_track_status set default 'unresolved',
  alter column title_track_status set not null,
  alter column title_track_provenance set default 'legacy_backfill_pending',
  alter column title_track_provenance set not null;

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
