drop materialized view if exists radar_projection;
drop materialized view if exists calendar_month_projection;

create materialized view calendar_month_projection as
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
upcoming_source_choice as (
  select distinct on (uss.upcoming_signal_id)
    uss.upcoming_signal_id,
    uss.source_type,
    uss.source_url,
    uss.source_domain,
    uss.evidence_summary,
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
nearest_upcoming as (
  select
    u.id as upcoming_signal_id,
    e.slug as entity_slug,
    e.display_name,
    e.entity_type,
    e.agency_name,
    coalesce(u.tracking_status, ets.tracking_status) as tracking_status,
    u.scheduled_date,
    to_char(date_trunc('month', u.scheduled_date::timestamp)::date, 'YYYY-MM') as scheduled_month,
    u.date_precision,
    u.date_status,
    u.headline,
    u.confidence_score,
    u.release_format,
    usc.source_url,
    usc.source_type,
    usc.source_domain,
    usc.evidence_summary,
    usc.source_count
  from upcoming_signals u
  join entities e on e.id = u.entity_id
  left join entity_tracking_state ets on ets.entity_id = u.entity_id
  left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
          'entity_type', nearest_upcoming.entity_type,
          'agency_name', nearest_upcoming.agency_name,
          'tracking_status', nearest_upcoming.tracking_status,
          'headline', nearest_upcoming.headline,
          'scheduled_date', nearest_upcoming.scheduled_date::text,
          'scheduled_month', nearest_upcoming.scheduled_month,
          'date_precision', nearest_upcoming.date_precision,
          'date_status', nearest_upcoming.date_status,
          'confidence_score', nearest_upcoming.confidence_score,
          'release_format', nearest_upcoming.release_format,
          'source_url', nearest_upcoming.source_url,
          'source_type', nearest_upcoming.source_type,
          'source_domain', nearest_upcoming.source_domain,
          'evidence_summary', nearest_upcoming.evidence_summary,
          'source_count', nearest_upcoming.source_count
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
                  'entity_type', e.entity_type,
                  'agency_name', e.agency_name,
                  'release_title', r.release_title,
                  'release_date', r.release_date::text,
                  'stream', r.stream,
                  'release_kind', r.release_kind,
                  'release_format', r.release_format,
                  'source_url', r.source_url,
                  'artist_source_url', r.artist_source_url
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
                  'entity_type', e.entity_type,
                  'agency_name', e.agency_name,
                  'tracking_status', coalesce(u.tracking_status, ets.tracking_status),
                  'headline', u.headline,
                  'scheduled_date', u.scheduled_date::text,
                  'scheduled_month', to_char(date_trunc('month', u.scheduled_date::timestamp)::date, 'YYYY-MM'),
                  'date_precision', u.date_precision,
                  'date_status', u.date_status,
                  'confidence_score', u.confidence_score,
                  'release_format', u.release_format,
                  'source_url', usc.source_url,
                  'source_type', usc.source_type,
                  'source_domain', usc.source_domain,
                  'evidence_summary', usc.evidence_summary,
                  'source_count', usc.source_count
                )
                order by
                  u.scheduled_date asc,
                  case u.date_status when 'confirmed' then 0 when 'scheduled' then 1 else 2 end,
                  u.confidence_score desc nulls last,
                  e.display_name asc,
                  u.headline asc
              ),
              '[]'::jsonb
            )
            from upcoming_signals u
            join entities e on e.id = u.entity_id
            left join entity_tracking_state ets on ets.entity_id = u.entity_id
            left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
            'entity_type', e.entity_type,
            'agency_name', e.agency_name,
            'tracking_status', coalesce(u.tracking_status, ets.tracking_status),
            'headline', u.headline,
            'scheduled_date', null,
            'scheduled_month', to_char(u.scheduled_month, 'YYYY-MM'),
            'date_precision', u.date_precision,
            'date_status', u.date_status,
            'confidence_score', u.confidence_score,
            'release_format', u.release_format,
            'source_url', usc.source_url,
            'source_type', usc.source_type,
            'source_domain', usc.source_domain,
            'evidence_summary', usc.evidence_summary,
            'source_count', usc.source_count
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
      left join entity_tracking_state ets on ets.entity_id = u.entity_id
      left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
            'entity_type', e.entity_type,
            'agency_name', e.agency_name,
            'release_title', r.release_title,
            'release_date', r.release_date::text,
            'stream', r.stream,
            'release_kind', r.release_kind,
            'release_format', r.release_format,
            'source_url', r.source_url,
            'artist_source_url', r.artist_source_url
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
            'entity_type', e.entity_type,
            'agency_name', e.agency_name,
            'tracking_status', coalesce(u.tracking_status, ets.tracking_status),
            'headline', u.headline,
            'scheduled_date', u.scheduled_date::text,
            'scheduled_month', to_char(coalesce(date_trunc('month', u.scheduled_date::timestamp)::date, u.scheduled_month), 'YYYY-MM'),
            'date_precision', u.date_precision,
            'date_status', u.date_status,
            'confidence_score', u.confidence_score,
            'release_format', u.release_format,
            'source_url', usc.source_url,
            'source_type', usc.source_type,
            'source_domain', usc.source_domain,
            'evidence_summary', usc.evidence_summary,
            'source_count', usc.source_count
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
      left join entity_tracking_state ets on ets.entity_id = u.entity_id
      left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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

