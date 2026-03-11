import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createCoveragePool, inferEntityCohort, inferReleaseCohort } from './canonicalNullCoverage.mjs';

const SERVICE_TYPES = ['spotify', 'youtube_music', 'youtube_mv'];
const IDENTITY_CRITICAL_FIELDS = new Set([
  'entities.representative_image',
  'entities.official_youtube',
  'entities.official_x',
  'entities.official_instagram',
]);
const HIGH_VISIBILITY_NAMES = new Set([
  'BTS',
  'BLACKPINK',
  'TWICE',
  'EXO',
  'SHINee',
  'SEVENTEEN',
  'Stray Kids',
  'Red Velvet',
  '(G)I-DLE',
  'TOMORROW X TOGETHER',
  'MAMAMOO',
  'ATEEZ',
  'ITZY',
  'NCT DREAM',
  'aespa',
  'IVE',
  'LE SSERAFIM',
  'ENHYPEN',
]);

const ENTITY_IDENTITY_FIELDS = [
  {
    field_family_key: 'entities.representative_image',
    label: 'Representative Image',
    priority_rank: 0,
    accessor: (row) => row.representative_image_url,
  },
  {
    field_family_key: 'entities.official_youtube',
    label: 'Official YouTube',
    priority_rank: 1,
    accessor: (row) => row.official_youtube_url,
  },
  {
    field_family_key: 'entities.official_x',
    label: 'Official X',
    priority_rank: 2,
    accessor: (row) => row.official_x_url,
  },
  {
    field_family_key: 'entities.official_instagram',
    label: 'Official Instagram',
    priority_rank: 3,
    accessor: (row) => row.official_instagram_url,
  },
  {
    field_family_key: 'entities.agency_name',
    label: 'Agency',
    priority_rank: 4,
    accessor: (row) => row.agency_name,
  },
  {
    field_family_key: 'entities.debut_year',
    label: 'Debut Year',
    priority_rank: 5,
    accessor: (row) => row.debut_year,
  },
];

const RELEASE_QUERY = `
  select
    e.id::text as entity_id,
    e.slug,
    e.display_name,
    e.canonical_name,
    e.entity_type,
    e.agency_name,
    e.debut_year,
    e.representative_image_url,
    max(case when l.link_type = 'youtube' and l.is_primary then l.url end) as official_youtube_url,
    max(case when l.link_type = 'x' and l.is_primary then l.url end) as official_x_url,
    max(case when l.link_type = 'instagram' and l.is_primary then l.url end) as official_instagram_url,
    r.id::text as release_id,
    r.release_title,
    r.release_date::text as release_date,
    extract(year from r.release_date)::integer as release_year,
    r.stream,
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
    max(case when s.service_type = 'youtube_mv' then s.provenance end) as youtube_mv_provenance,
    max(case when u.is_active then 1 else 0 end)::integer as has_active_upcoming
  from releases r
  join entities e on e.id = r.entity_id
  left join tracks t on t.release_id = r.id
  left join release_service_links s on s.release_id = r.id
  left join entity_official_links l on l.entity_id = e.id
  left join upcoming_signals u on u.entity_id = e.id and u.is_active = true
  group by
    e.id,
    e.slug,
    e.display_name,
    e.canonical_name,
    e.entity_type,
    e.agency_name,
    e.debut_year,
    e.representative_image_url,
    r.id,
    r.release_title,
    r.release_date,
    r.stream,
    r.release_kind
`;

const ENTITY_QUERY = `
  select
    e.id::text as entity_id,
    e.slug,
    e.display_name,
    e.canonical_name,
    e.entity_type,
    e.agency_name,
    e.debut_year,
    e.representative_image_url,
    max(case when l.link_type = 'youtube' and l.is_primary then l.url end) as official_youtube_url,
    max(case when l.link_type = 'x' and l.is_primary then l.url end) as official_x_url,
    max(case when l.link_type = 'instagram' and l.is_primary then l.url end) as official_instagram_url,
    max(case when l.link_type = 'artist_source' and l.is_primary then l.url end) as artist_source_url,
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
    e.display_name,
    e.canonical_name,
    e.entity_type,
    e.agency_name,
    e.debut_year,
    e.representative_image_url,
    lr.release_date
`;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return cleanString(value).length > 0;
}

