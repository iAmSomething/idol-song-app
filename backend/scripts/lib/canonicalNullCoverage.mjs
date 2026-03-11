import pg from 'pg';

const { Pool } = pg;

export const REPORT_VERSION = 1;

export const PRODUCT_CRITICALITY_WEIGHT = {
  wave_1: 1,
  wave_2: 0.7,
  wave_3: 0.3,
};

export const RETRY_POLICY = {
  wave_1: {
    latest: { retry_hours: 24, escalate_after_attempts: 3, escalate_after_hours: 24 * 7, cadence_label: 'daily' },
    recent: { retry_hours: 72, escalate_after_attempts: 3, escalate_after_hours: 24 * 21, cadence_label: 'tri-weekly' },
    historical: { retry_hours: 24 * 14, escalate_after_attempts: 2, escalate_after_hours: 24 * 60, cadence_label: 'biweekly' },
    unknown: { retry_hours: 24 * 7, escalate_after_attempts: 2, escalate_after_hours: 24 * 30, cadence_label: 'weekly' },
  },
  wave_2: {
    latest: { retry_hours: 24 * 7, escalate_after_attempts: 2, escalate_after_hours: 24 * 21, cadence_label: 'weekly' },
    recent: { retry_hours: 24 * 14, escalate_after_attempts: 2, escalate_after_hours: 24 * 45, cadence_label: 'biweekly' },
    historical: { retry_hours: 24 * 30, escalate_after_attempts: 2, escalate_after_hours: 24 * 90, cadence_label: 'monthly' },
    unknown: { retry_hours: 24 * 14, escalate_after_attempts: 2, escalate_after_hours: 24 * 45, cadence_label: 'biweekly' },
  },
  wave_3: {
    latest: { retry_hours: 24 * 14, escalate_after_attempts: 2, escalate_after_hours: 24 * 45, cadence_label: 'biweekly' },
    recent: { retry_hours: 24 * 30, escalate_after_attempts: 2, escalate_after_hours: 24 * 90, cadence_label: 'monthly' },
    historical: { retry_hours: 24 * 45, escalate_after_attempts: 1, escalate_after_hours: 24 * 120, cadence_label: 'monthly' },
    unknown: { retry_hours: 24 * 30, escalate_after_attempts: 1, escalate_after_hours: 24 * 90, cadence_label: 'monthly' },
  },
};

export const NULL_HYGIENE_WAVE_1_FLOORS = {
  latest: {
    'releases.title_track': 0.95,
    'release_service_links.youtube_mv': 0.8,
    'release_service_links.youtube_music': 0.85,
    'release_service_links.spotify': 0.85,
    'entities.official_youtube': 1,
    'entities.official_x': 1,
    'entities.official_instagram': 1,
  },
  recent: {
    'releases.title_track': 0.85,
    'release_service_links.youtube_mv': 0.55,
    'release_service_links.youtube_music': 0.7,
    'release_service_links.spotify': 0.7,
    'entities.official_youtube': 0.95,
    'entities.official_x': 0.95,
    'entities.official_instagram': 0.95,
  },
};

export const NULL_HYGIENE_REGRESSION_BUDGET = {
  latest: -0.02,
  recent: -0.05,
  historical: -0.03,
};

const TEXT_PLACEHOLDERS = new Set([
  '',
  '-',
  '--',
  'n/a',
  'na',
  'none',
  'null',
  'placeholder',
  'tbd',
  'unknown',
]);

const URL_PLACEHOLDER_FRAGMENTS = ['example.com', 'example.org', 'localhost', '127.0.0.1', 'placeholder'];
const POSITIVE_SERVICE_STATUSES = new Set(['canonical', 'manual_override', 'relation_match']);
const ACCEPTABLE_SERVICE_NULL_STATUSES = new Set(['no_link']);
const REVIEW_SERVICE_STATUSES = new Set(['needs_review', 'unresolved']);

const ENTITY_QUERY = `
  select
    e.id::text as entity_id,
    e.slug,
    e.entity_type,
    e.agency_name,
    e.debut_year,
    e.representative_image_url,
    max(case when l.link_type = 'youtube' and l.is_primary then l.url end) as official_youtube_url,
    max(case when l.link_type = 'x' and l.is_primary then l.url end) as official_x_url,
    max(case when l.link_type = 'instagram' and l.is_primary then l.url end) as official_instagram_url,
    max(case when l.link_type = 'website' and l.is_primary then l.url end) as official_website_url,
    max(case when u.is_active then 1 else 0 end)::integer as has_active_upcoming,
    lr.release_date::text as latest_release_date
  from entities e
  left join entity_official_links l on l.entity_id = e.id
  left join entity_tracking_state ets on ets.entity_id = e.id
  left join releases lr on lr.id = ets.latest_verified_release_id
  left join upcoming_signals u on u.entity_id = e.id and u.is_active = true
  group by
    e.id,
    e.slug,
    e.entity_type,
    e.agency_name,
    e.debut_year,
    e.representative_image_url,
    lr.release_date
`;