create materialized view radar_projection as
with current_clock as (
  select
    timezone('Asia/Seoul', now())::date as current_date_kst,
    extract(year from timezone('Asia/Seoul', now()))::integer as current_year_kst
),
upcoming_source_choice as (
  select distinct on (uss.upcoming_signal_id)
    uss.upcoming_signal_id,
    uss.source_type,
    uss.source_url,
    uss.source_domain,
    uss.evidence_summary,
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
latest_release as (
  select distinct on (r.entity_id)
    r.entity_id,
    r.id as release_id,
    r.release_title,
    r.release_date,
    r.stream,
    r.release_kind,
    r.release_format,
    r.source_url,
    r.artist_source_url
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
    coalesce(u.tracking_status, ets.tracking_status) as tracking_status,
    u.latest_seen_at,
    u.first_seen_at,
    usc.source_url,
    usc.source_type,
    usc.source_domain,
    usc.evidence_summary,
    usc.source_count
  from upcoming_signals u
  left join entity_tracking_state ets on ets.entity_id = u.entity_id
  left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
    e.entity_type,
    e.agency_name,
    coalesce(u.tracking_status, ets.tracking_status) as tracking_status,
    u.headline,
    u.scheduled_date,
    to_char(date_trunc('month', u.scheduled_date::timestamp)::date, 'YYYY-MM') as scheduled_month,
    u.date_precision,
    u.date_status,
    u.confidence_score,
    u.release_format,
    usc.source_url,
    usc.source_type,
    usc.source_domain,
    usc.evidence_summary,
    usc.source_count
  from upcoming_signals u
  join entities e on e.id = u.entity_id
  left join entity_tracking_state ets on ets.entity_id = u.entity_id
  left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
        'entity_type', e.entity_type,
        'agency_name', e.agency_name,
        'tracking_status', coalesce(u.tracking_status, ets.tracking_status),
        'headline', u.headline,
        'scheduled_date', u.scheduled_date::text,
        'scheduled_month', to_char(date_trunc('month', u.scheduled_date::timestamp)::date, 'YYYY-MM'),
        'date_precision', u.date_precision,
        'date_status', u.date_status,
        'confidence_score', u.confidence_score,
        'release_format', u.release_format,
        'source_url', usc.source_url,
        'source_type', usc.source_type,
        'source_domain', usc.source_domain,
        'evidence_summary', usc.evidence_summary,
        'source_count', usc.source_count
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
  left join entity_tracking_state ets on ets.entity_id = u.entity_id
  left join upcoming_source_choice usc on usc.upcoming_signal_id = u.id
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
        'entity_type', ranked.entity_type,
        'agency_name', ranked.agency_name,
        'tracking_status', ranked.tracking_status,
        'watch_reason', ranked.watch_reason,
        'latest_release', jsonb_build_object(
          'release_id', ranked.release_id::text,
          'release_title', ranked.release_title,
          'release_date', ranked.release_date::text,
          'stream', ranked.stream,
          'release_kind', ranked.release_kind,
          'release_format', ranked.release_format,
          'source_url', ranked.release_source_url,
          'artist_source_url', ranked.artist_source_url
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
      e.entity_type,
      e.agency_name,
      ets.tracking_status,
      ets.watch_reason,
      lr.release_id,
      lr.release_title,
      lr.release_date,
      lr.stream,
      lr.release_kind,
      lr.release_format,
      lr.source_url as release_source_url,
      lr.artist_source_url,
      (timezone('Asia/Seoul', now())::date - lr.release_date) as gap_days,
      (ls.upcoming_signal_id is not null) as has_upcoming_signal,
      case
        when ls.upcoming_signal_id is null then null
        else jsonb_build_object(
          'upcoming_signal_id', ls.upcoming_signal_id::text,
          'headline', ls.headline,
          'scheduled_date', ls.scheduled_date::text,
          'scheduled_month', to_char(ls.scheduled_month, 'YYYY-MM'),
          'date_precision', ls.date_precision,
          'date_status', ls.date_status,
          'release_format', ls.release_format,
          'confidence_score', ls.confidence_score,
          'latest_seen_at', ls.latest_seen_at,
          'source_url', ls.source_url,
          'source_type', ls.source_type,
          'source_domain', ls.source_domain,
          'evidence_summary', ls.evidence_summary,
          'source_count', ls.source_count
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
        'entity_type', ranked.entity_type,
        'agency_name', ranked.agency_name,
        'tracking_status', ranked.tracking_status,
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
      e.entity_type,
      e.agency_name,
      coalesce(ets.tracking_status, 'watch_only') as tracking_status,
      e.debut_year,
      case
        when lr.release_id is null then null
        else jsonb_build_object(
          'release_id', lr.release_id::text,
          'release_title', lr.release_title,
          'release_date', lr.release_date::text,
          'stream', lr.stream,
          'release_kind', lr.release_kind,
          'release_format', lr.release_format,
          'source_url', lr.source_url,
          'artist_source_url', lr.artist_source_url
        )
      end as latest_release,
      (ls.upcoming_signal_id is not null) as has_upcoming_signal,
      case
        when ls.upcoming_signal_id is null then null
        else jsonb_build_object(
          'upcoming_signal_id', ls.upcoming_signal_id::text,
          'headline', ls.headline,
          'scheduled_date', ls.scheduled_date::text,
          'scheduled_month', to_char(ls.scheduled_month, 'YYYY-MM'),
          'date_precision', ls.date_precision,
          'date_status', ls.date_status,
          'release_format', ls.release_format,
          'confidence_score', ls.confidence_score,
          'latest_seen_at', ls.latest_seen_at,
          'source_url', ls.source_url,
          'source_type', ls.source_type,
          'source_domain', ls.source_domain,
          'evidence_summary', ls.evidence_summary,
          'source_count', ls.source_count
        )
      end as latest_signal,
      case when ls.upcoming_signal_id is not null then 0 else 1 end as sort_has_signal,
      coalesce(extract(epoch from lr.release_date::timestamp), 0) as sort_release_date
    from entities e
    cross join current_clock
    left join entity_tracking_state ets on ets.entity_id = e.id
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
          'entity_type', featured_upcoming.entity_type,
          'agency_name', featured_upcoming.agency_name,
          'tracking_status', featured_upcoming.tracking_status,
          'headline', featured_upcoming.headline,
          'scheduled_date', featured_upcoming.scheduled_date::text,
          'scheduled_month', featured_upcoming.scheduled_month,
          'date_precision', featured_upcoming.date_precision,
          'date_status', featured_upcoming.date_status,
          'confidence_score', featured_upcoming.confidence_score,
          'release_format', featured_upcoming.release_format,
          'source_url', featured_upcoming.source_url,
          'source_type', featured_upcoming.source_type,
          'source_domain', featured_upcoming.source_domain,
          'evidence_summary', featured_upcoming.evidence_summary,
          'source_count', featured_upcoming.source_count
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