function parseJsonFile(filePath) {
  return readFile(filePath, 'utf8').then((raw) => JSON.parse(raw));
}

function buildKey(...parts) {
  return parts.map((part) => String(part ?? '').trim()).join('|');
}

function buildPriorityTier({ releaseCohort, entityCohort, sourceTier, displayName, hasActiveUpcoming }) {
  const effectiveCohort = releaseCohort ?? entityCohort ?? 'historical';
  const tier = sourceTier ?? 'unknown';
  const highVisibility = HIGH_VISIBILITY_NAMES.has(displayName);
  if (highVisibility || hasActiveUpcoming || (effectiveCohort === 'latest' && tier === 'core')) {
    return 'tier_1';
  }
  if (tier === 'core' || effectiveCohort === 'latest' || effectiveCohort === 'recent') {
    return 'tier_2';
  }
  return 'tier_3';
}

function priorityTierRank(value) {
  if (value === 'tier_1') {
    return 0;
  }
  if (value === 'tier_2') {
    return 1;
  }
  return 2;
}

function cohortRank(value) {
  if (value === 'latest') {
    return 0;
  }
  if (value === 'recent') {
    return 1;
  }
  if (value === 'historical') {
    return 2;
  }
  return 3;
}

function gapStatusRank(value) {
  if (value === 'fake_default') {
    return 0;
  }
  if (value === 'needs_review') {
    return 1;
  }
  if (value === 'unresolved') {
    return 2;
  }
  if (value === 'no_link') {
    return 3;
  }
  return 4;
}

function summarizeCounts(rows, key) {
  return rows.reduce((accumulator, row) => {
    const bucket = row[key] ?? 'unknown';
    accumulator[bucket] = (accumulator[bucket] || 0) + 1;
    return accumulator;
  }, {});
}

function safeDisplayName(row) {
  return row.display_name || row.canonical_name || row.slug;
}

function classifyServiceGap(row, serviceType) {
  const status = cleanString(row[`${serviceType}_status`]);
  const url = cleanString(row[`${serviceType}_url`]);

  if (url && ['canonical', 'manual_override', 'relation_match'].includes(status)) {
    return null;
  }
  if (status === 'needs_review') {
    return { gap_status: 'needs_review', confidence_bucket: 'review_needed' };
  }
  if (status === 'unresolved' || status.length === 0) {
    return { gap_status: 'unresolved', confidence_bucket: 'low_confidence_gap' };
  }
  if (status === 'no_link') {
    return { gap_status: 'no_link', confidence_bucket: 'explicit_absence' };
  }
  return { gap_status: 'fake_default', confidence_bucket: 'invalid_placeholder' };
}

function buildServiceRecommendedAction(serviceType, gapStatus, supportRow, detailRow) {
  if (serviceType === 'youtube_mv') {
    if (supportRow?.youtube_video_status === 'needs_review') {
      return supportRow.recommended_action;
    }
    if (gapStatus === 'no_link') {
      return '공식 채널과 label allowlist를 다시 확인해도 canonical MV가 없으면 no_link 상태를 유지합니다.';
    }
    if (supportRow?.missing_mv_allowlist) {
      return 'team/label YouTube allowlist를 먼저 보강한 뒤 canonical MV를 다시 검토합니다.';
    }
    return 'allowlist 범위에서 공식 MV를 재검토하고 명확할 때만 manual override를 추가합니다.';
  }

  if (gapStatus === 'no_link') {
    return `현재 ${serviceType} canonical 링크가 없는 상태로 분류돼 있습니다. recent/high-impact release부터 수동 큐레이션 여부를 다시 판단합니다.`;
  }

  if ((detailRow?.attempted_methods_count ?? 0) > 0) {
    return `existing release-detail acquisition ${detailRow.attempted_methods_count}단계를 다시 확인하고 ${serviceType} canonical 링크를 보강합니다.`;
  }

  return `${serviceType} canonical 링크가 비어 있으므로 recent/high-impact release부터 수동 보강 후보로 검토합니다.`;
}

