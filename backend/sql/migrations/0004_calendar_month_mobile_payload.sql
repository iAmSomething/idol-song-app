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
                  'release_title', r.release_title,
                  'release_date', r.release_date::text,
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