const RELEASE_QUERY = `
  select
    r.id::text as release_id,
    e.id::text as entity_id,
    e.slug,
    e.entity_type,
    r.release_title,
    r.release_date::text as release_date,
    extract(year from r.release_date)::integer as release_year,
    coalesce(nullif(r.release_kind, ''), 'unknown') as release_kind,
    count(t.id) filter (where t.is_title_track is true)::integer as title_track_count,
    max(case when s.service_type = 'spotify' then s.url end) as spotify_url,
    max(case when s.service_type = 'spotify' then s.status end) as spotify_status,
    max(case when s.service_type = 'spotify' then s.provenance end) as spotify_provenance,
    max(case when s.service_type = 'youtube_music' then s.url end) as youtube_music_url,
    max(case when s.service_type = 'youtube_music' then s.status end) as youtube_music_status,
    max(case when s.service_type = 'youtube_music' then s.provenance end) as youtube_music_provenance,
    max(case when s.service_type = 'youtube_mv' then s.url end) as youtube_mv_url,
    max(case when s.service_type = 'youtube_mv' then s.status end) as youtube_mv_status,
    max(case when s.service_type = 'youtube_mv' then s.provenance end) as youtube_mv_provenance
  from releases r
  join entities e on e.id = r.entity_id
  left join tracks t on t.release_id = r.id
  left join release_service_links s on s.release_id = r.id
  group by
    r.id,
    e.id,
    e.slug,
    e.entity_type,
    r.release_title,
    r.release_date,
    r.release_kind
`;

const UPCOMING_QUERY = `
  select
    u.id::text as upcoming_signal_id,
    e.id::text as entity_id,
    e.slug,
    e.entity_type,
    u.headline,
    u.date_precision,
    u.scheduled_date::text as scheduled_date,
    u.scheduled_month::text as scheduled_month,
    nullif(u.release_format, '') as release_format,
    u.confidence_score::text as confidence_score,
    u.date_status
  from upcoming_signals u
  join entities e on e.id = u.entity_id
  where u.is_active = true
`;

const ENTITY_FIELD_DEFINITIONS = [
  {
    field_family_key: 'entities.official_youtube',
    field_label: 'Official YouTube',
    table_name: 'entities',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_1',
    value_key: 'official_youtube_url',
    kind: 'url',
  },
  {
    field_family_key: 'entities.official_x',
    field_label: 'Official X',
    table_name: 'entities',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_1',
    value_key: 'official_x_url',
    kind: 'url',
  },
  {
    field_family_key: 'entities.official_instagram',
    field_label: 'Official Instagram',
    table_name: 'entities',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_1',
    value_key: 'official_instagram_url',
    kind: 'url',
  },
  {
    field_family_key: 'entities.official_website',
    field_label: 'Official Website',
    table_name: 'entities',
    taxonomy_bucket: 'conditional_null',
    product_criticality: 'wave_2',
    value_key: 'official_website_url',
    kind: 'url',
  },
  {
    field_family_key: 'entities.representative_image',
    field_label: 'Representative Image',
    table_name: 'entities',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_2',
    value_key: 'representative_image_url',
    kind: 'url',
  },
  {
    field_family_key: 'entities.agency_name',
    field_label: 'Agency',
    table_name: 'entities',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_2',
    value_key: 'agency_name',
    kind: 'text',
  },
  {
    field_family_key: 'entities.debut_year',
    field_label: 'Debut Year',
    table_name: 'entities',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_2',
    value_key: 'debut_year',
    kind: 'year',
  },
];

const UPCOMING_FIELD_DEFINITIONS = [
  {
    field_family_key: 'upcoming_signals.scheduled_date',
    field_label: 'Upcoming Exact Date',
    table_name: 'upcoming_signals',
    taxonomy_bucket: 'conditional_null',
    product_criticality: 'wave_1',
  },
  {
    field_family_key: 'upcoming_signals.scheduled_month',
    field_label: 'Upcoming Month Anchor',
    table_name: 'upcoming_signals',
    taxonomy_bucket: 'conditional_null',
    product_criticality: 'wave_1',
  },
  {
    field_family_key: 'upcoming_signals.release_format',
    field_label: 'Upcoming Release Format',
    table_name: 'upcoming_signals',
    taxonomy_bucket: 'conditional_null',
    product_criticality: 'wave_2',
  },
  {
    field_family_key: 'upcoming_signals.confidence_score',
    field_label: 'Upcoming Confidence Score',
    table_name: 'upcoming_signals',
    taxonomy_bucket: 'conditional_null',
    product_criticality: 'wave_2',
  },
];

function startOfUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(left, right) {
  return Math.floor((startOfUtcDay(left).getTime() - startOfUtcDay(right).getTime()) / 86_400_000);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isPlaceholderText(value) {
  const normalized = cleanString(value).toLowerCase();
  if (!normalized) {
    return false;
  }
  return TEXT_PLACEHOLDERS.has(normalized);
}

export function isPlaceholderUrl(value) {
  const normalized = cleanString(value).toLowerCase();
  if (!normalized) {
    return false;
  }
  return URL_PLACEHOLDER_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

export function inferReleaseCohort(dateValue, referenceDate = new Date()) {
  if (!dateValue) {
    return 'unknown';
  }
  const releaseDate = new Date(dateValue);
  if (Number.isNaN(releaseDate.getTime())) {
    return 'unknown';
  }
  const ageDays = daysBetween(referenceDate, releaseDate);
  if (ageDays <= 365) {
    return 'latest';
  }
  if (ageDays <= 365 * 3) {
    return 'recent';
  }
  return 'historical';
}

export function inferEntityCohort(latestReleaseDate, hasActiveUpcoming, referenceDate = new Date()) {
  if (hasActiveUpcoming) {
    return 'latest';
  }
  return inferReleaseCohort(latestReleaseDate, referenceDate);
}

function createBaseRecord({
  record_type,
  record_id,
  entity_id,
  entity_slug,
  entity_type,
  field_family_key,
  field_label,
  table_name,
  taxonomy_bucket,
  product_criticality,
  cohort,
  release_id = null,
  release_title = null,
  release_date = null,
  release_year = null,
  release_kind = null,
  upcoming_signal_id = null,
  source_value = null,
}) {
  return {
    record_type,
    record_id,
    entity_id,
    entity_slug,
    entity_type,
    field_family_key,
    field_label,
    table_name,
    taxonomy_bucket,
    product_criticality,
    cohort,
    release_id,
    release_title,
    release_date,
    release_year,
    release_kind,
    upcoming_signal_id,
    source_value,
    status: 'unresolved',
    status_reason: null,
    validation_rule: null,
    queue_key: `${table_name}|${field_family_key}|${record_id}`,
  };
}

function finalizeRecord(record, status, statusReason = null, validationRule = null) {
  return {
    ...record,
    status,
    status_reason: statusReason,
    validation_rule: validationRule,
  };
}

function buildEntityFieldRecord(row, definition, referenceDate) {
  const cohort = inferEntityCohort(row.latest_release_date, row.has_active_upcoming > 0, referenceDate);
  const value = row[definition.value_key];
  const base = createBaseRecord({
    record_type: 'entity',
    record_id: row.entity_id,
    entity_id: row.entity_id,
    entity_slug: row.slug,
    entity_type: row.entity_type,
    field_family_key: definition.field_family_key,
    field_label: definition.field_label,
    table_name: definition.table_name,
    taxonomy_bucket: definition.taxonomy_bucket,
    product_criticality: definition.product_criticality,
    cohort,
    source_value: value,
  });

  if (definition.kind === 'year') {
    if (Number.isInteger(value) && value >= 1900 && value <= referenceDate.getUTCFullYear() + 1) {
      return finalizeRecord(base, 'populated', 'canonical_year');
    }
    if (Number.isInteger(value)) {
      return finalizeRecord(base, 'fake_default', 'out_of_range_year', 'out_of_range_year');
    }
    return finalizeRecord(base, 'unresolved', 'missing_required_value');
  }

  if (!cleanString(value)) {
    if (definition.taxonomy_bucket === 'conditional_null') {
      return finalizeRecord(base, 'acceptable_null', 'conditional_null_allowed');
    }
    return finalizeRecord(base, 'unresolved', 'missing_required_value');
  }

  if (definition.kind === 'url' && isPlaceholderUrl(value)) {
    return finalizeRecord(base, 'fake_default', 'placeholder_url', 'placeholder_url');
  }
  if (definition.kind === 'text' && isPlaceholderText(value)) {
    return finalizeRecord(base, 'fake_default', 'placeholder_text', 'placeholder_text');
  }

  return finalizeRecord(base, 'populated', 'canonical_value');
}

function buildTitleTrackRecord(row, referenceDate) {
  const base = createBaseRecord({
    record_type: 'release',
    record_id: row.release_id,
    entity_id: row.entity_id,
    entity_slug: row.slug,
    entity_type: row.entity_type,
    field_family_key: 'releases.title_track',
    field_label: 'Title Track Resolution',
    table_name: 'releases',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_1',
    cohort: inferReleaseCohort(row.release_date, referenceDate),
    release_id: row.release_id,
    release_title: row.release_title,
    release_date: row.release_date,
    release_year: row.release_year,
    release_kind: row.release_kind,
    source_value: row.title_track_count,
  });

  if (Number(row.title_track_count) > 0) {
    return finalizeRecord(base, 'populated', 'title_track_resolved');
  }
  return finalizeRecord(base, 'unresolved', 'missing_title_track');
}

function buildServiceLinkRecord(row, serviceType, referenceDate) {
  const url = row[`${serviceType}_url`];
  const status = row[`${serviceType}_status`];
  const base = createBaseRecord({
    record_type: 'release',
    record_id: `${row.release_id}:${serviceType}`,
    entity_id: row.entity_id,
    entity_slug: row.slug,
    entity_type: row.entity_type,
    field_family_key: `release_service_links.${serviceType}`,
    field_label:
      serviceType === 'spotify'
        ? 'Spotify Release Link'
        : serviceType === 'youtube_music'
          ? 'YouTube Music Release Link'
          : 'YouTube MV Canonical Link',
    table_name: 'release_service_links',
    taxonomy_bucket: 'required_backfill',
    product_criticality: 'wave_1',
    cohort: inferReleaseCohort(row.release_date, referenceDate),
    release_id: row.release_id,
    release_title: row.release_title,
    release_date: row.release_date,
    release_year: row.release_year,
    release_kind: row.release_kind,
    source_value: url,
  });

  if (POSITIVE_SERVICE_STATUSES.has(status) && cleanString(url) && !isPlaceholderUrl(url)) {
    return finalizeRecord(base, 'populated', status);
  }
  if (POSITIVE_SERVICE_STATUSES.has(status) && (!cleanString(url) || isPlaceholderUrl(url))) {
    return finalizeRecord(base, 'fake_default', 'positive_status_without_valid_url', 'positive_status_without_valid_url');
  }
  if (ACCEPTABLE_SERVICE_NULL_STATUSES.has(status)) {
    return finalizeRecord(base, 'acceptable_null', 'negative_canonical_status');
  }
  if (REVIEW_SERVICE_STATUSES.has(status) || !status) {
    return finalizeRecord(base, 'unresolved', status || 'missing_service_row');
  }
  if (isPlaceholderUrl(url)) {
    return finalizeRecord(base, 'fake_default', 'placeholder_url', 'placeholder_url');
  }
  return finalizeRecord(base, 'unresolved', status || 'unknown_status');
}

function buildUpcomingFieldRecord(row, definition) {
  const base = createBaseRecord({
    record_type: 'upcoming_signal',
    record_id: `${row.upcoming_signal_id}:${definition.field_family_key}`,
    entity_id: row.entity_id,
    entity_slug: row.slug,
    entity_type: row.entity_type,
    field_family_key: definition.field_family_key,
    field_label: definition.field_label,
    table_name: definition.table_name,
    taxonomy_bucket: definition.taxonomy_bucket,
    product_criticality: definition.product_criticality,
    cohort: 'latest',
    upcoming_signal_id: row.upcoming_signal_id,
    source_value:
      definition.field_family_key === 'upcoming_signals.scheduled_date'
        ? row.scheduled_date
        : definition.field_family_key === 'upcoming_signals.scheduled_month'
          ? row.scheduled_month
          : definition.field_family_key === 'upcoming_signals.release_format'
            ? row.release_format
            : row.confidence_score,
  });

  if (definition.field_family_key === 'upcoming_signals.scheduled_date') {
    if (row.date_precision === 'exact' && row.scheduled_date) {
      return finalizeRecord(base, 'populated', 'exact_date_available');
    }
    if (row.date_precision !== 'exact' && !row.scheduled_date) {
      return finalizeRecord(base, 'acceptable_null', `precision_${row.date_precision}`);
    }
    return finalizeRecord(base, 'unresolved', 'scheduled_date_inconsistent');
  }

  if (definition.field_family_key === 'upcoming_signals.scheduled_month') {
    if (row.date_precision === 'month_only' && row.scheduled_month) {
      return finalizeRecord(base, 'populated', 'month_anchor_available');
    }
    if (row.date_precision !== 'month_only' && !row.scheduled_month) {
      return finalizeRecord(base, 'acceptable_null', `precision_${row.date_precision}`);
    }
    return finalizeRecord(base, 'unresolved', 'scheduled_month_inconsistent');
  }

  if (definition.field_family_key === 'upcoming_signals.release_format') {
    if (!cleanString(row.release_format)) {
      return finalizeRecord(base, 'acceptable_null', 'metadata_not_announced');
    }
    if (isPlaceholderText(row.release_format)) {
      return finalizeRecord(base, 'fake_default', 'placeholder_text', 'placeholder_text');
    }
    return finalizeRecord(base, 'populated', 'format_available');
  }

  if (row.confidence_score === null || row.confidence_score === undefined || row.confidence_score === '') {
    return finalizeRecord(base, 'acceptable_null', 'confidence_not_scored');
  }
  return finalizeRecord(base, 'populated', 'confidence_available');
}

export async function createCoveragePool(connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED) {
  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_URL_POOLED is required.');
  }

  return new Pool({
    connectionString,
    application_name: 'idol-song-app-null-coverage',
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000,
    query_timeout: 20_000,
  });
}

export async function fetchCanonicalCoverageInputs(pool) {
  const [entitiesResult, releasesResult, upcomingResult] = await Promise.all([
    pool.query(ENTITY_QUERY),
    pool.query(RELEASE_QUERY),
    pool.query(UPCOMING_QUERY),
  ]);

  return {
    entities: entitiesResult.rows,
    releases: releasesResult.rows,
    upcoming_signals: upcomingResult.rows,
  };
}

export function buildCoverageRecords(inputs, referenceDate = new Date()) {
  const records = [];

  for (const row of inputs.entities) {
    for (const definition of ENTITY_FIELD_DEFINITIONS) {
      records.push(buildEntityFieldRecord(row, definition, referenceDate));
    }
  }

  for (const row of inputs.releases) {
    records.push(buildTitleTrackRecord(row, referenceDate));
    records.push(buildServiceLinkRecord(row, 'spotify', referenceDate));
    records.push(buildServiceLinkRecord(row, 'youtube_music', referenceDate));
    records.push(buildServiceLinkRecord(row, 'youtube_mv', referenceDate));
  }

  for (const row of inputs.upcoming_signals) {
    for (const definition of UPCOMING_FIELD_DEFINITIONS) {
      records.push(buildUpcomingFieldRecord(row, definition));
    }
  }

  return records;
}

function inferCatalogWindow(record) {
  if (record.cohort === 'latest') {
    return 'latest_12m';
  }
  if (Number.isInteger(record.release_year) && record.release_year < 2024) {
    return 'pre_2024';
  }
  if (record.cohort === 'recent') {
    return 'recent_13_36m';
  }
  if (record.cohort === 'historical') {
    return 'historical_36m_plus';
  }
  return 'entity_or_upcoming';
}

function createAggregateRecord(seed) {
  return {
    ...seed,
    total_records: 0,
    populated_records: 0,
    acceptable_null_records: 0,
    true_optional_records: 0,
    unresolved_records: 0,
    fake_default_records: 0,
    weighted_points_observed: 0,
    weighted_points_possible: 0,
    effective_coverage_ratio: 1,
    observed_ratio: 1,
    problem_ratio: 0,
  };
}

function finalizeAggregateRecord(record) {
  const actionable = record.total_records - record.acceptable_null_records - record.true_optional_records;
  const weightedPossible = record.weighted_points_possible;
  const weightedObserved = record.weighted_points_observed;
  return {
    ...record,
    actionable_records: actionable,
    effective_coverage_ratio:
      actionable > 0 ? Number((record.populated_records / actionable).toFixed(4)) : 1,
    observed_ratio:
      record.total_records > 0 ? Number(((record.populated_records + record.acceptable_null_records + record.true_optional_records) / record.total_records).toFixed(4)) : 1,
    problem_ratio: actionable > 0 ? Number(((record.unresolved_records + record.fake_default_records) / actionable).toFixed(4)) : 0,
    weighted_coverage_ratio: weightedPossible > 0 ? Number((weightedObserved / weightedPossible).toFixed(4)) : 1,
  };
}

export function aggregateCoverageRecords(records, dimensionKeys) {
  const aggregates = new Map();

  for (const record of records) {
    const seed = Object.fromEntries(dimensionKeys.map((key) => [key, record[key] ?? null]));
    const aggregateKey = JSON.stringify(seed);
    if (!aggregates.has(aggregateKey)) {
      aggregates.set(aggregateKey, createAggregateRecord(seed));
    }
    const aggregate = aggregates.get(aggregateKey);
    aggregate.total_records += 1;
    aggregate[`${record.status}_records`] += 1;

    const weight = PRODUCT_CRITICALITY_WEIGHT[record.product_criticality] ?? 0;
    if (record.status !== 'acceptable_null' && record.status !== 'true_optional') {
      aggregate.weighted_points_possible += weight;
      if (record.status === 'populated') {
        aggregate.weighted_points_observed += weight;
      }
    }
  }

  return [...aggregates.values()]
    .map(finalizeAggregateRecord)
    .sort((left, right) => {
      if (left.problem_ratio !== right.problem_ratio) {
        return right.problem_ratio - left.problem_ratio;
      }
      return String(left.field_family_key ?? '').localeCompare(String(right.field_family_key ?? ''));
    });
}

function summarizeTopProblems(overallFamilies) {
  return overallFamilies
    .filter((entry) => entry.actionable_records > 0)
    .sort((left, right) => {
      if (left.product_criticality !== right.product_criticality) {
        return (PRODUCT_CRITICALITY_WEIGHT[right.product_criticality] ?? 0) - (PRODUCT_CRITICALITY_WEIGHT[left.product_criticality] ?? 0);
      }
      if (left.effective_coverage_ratio !== right.effective_coverage_ratio) {
        return left.effective_coverage_ratio - right.effective_coverage_ratio;
      }
      return right.fake_default_records - left.fake_default_records;
    })
    .slice(0, 8)
    .map(
      (entry) =>
        `${entry.field_label}: coverage=${(entry.effective_coverage_ratio * 100).toFixed(1)}%, unresolved=${entry.unresolved_records}, fake_default=${entry.fake_default_records}`,
    );
}

export function buildCoverageReport(records, referenceDate = new Date()) {
  const generatedAt = new Date().toISOString();
  const overallFamilies = aggregateCoverageRecords(records, [
    'table_name',
    'field_family_key',
    'field_label',
    'taxonomy_bucket',
    'product_criticality',
  ]);
  const byCohort = aggregateCoverageRecords(records, [
    'field_family_key',
    'field_label',
    'table_name',
    'product_criticality',
    'cohort',
  ]);
  const byEntityType = aggregateCoverageRecords(records, [
    'field_family_key',
    'field_label',
    'table_name',
    'product_criticality',
    'entity_type',
  ]);
  const byCatalogWindow = aggregateCoverageRecords(
    records.map((record) => ({ ...record, catalog_window: inferCatalogWindow(record) })),
    ['field_family_key', 'field_label', 'table_name', 'product_criticality', 'catalog_window'],
  );
  const byYear = aggregateCoverageRecords(
    records.filter((record) => Number.isInteger(record.release_year)),
    ['field_family_key', 'field_label', 'table_name', 'product_criticality', 'release_year'],
  );
  const byReleaseKind = aggregateCoverageRecords(
    records.filter((record) => record.release_kind),
    ['field_family_key', 'field_label', 'table_name', 'product_criticality', 'release_kind'],
  );
  const byCriticality = aggregateCoverageRecords(records, ['product_criticality']);

  const fakeDefaults = records.filter((record) => record.status === 'fake_default');
  const unresolved = records.filter((record) => record.status === 'unresolved');
  const wave1FloorChecks = buildWave1FloorChecks(byCohort);
  const latestFloorFailures = wave1FloorChecks.filter((entry) => entry.cohort === 'latest' && entry.pass === false);
  const recentFloorFailures = wave1FloorChecks.filter((entry) => entry.cohort === 'recent' && entry.pass === false);

  return {
    generated_at: generatedAt,
    report_version: REPORT_VERSION,
    reference_date: startOfUtcDay(referenceDate).toISOString().slice(0, 10),
    summary_lines: [
      `field observations=${records.length}`,
      ...summarizeTopProblems(overallFamilies),
    ],
    counts: {
      field_observations: records.length,
      fake_default_records: fakeDefaults.length,
      unresolved_records: unresolved.length,
    },
    field_family_summary: overallFamilies,
    slices: {
      by_cohort: byCohort,
      by_entity_type: byEntityType,
      by_catalog_window: byCatalogWindow,
      by_year: byYear,
      by_release_kind: byReleaseKind,
      by_product_criticality: byCriticality,
    },
    gate_evidence: {
      wave_1_floor_checks: wave1FloorChecks,
      latest_wave_1_floor_failures: latestFloorFailures,
      recent_wave_1_floor_failures: recentFloorFailures,
    },
    validations: {
      placeholder_rules: [
        'placeholder_text',
        'placeholder_url',
        'positive_status_without_valid_url',
      ],
      fake_default_records: fakeDefaults,
      fake_default_counts_by_rule: fakeDefaults.reduce((accumulator, record) => {
        const key = record.validation_rule || 'unknown';
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {}),
    },
  };
}

export function buildWave1FloorChecks(byCohort) {
  const byKey = new Map(
    (Array.isArray(byCohort) ? byCohort : []).map((entry) => [`${entry.field_family_key}|${entry.cohort}`, entry]),
  );

  const checks = [];
  for (const [cohort, floors] of Object.entries(NULL_HYGIENE_WAVE_1_FLOORS)) {
    for (const [fieldFamilyKey, minimumRatio] of Object.entries(floors)) {
      const entry = byKey.get(`${fieldFamilyKey}|${cohort}`) ?? null;
      const ratio = entry?.effective_coverage_ratio ?? 0;
      checks.push({
        cohort,
        field_family_key: fieldFamilyKey,
        field_label: entry?.field_label ?? fieldFamilyKey,
        minimum_ratio: minimumRatio,
        effective_coverage_ratio: ratio,
        unresolved_records: entry?.unresolved_records ?? null,
        fake_default_records: entry?.fake_default_records ?? null,
        pass: entry !== null && ratio >= minimumRatio,
      });
    }
  }

  return checks;
}

function sameDay(left, right) {
  if (!left || !right) {
    return false;
  }
  return String(left).slice(0, 10) === String(right).slice(0, 10);
}

export function getRetryPolicy(productCriticality, cohort) {
  const criticalityPolicy = RETRY_POLICY[productCriticality] ?? RETRY_POLICY.wave_3;
  return criticalityPolicy[cohort] ?? criticalityPolicy.unknown;
}

function buildPriorityScore(record) {
  const criticalityWeight = PRODUCT_CRITICALITY_WEIGHT[record.product_criticality] ?? 0;
  const cohortWeight = record.cohort === 'latest' ? 3 : record.cohort === 'recent' ? 2 : 1;
  const validationWeight = record.status === 'fake_default' ? 1.5 : 1;
  return Number((criticalityWeight * cohortWeight * validationWeight).toFixed(2));
}

export function buildRecheckQueue(records, previousQueue = [], generatedAt = new Date().toISOString()) {
  const previousByKey = new Map(previousQueue.map((entry) => [entry.queue_key, entry]));
  const currentProblems = records.filter(
    (record) =>
      (record.status === 'unresolved' || record.status === 'fake_default') &&
      (record.product_criticality === 'wave_1' || record.product_criticality === 'wave_2'),
  );

  const queue = currentProblems.map((record) => {
    const previous = previousByKey.get(record.queue_key);
    const policy = getRetryPolicy(record.product_criticality, record.cohort);
    const retryCount = previous
      ? sameDay(previous.last_checked_at, generatedAt)
        ? previous.retry_count
        : previous.retry_count + 1
      : 1;
    const firstSeenAt = previous?.first_seen_at ?? generatedAt;
    const ageHours = Math.max(0, Math.round((new Date(generatedAt).getTime() - new Date(firstSeenAt).getTime()) / 3_600_000));
    const escalated =
      previous?.review_state === 'escalate_review' ||
      retryCount >= policy.escalate_after_attempts ||
      ageHours >= policy.escalate_after_hours;

    return {
      queue_key: record.queue_key,
      record_type: record.record_type,
      table_name: record.table_name,
      field_family_key: record.field_family_key,
      field_label: record.field_label,
      taxonomy_bucket: record.taxonomy_bucket,
      product_criticality: record.product_criticality,
      cohort: record.cohort,
      entity_type: record.entity_type,
      entity_slug: record.entity_slug,
      entity_id: record.entity_id,
      release_id: record.release_id,
      release_title: record.release_title,
      release_date: record.release_date,
      release_kind: record.release_kind,
      upcoming_signal_id: record.upcoming_signal_id,
      status: record.status,
      status_reason: record.status_reason,
      validation_rule: record.validation_rule,
      source_value: record.source_value,
      first_seen_at: firstSeenAt,
      last_checked_at: generatedAt,
      retry_count: retryCount,
      next_retry_at: new Date(new Date(generatedAt).getTime() + policy.retry_hours * 3_600_000).toISOString(),
      review_state: escalated ? 'escalate_review' : 'needs_retry',
      retry_policy: policy,
      priority_score: buildPriorityScore(record),
    };
  });

  queue.sort((left, right) => {
    if (left.priority_score !== right.priority_score) {
      return right.priority_score - left.priority_score;
    }
    return left.queue_key.localeCompare(right.queue_key);
  });
  return queue;
}

export function buildTrendHistorySnapshot(report) {
  return {
    generated_at: report.generated_at,
    field_family_summary: report.field_family_summary.map((entry) => ({
      field_family_key: entry.field_family_key,
      field_label: entry.field_label,
      table_name: entry.table_name,
      product_criticality: entry.product_criticality,
      effective_coverage_ratio: entry.effective_coverage_ratio,
      unresolved_records: entry.unresolved_records,
      fake_default_records: entry.fake_default_records,
    })),
    by_cohort: report.slices.by_cohort.map((entry) => ({
      field_family_key: entry.field_family_key,
      cohort: entry.cohort,
      effective_coverage_ratio: entry.effective_coverage_ratio,
      unresolved_records: entry.unresolved_records,
      fake_default_records: entry.fake_default_records,
      product_criticality: entry.product_criticality,
    })),
  };
}

export function buildTrendReport(currentReport, history) {
  const snapshots = history.snapshots ?? [];
  const latestSnapshot = snapshots.at(-1) ?? buildTrendHistorySnapshot(currentReport);
  const previousSnapshot = snapshots.length > 1 ? snapshots.at(-2) : null;
  const previousByKey = new Map(
    (previousSnapshot?.by_cohort ?? []).map((entry) => [`${entry.field_family_key}|${entry.cohort}`, entry]),
  );

  const deltas = latestSnapshot.by_cohort.map((entry) => {
    const previous = previousByKey.get(`${entry.field_family_key}|${entry.cohort}`);
    const delta = previous ? Number((entry.effective_coverage_ratio - previous.effective_coverage_ratio).toFixed(4)) : null;
    return {
      field_family_key: entry.field_family_key,
      cohort: entry.cohort,
      product_criticality: entry.product_criticality,
      current_effective_coverage_ratio: entry.effective_coverage_ratio,
      previous_effective_coverage_ratio: previous?.effective_coverage_ratio ?? null,
      delta_effective_coverage_ratio: delta,
      current_unresolved_records: entry.unresolved_records,
      previous_unresolved_records: previous?.unresolved_records ?? null,
      current_fake_default_records: entry.fake_default_records,
      previous_fake_default_records: previous?.fake_default_records ?? null,
    };
  });

  const criticalRegressions = deltas.filter((entry) => {
    if (entry.delta_effective_coverage_ratio === null) {
      return false;
    }
    const threshold = NULL_HYGIENE_REGRESSION_BUDGET[entry.cohort] ?? -0.05;
    return entry.delta_effective_coverage_ratio <= threshold && entry.product_criticality === 'wave_1';
  });

  const summaryLines = previousSnapshot
    ? [
        `history_snapshots=${snapshots.length}`,
        `critical_regressions=${criticalRegressions.length}`,
        ...criticalRegressions.slice(0, 8).map(
          (entry) =>
            `${entry.field_family_key} (${entry.cohort}) delta=${(entry.delta_effective_coverage_ratio * 100).toFixed(1)}pp`,
        ),
      ]
    : ['history_snapshots=1', 'baseline_only=true', 'No previous field-level coverage snapshot was available.'];

  return {
    generated_at: new Date().toISOString(),
    report_version: REPORT_VERSION,
    baseline_available: previousSnapshot !== null,
    history_snapshots: snapshots.length,
    latest_snapshot_generated_at: latestSnapshot.generated_at,
    previous_snapshot_generated_at: previousSnapshot?.generated_at ?? null,
    summary_lines: summaryLines,
    critical_regressions: criticalRegressions,
    deltas,
  };
}

export function buildNullCoverageEvaluation(coverageReport, trendReport) {
  const floorChecks = buildWave1FloorChecks(coverageReport?.slices?.by_cohort ?? []);
  const latestFloorFailures = floorChecks.filter((entry) => entry.cohort === 'latest' && entry.pass === false);
  const recentFloorFailures = floorChecks.filter((entry) => entry.cohort === 'recent' && entry.pass === false);
  const fakeDefaultEscalations = (coverageReport?.slices?.by_cohort ?? []).filter(
    (entry) =>
      entry.product_criticality === 'wave_1' &&
      (entry.cohort === 'latest' || entry.cohort === 'recent') &&
      (entry.fake_default_records ?? 0) > 0,
  );
  const criticalRegressions = Array.isArray(trendReport?.critical_regressions) ? trendReport.critical_regressions : [];
  const latestRegressionFailures = criticalRegressions.filter((entry) => entry.cohort === 'latest');
  const reviewRegressions = criticalRegressions.filter((entry) => entry.cohort !== 'latest');
  const scoreSource = floorChecks.map((entry) =>
    entry.minimum_ratio > 0 ? Math.min(entry.effective_coverage_ratio / entry.minimum_ratio, 1) : 1,
  );
  const scoreRatio =
    scoreSource.length > 0
      ? Number((scoreSource.reduce((sum, value) => sum + value, 0) / scoreSource.length).toFixed(4))
      : 1;

  const blockerReasons = [];
  const reviewReasons = [];

  if (latestFloorFailures.length > 0) {
    blockerReasons.push(
      ...latestFloorFailures.map(
        (entry) =>
          `${entry.field_family_key} latest ${(entry.effective_coverage_ratio * 100).toFixed(1)}% < ${(entry.minimum_ratio * 100).toFixed(1)}%`,
      ),
    );
  }
  if (recentFloorFailures.length >= 2) {
    blockerReasons.push(
      ...recentFloorFailures.map(
        (entry) =>
          `${entry.field_family_key} recent ${(entry.effective_coverage_ratio * 100).toFixed(1)}% < ${(entry.minimum_ratio * 100).toFixed(1)}%`,
      ),
    );
  } else if (recentFloorFailures.length === 1) {
    reviewReasons.push(
      `${recentFloorFailures[0].field_family_key} recent ${(recentFloorFailures[0].effective_coverage_ratio * 100).toFixed(1)}% < ${(recentFloorFailures[0].minimum_ratio * 100).toFixed(1)}%`,
    );
  }
  if (fakeDefaultEscalations.length > 0) {
    blockerReasons.push(
      ...fakeDefaultEscalations.map(
        (entry) => `${entry.field_family_key} ${entry.cohort} fake_default=${entry.fake_default_records}`,
      ),
    );
  }
  if (latestRegressionFailures.length > 0) {
    blockerReasons.push(
      ...latestRegressionFailures.map(
        (entry) =>
          `${entry.field_family_key} latest regression ${(entry.delta_effective_coverage_ratio * 100).toFixed(1)}pp`,
      ),
    );
  }
  if (reviewRegressions.length > 0) {
    reviewReasons.push(
      ...reviewRegressions.map(
        (entry) =>
          `${entry.field_family_key} ${entry.cohort} regression ${(entry.delta_effective_coverage_ratio * 100).toFixed(1)}pp`,
      ),
    );
  }
  if (trendReport?.baseline_available !== true) {
    reviewReasons.push('trend baseline unavailable');
  }

  const status =
    blockerReasons.length > 0 ? 'fail' : reviewReasons.length > 0 ? 'needs_review' : 'pass';

  return {
    status,
    score_ratio: scoreRatio,
    trend_baseline_available: trendReport?.baseline_available === true,
    floor_checks: floorChecks,
    latest_floor_failures: latestFloorFailures,
    recent_floor_failures: recentFloorFailures,
    fake_default_escalations: fakeDefaultEscalations,
    critical_regressions: criticalRegressions,
    blocker_reasons: blockerReasons,
    review_reasons: reviewReasons,
  };
}