function buildEntityFieldHints(row, support, fieldKey) {
  const group = safeDisplayName(row);
  if (fieldKey === 'entities.official_youtube') {
    const allowlist = support.youtubeByGroup.get(group);
    if (allowlist?.primary_team_channel_url) {
      return ['youtubeChannelAllowlists.primary_team_channel_url'];
    }
    return [];
  }
  if (fieldKey === 'entities.official_x') {
    return support.socialByGroup.get(group)?.x_url ? ['artist_socials_structured.x_url'] : [];
  }
  if (fieldKey === 'entities.official_instagram') {
    return support.socialByGroup.get(group)?.instagram_url ? ['artist_socials_structured.instagram_url'] : [];
  }
  if (fieldKey === 'entities.representative_image') {
    return support.badgeByGroup.get(group)?.badge_image_url ? ['teamBadgeAssets.badge_image_url'] : [];
  }
  return [];
}

export async function loadWorkbenchSupport(rootDir) {
  const [
    structuredSocials,
    youtubeAllowlists,
    badgeAssets,
    mvReviewQueue,
    titleTrackQueue,
    releaseDetailQueue,
  ] = await Promise.all([
    parseJsonFile(path.join(rootDir, 'artist_socials_structured_2026-03-04.json')),
    parseJsonFile(path.join(rootDir, 'web/src/data/youtubeChannelAllowlists.json')),
    parseJsonFile(path.join(rootDir, 'web/src/data/teamBadgeAssets.json')),
    parseJsonFile(path.join(rootDir, 'mv_manual_review_queue.json')),
    parseJsonFile(path.join(rootDir, 'title_track_manual_review_queue.json')),
    parseJsonFile(path.join(rootDir, 'release_detail_manual_review_queue.json')),
  ]);

  const socialByGroup = new Map(structuredSocials.map((row) => [row.artist, row]));
  const youtubeByGroup = new Map(youtubeAllowlists.map((row) => [row.group, row]));
  const badgeByGroup = new Map(badgeAssets.map((row) => [row.group, row]));
  const mvReviewByKey = new Map(
    mvReviewQueue.map((row) => [buildKey(row.group, row.release_title, row.release_date, row.stream), row]),
  );
  const titleTrackByKey = new Map(
    titleTrackQueue.map((row) => [buildKey(row.group, row.release_title, row.release_date, row.stream), row]),
  );
  const releaseDetailByKey = new Map(
    releaseDetailQueue.map((row) => [buildKey(row.group, row.release_title, row.release_date, row.stream), row]),
  );

  return {
    socialByGroup,
    youtubeByGroup,
    badgeByGroup,
    mvReviewByKey,
    titleTrackByKey,
    releaseDetailByKey,
  };
}

export async function fetchWorkbenchInputs(pool) {
  const [releaseResult, entityResult] = await Promise.all([
    pool.query(RELEASE_QUERY),
    pool.query(ENTITY_QUERY),
  ]);

  return {
    releases: releaseResult.rows,
    entities: entityResult.rows,
  };
}

export function buildServiceLinkGapQueues(inputs, support, referenceDate = new Date()) {
  const queues = {
    spotify: [],
    youtube_music: [],
    youtube_mv: [],
  };

  for (const row of inputs.releases) {
    const displayName = safeDisplayName(row);
    const sourceTier = support.socialByGroup.get(displayName)?.tier ?? 'unknown';
    const entityCohort = inferEntityCohort(row.release_date, row.has_active_upcoming > 0, referenceDate);
    const releaseCohort = inferReleaseCohort(row.release_date, referenceDate);
    const priorityTier = buildPriorityTier({
      releaseCohort,
      entityCohort,
      sourceTier,
      displayName,
      hasActiveUpcoming: row.has_active_upcoming > 0,
    });

    for (const serviceType of SERVICE_TYPES) {
      const gap = classifyServiceGap(row, serviceType);
      if (!gap) {
        continue;
      }

      const queueKey = buildKey(displayName, row.release_title, row.release_date, row.stream);
      const mvSupportRow = serviceType === 'youtube_mv' ? support.mvReviewByKey.get(queueKey) : null;
      const detailSupportRow = support.releaseDetailByKey.get(queueKey) ?? null;
      const reason =
        mvSupportRow?.review_reason ??
        (gap.gap_status === 'no_link'
          ? 'canonical link가 explicit no_link 상태로 남아 있습니다.'
          : gap.gap_status === 'needs_review'
            ? 'canonical link 후보가 있지만 review가 끝나지 않았습니다.'
            : gap.gap_status === 'fake_default'
              ? 'positive status 또는 placeholder가 남아 있어 canonical link 검증이 필요합니다.'
              : 'canonical link가 아직 unresolved 상태입니다.');

      queues[serviceType].push({
        queue_key: `${row.release_id}:${serviceType}`,
        service_type: serviceType,
        group: displayName,
        slug: row.slug,
        entity_type: row.entity_type,
        entity_tier: sourceTier,
        priority_tier: priorityTier,
        high_impact: priorityTier === 'tier_1',
        entity_cohort: entityCohort,
        release_cohort: releaseCohort,
        release_title: row.release_title,
        release_date: row.release_date,
        release_year: row.release_year,
        stream: row.stream,
        release_kind: row.release_kind,
        gap_status: gap.gap_status,
        confidence_bucket: gap.confidence_bucket,
        current_status: cleanString(row[`${serviceType}_status`]) || 'missing_service_row',
        current_url: cleanString(row[`${serviceType}_url`]) || '',
        provenance: cleanString(row[`${serviceType}_provenance`]) || '',
        attempted_methods_count: detailSupportRow?.attempted_methods_count ?? 0,
        review_reason: reason,
        recommended_action: buildServiceRecommendedAction(serviceType, gap.gap_status, mvSupportRow, detailSupportRow),
        suggested_search_query: mvSupportRow?.suggested_search_query ?? '',
        missing_mv_allowlist: mvSupportRow?.missing_mv_allowlist ?? false,
        mv_allowlist_urls: mvSupportRow?.mv_allowlist_urls ?? [],
      });
    }
  }

  for (const serviceType of SERVICE_TYPES) {
    queues[serviceType].sort((left, right) => {
      return (
        priorityTierRank(left.priority_tier) - priorityTierRank(right.priority_tier) ||
        cohortRank(left.release_cohort) - cohortRank(right.release_cohort) ||
        gapStatusRank(left.gap_status) - gapStatusRank(right.gap_status) ||
        String(right.release_date).localeCompare(String(left.release_date)) ||
        left.group.localeCompare(right.group) ||
        left.release_title.localeCompare(right.release_title)
      );
    });
  }

  const counts = Object.fromEntries(
    SERVICE_TYPES.map((serviceType) => {
      const rows = queues[serviceType];
      return [
        serviceType,
        {
          total: rows.length,
          by_gap_status: summarizeCounts(rows, 'gap_status'),
          by_release_cohort: summarizeCounts(rows, 'release_cohort'),
          by_priority_tier: summarizeCounts(rows, 'priority_tier'),
        },
      ];
    }),
  );

  return {
    generated_at: new Date().toISOString(),
    summary_lines: SERVICE_TYPES.map((serviceType) => {
      const serviceCounts = counts[serviceType];
      return `${serviceType}: total=${serviceCounts.total}, tiers=${JSON.stringify(serviceCounts.by_priority_tier)}, gaps=${JSON.stringify(serviceCounts.by_gap_status)}`;
    }),
    counts,
    queues,
  };
}

export function buildTitleTrackGapQueue(inputs, support, referenceDate = new Date()) {
  const rows = [];

  for (const row of inputs.releases) {
    if (Number(row.title_track_count) > 0) {
      continue;
    }

    const displayName = safeDisplayName(row);
    const sourceTier = support.socialByGroup.get(displayName)?.tier ?? 'unknown';
    const entityCohort = inferEntityCohort(row.release_date, row.has_active_upcoming > 0, referenceDate);
    const releaseCohort = inferReleaseCohort(row.release_date, referenceDate);
    const priorityTier = buildPriorityTier({
      releaseCohort,
      entityCohort,
      sourceTier,
      displayName,
      hasActiveUpcoming: row.has_active_upcoming > 0,
    });
    const queueKey = buildKey(displayName, row.release_title, row.release_date, row.stream);
    const supportRow = support.titleTrackByKey.get(queueKey) ?? null;
    const candidateTitles = supportRow?.candidate_titles ?? [];

    rows.push({
      queue_key: row.release_id,
      group: displayName,
      slug: row.slug,
      entity_type: row.entity_type,
      entity_tier: sourceTier,
      priority_tier: priorityTier,
      high_impact: priorityTier === 'tier_1',
      entity_cohort: entityCohort,
      release_cohort: releaseCohort,
      release_title: row.release_title,
      release_date: row.release_date,
      release_year: row.release_year,
      stream: row.stream,
      release_kind: row.release_kind,
      title_track_status: supportRow ? 'review_needed' : 'unresolved',
      track_titles: supportRow?.track_titles ?? [],
      candidate_titles: candidateTitles,
      candidate_sources: supportRow?.candidate_sources ?? [],
      candidate_title_count: candidateTitles.length,
      double_title_candidate: candidateTitles.length >= 2,
      review_reason: supportRow?.review_reason ?? 'No dependable title-track signal was attached to this release row.',
      recommended_action:
        supportRow?.recommended_action ??
        'track list / teaser / highlight medley 등 dependable source를 확인하고 title-track를 명시적으로 보강합니다.',
    });
  }

  rows.sort((left, right) => {
    return (
      priorityTierRank(left.priority_tier) - priorityTierRank(right.priority_tier) ||
      cohortRank(left.release_cohort) - cohortRank(right.release_cohort) ||
      Number(right.double_title_candidate) - Number(left.double_title_candidate) ||
      String(right.release_date).localeCompare(String(left.release_date)) ||
      left.group.localeCompare(right.group) ||
      left.release_title.localeCompare(right.release_title)
    );
  });

  return {
    generated_at: new Date().toISOString(),
    summary_lines: [
      `rows=${rows.length}`,
      `double_title_candidates=${rows.filter((row) => row.double_title_candidate).length}`,
      `priority_tiers=${JSON.stringify(summarizeCounts(rows, 'priority_tier'))}`,
      `release_cohorts=${JSON.stringify(summarizeCounts(rows, 'release_cohort'))}`,
    ],
    counts: {
      total: rows.length,
      by_priority_tier: summarizeCounts(rows, 'priority_tier'),
      by_release_cohort: summarizeCounts(rows, 'release_cohort'),
      by_release_kind: summarizeCounts(rows, 'release_kind'),
      by_entity_tier: summarizeCounts(rows, 'entity_tier'),
      by_release_year: summarizeCounts(rows, 'release_year'),
      double_title_candidates: rows.filter((row) => row.double_title_candidate).length,
    },
    rows,
  };
}

export function buildEntityIdentityWorkbench(inputs, support, referenceDate = new Date()) {
  const entities = [];
  const fieldQueue = [];

  for (const row of inputs.entities) {
    const displayName = safeDisplayName(row);
    const sourceTier = support.socialByGroup.get(displayName)?.tier ?? 'unknown';
    const entityCohort = inferEntityCohort(row.latest_release_date, row.has_active_upcoming > 0, referenceDate);
    const priorityTier = buildPriorityTier({
      entityCohort,
      sourceTier,
      displayName,
      hasActiveUpcoming: row.has_active_upcoming > 0,
    });

    const missingFields = [];
    const identityCriticalMissingFields = [];

    for (const definition of ENTITY_IDENTITY_FIELDS) {
      if (hasValue(definition.accessor(row))) {
        continue;
      }
      const candidateSourceHints = buildEntityFieldHints(row, support, definition.field_family_key);
      missingFields.push(definition.field_family_key);
      if (IDENTITY_CRITICAL_FIELDS.has(definition.field_family_key)) {
        identityCriticalMissingFields.push(definition.field_family_key);
      }

      fieldQueue.push({
        queue_key: `${row.entity_id}:${definition.field_family_key}`,
        group: displayName,
        slug: row.slug,
        entity_type: row.entity_type,
        entity_tier: sourceTier,
        priority_tier: priorityTier,
        high_impact: priorityTier === 'tier_1',
        entity_cohort: entityCohort,
        field_family_key: definition.field_family_key,
        field_label: definition.label,
        priority_rank: definition.priority_rank,
        identity_critical: IDENTITY_CRITICAL_FIELDS.has(definition.field_family_key),
        current_status: 'unresolved',
        candidate_source_hints: candidateSourceHints,
        recommended_action:
          candidateSourceHints.length > 0
            ? 'existing structured source 후보를 canonical entity data로 승격할지 검토합니다.'
            : 'dependable source를 찾기 전까지 unresolved 상태로 남기고 별도 acquisition tranche에서 다룹니다.',
      });
    }

    if (missingFields.length === 0) {
      continue;
    }

    entities.push({
      queue_key: row.entity_id,
      group: displayName,
      slug: row.slug,
      entity_type: row.entity_type,
      entity_tier: sourceTier,
      priority_tier: priorityTier,
      high_impact: priorityTier === 'tier_1',
      entity_cohort: entityCohort,
      latest_release_date: row.latest_release_date,
      has_active_upcoming: row.has_active_upcoming > 0,
      missing_fields: missingFields,
      identity_critical_missing_fields: identityCriticalMissingFields,
      candidate_sources_available: {
        representative_image: buildEntityFieldHints(row, support, 'entities.representative_image').length > 0,
        official_youtube: buildEntityFieldHints(row, support, 'entities.official_youtube').length > 0,
        official_x: buildEntityFieldHints(row, support, 'entities.official_x').length > 0,
        official_instagram: buildEntityFieldHints(row, support, 'entities.official_instagram').length > 0,
      },
      recommended_action:
        identityCriticalMissingFields.length > 0
          ? 'identity-critical field를 우선 보강하고, agency/debut year는 provenance가 약하면 unresolved로 유지합니다.'
          : 'non-critical identity metadata를 wave_2 backlog로 관리합니다.',
    });
  }

  entities.sort((left, right) => {
    return (
      priorityTierRank(left.priority_tier) - priorityTierRank(right.priority_tier) ||
      right.identity_critical_missing_fields.length - left.identity_critical_missing_fields.length ||
      left.group.localeCompare(right.group)
    );
  });
  fieldQueue.sort((left, right) => {
    return (
      priorityTierRank(left.priority_tier) - priorityTierRank(right.priority_tier) ||
      Number(right.identity_critical) - Number(left.identity_critical) ||
      left.priority_rank - right.priority_rank ||
      left.group.localeCompare(right.group)
    );
  });

  return {
    generated_at: new Date().toISOString(),
    summary_lines: [
      `entities=${entities.length}`,
      `field_rows=${fieldQueue.length}`,
      `identity_critical_rows=${fieldQueue.filter((row) => row.identity_critical).length}`,
      `priority_tiers=${JSON.stringify(summarizeCounts(fieldQueue, 'priority_tier'))}`,
    ],
    counts: {
      entities: entities.length,
      field_rows: fieldQueue.length,
      by_priority_tier: summarizeCounts(fieldQueue, 'priority_tier'),
      by_field_family: summarizeCounts(fieldQueue, 'field_family_key'),
      by_entity_tier: summarizeCounts(fieldQueue, 'entity_tier'),
      identity_critical_rows: fieldQueue.filter((row) => row.identity_critical).length,
    },
    entities,
    field_queue: fieldQueue,
  };
}

export async function collectWorkbenchArtifacts(rootDir, connectionString, referenceDate = new Date()) {
  const pool = await createCoveragePool(connectionString);
  try {
    const [inputs, support] = await Promise.all([
      fetchWorkbenchInputs(pool),
      loadWorkbenchSupport(rootDir),
    ]);

    return {
      serviceLinkQueues: buildServiceLinkGapQueues(inputs, support, referenceDate),
      titleTrackQueue: buildTitleTrackGapQueue(inputs, support, referenceDate),
      entityIdentityWorkbench: buildEntityIdentityWorkbench(inputs, support, referenceDate),
    };
  } finally {
    await pool.end();
  }
}
