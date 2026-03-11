import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MANUAL_CURATION_BUNDLE_VERSION = 1;

export const SERVICE_LINK_DECISIONS = ['set_manual_override', 'mark_no_link', 'mark_review_needed', 'skip'];
export const TITLE_TRACK_DECISIONS = ['set_manual_override', 'mark_review_needed', 'mark_unresolved', 'skip'];
export const ENTITY_IDENTITY_DECISIONS = ['set_value', 'keep_unresolved', 'skip'];

const IDENTITY_FIELD_MAP = {
  'entities.representative_image': {
    profileKey: 'representative_image_url',
    sourceKey: 'representative_image_source',
    valueType: 'url',
  },
  'entities.official_youtube': {
    profileKey: 'official_youtube_url',
    sourceKey: 'official_youtube_source',
    valueType: 'url',
  },
  'entities.official_x': {
    profileKey: 'official_x_url',
    sourceKey: 'official_x_source',
    valueType: 'url',
  },
  'entities.official_instagram': {
    profileKey: 'official_instagram_url',
    sourceKey: 'official_instagram_source',
    valueType: 'url',
  },
  'entities.agency_name': {
    profileKey: 'agency',
    sourceKey: 'agency_source',
    valueType: 'text',
  },
  'entities.debut_year': {
    profileKey: 'debut_year',
    sourceKey: 'debut_year_source',
    valueType: 'integer',
  },
};

const SERVICE_FIELD_MAP = {
  spotify: {
    urlKey: 'spotify_url',
    statusKey: 'spotify_status',
    provenanceKey: 'spotify_provenance',
    reviewReasonKey: 'spotify_review_reason',
    noLinkStatus: 'no_link',
  },
  youtube_music: {
    urlKey: 'youtube_music_url',
    statusKey: 'youtube_music_status',
    provenanceKey: 'youtube_music_provenance',
    reviewReasonKey: 'youtube_music_review_reason',
    noLinkStatus: 'no_link',
  },
  youtube_mv: {
    urlKey: 'youtube_video_url',
    idKey: 'youtube_video_id',
    statusKey: 'youtube_video_status',
    provenanceKey: 'youtube_video_provenance',
    reviewReasonKey: 'youtube_video_review_reason',
    noLinkStatus: 'no_mv',
  },
};

function toIsoString(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
  const normalized = cleanString(value);
  return normalized.length > 0 ? normalized : null;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeOptionalUrl(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized === null) {
    return null;
  }
  return isValidHttpUrl(normalized) ? normalized : null;
}

function normalizeTitleArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const results = [];
  for (const item of value) {
    const normalized = normalizeOptionalText(item);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      results.push(normalized);
    }
  }
  return results;
}

function buildPendingCuration({ value = null, values = null } = {}) {
  return {
    decision: null,
    value,
    values,
    provenance: null,
    reviewer: null,
    reviewed_at: null,
    notes: null,
  };
}

function buildBundleEnvelope({ fieldFamily, generatedAt, sourceArtifact, summaryCounts, allowedDecisions, rows }) {
  return {
    bundle_version: MANUAL_CURATION_BUNDLE_VERSION,
    bundle_kind: 'manual_curation_bundle',
    field_family: fieldFamily,
    generated_at: toIsoString(generatedAt),
    source_artifact: sourceArtifact,
    allowed_decisions: allowedDecisions,
    summary: summaryCounts,
    rows,
  };
}

function buildTraceEntry({ bundle, bundleRow, fieldFamilyKey, decision, value, values, provenance, reviewer, reviewedAt, notes }) {
  return {
    bundle_field_family: bundle.field_family,
    bundle_version: bundle.bundle_version,
    bundle_generated_at: bundle.generated_at,
    bundle_row_key: bundleRow.bundle_row_key,
    field_family_key: fieldFamilyKey,
    decision,
    value: value ?? null,
    values: values ?? null,
    provenance: provenance ?? null,
    reviewer,
    reviewed_at: reviewedAt,
    notes: notes ?? null,
    imported_at: new Date().toISOString(),
  };
}

function ensureTraceArray(target) {
  if (!Array.isArray(target.manual_curation_traces)) {
    target.manual_curation_traces = [];
  }
  return target.manual_curation_traces;
}

function findOrCreateReleaseOverride(overrides, target) {
  const existing = overrides.find(
    (row) =>
      row.group === target.group &&
      row.release_title === target.release_title &&
      row.release_date === target.release_date &&
      row.stream === target.stream,
  );
  if (existing) {
    return { row: existing, created: false };
  }
  const createdRow = {
    group: target.group,
    release_title: target.release_title,
    release_date: target.release_date,
    stream: target.stream,
  };
  overrides.push(createdRow);
  return { row: createdRow, created: true };
}

function findEntityProfile(profiles, slug) {
  return profiles.find((row) => row.slug === slug) ?? null;
}

function extractYoutubeVideoId(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized === null) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === 'youtu.be') {
      return normalizeOptionalText(parsed.pathname.split('/').filter(Boolean)[0]);
    }
    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return normalizeOptionalText(parsed.searchParams.get('v'));
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return normalizeOptionalText(parsed.pathname.split('/').filter(Boolean)[1]);
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return normalizeOptionalText(parsed.pathname.split('/').filter(Boolean)[1]);
      }
    }
  } catch {
    return null;
  }
  return null;
}

function buildServiceLinkBundle(serviceLinkGapQueues, generatedAt = new Date()) {
  const rows = [];
  for (const [serviceType, queueRows] of Object.entries(serviceLinkGapQueues.queues ?? {})) {
    for (const row of queueRows) {
      rows.push({
        bundle_row_key: row.queue_key,
        field_family_key: `release_service_links.${serviceType}`,
        target: {
          group: row.group,
          slug: row.slug,
          release_title: row.release_title,
          release_date: row.release_date,
          stream: row.stream,
          service_type: serviceType,
        },
        context: {
          entity_type: row.entity_type,
          entity_tier: row.entity_tier,
          priority_tier: row.priority_tier,
          release_kind: row.release_kind,
          release_cohort: row.release_cohort,
          review_reason: row.review_reason,
          recommended_action: row.recommended_action,
          suggested_search_query: row.suggested_search_query,
          mv_allowlist_urls: row.mv_allowlist_urls ?? [],
        },
        current_state: {
          status: row.current_status,
          url: normalizeOptionalUrl(row.current_url),
          provenance: normalizeOptionalText(row.provenance),
        },
        curation: buildPendingCuration(),
      });
    }
  }
  return buildBundleEnvelope({
    fieldFamily: 'service_link',
    generatedAt,
    sourceArtifact: 'backend/reports/service_link_gap_queues.json',
    summaryCounts: serviceLinkGapQueues.counts ?? {},
    allowedDecisions: SERVICE_LINK_DECISIONS,
    rows,
  });
}

function buildTitleTrackBundle(titleTrackGapQueue, generatedAt = new Date()) {
  const rows = (titleTrackGapQueue.rows ?? []).map((row) => ({
    bundle_row_key: row.queue_key,
    field_family_key: 'release_detail.title_tracks',
    target: {
      group: row.group,
      slug: row.slug,
      release_title: row.release_title,
      release_date: row.release_date,
      stream: row.stream,
    },
    context: {
      entity_type: row.entity_type,
      entity_tier: row.entity_tier,
      priority_tier: row.priority_tier,
      release_kind: row.release_kind,
      release_cohort: row.release_cohort,
      track_titles: row.track_titles ?? [],
      candidate_titles: row.candidate_titles ?? [],
      candidate_sources: row.candidate_sources ?? [],
      review_reason: row.review_reason,
      recommended_action: row.recommended_action,
      double_title_candidate: row.double_title_candidate ?? false,
    },
    current_state: {
      status: row.title_track_status,
      values: [],
      provenance: null,
    },
    curation: buildPendingCuration({ values: [] }),
  }));

  return buildBundleEnvelope({
    fieldFamily: 'title_track',
    generatedAt,
    sourceArtifact: 'backend/reports/title_track_gap_queue.json',
    summaryCounts: titleTrackGapQueue.counts ?? {},
    allowedDecisions: TITLE_TRACK_DECISIONS,
    rows,
  });
}

function buildEntityIdentityBundle(entityIdentityWorkbench, generatedAt = new Date()) {
  const entityBySlug = new Map((entityIdentityWorkbench.entities ?? []).map((row) => [row.slug, row]));
  const rows = (entityIdentityWorkbench.field_queue ?? []).map((row) => {
    const entityRow = entityBySlug.get(row.slug) ?? null;
    return {
      bundle_row_key: row.queue_key,
      field_family_key: row.field_family_key,
      target: {
        group: row.group,
        slug: row.slug,
        field_family_key: row.field_family_key,
      },
      context: {
        entity_type: row.entity_type,
        entity_tier: row.entity_tier,
        priority_tier: row.priority_tier,
        field_label: row.field_label,
        latest_release_date: entityRow?.latest_release_date ?? null,
        has_active_upcoming: entityRow?.has_active_upcoming ?? false,
        identity_critical: row.identity_critical ?? false,
        candidate_source_hints: row.candidate_source_hints ?? [],
        entity_missing_fields: entityRow?.missing_fields ?? [],
        recommended_action: row.recommended_action,
      },
      current_state: {
        status: row.current_status,
        value: null,
        provenance: null,
      },
      curation: buildPendingCuration(),
    };
  });

  return buildBundleEnvelope({
    fieldFamily: 'entity_identity',
    generatedAt,
    sourceArtifact: 'backend/reports/entity_identity_workbench.json',
    summaryCounts: entityIdentityWorkbench.counts ?? {},
    allowedDecisions: ENTITY_IDENTITY_DECISIONS,
    rows,
  });
}

export function buildManualCurationBundles({
  serviceLinkGapQueues,
  titleTrackGapQueue,
  entityIdentityWorkbench,
  generatedAt = new Date(),
}) {
  return {
    serviceLink: buildServiceLinkBundle(serviceLinkGapQueues, generatedAt),
    titleTrack: buildTitleTrackBundle(titleTrackGapQueue, generatedAt),
    entityIdentity: buildEntityIdentityBundle(entityIdentityWorkbench, generatedAt),
  };
}

function assertBundleShape(bundle, expectedFamily) {
  if (!bundle || bundle.bundle_kind !== 'manual_curation_bundle') {
    throw new Error('Manual curation bundle payload is missing bundle_kind=manual_curation_bundle.');
  }
  if (bundle.bundle_version !== MANUAL_CURATION_BUNDLE_VERSION) {
    throw new Error(
      `Unsupported manual curation bundle version: ${String(bundle.bundle_version)} (expected ${String(
        MANUAL_CURATION_BUNDLE_VERSION,
      )}).`,
    );
  }
  if (bundle.field_family !== expectedFamily) {
    throw new Error(`Expected ${expectedFamily} bundle, received ${String(bundle.field_family)}.`);
  }
}

function normalizeReviewedAt(value) {
  const normalized = normalizeOptionalText(value);
  if (normalized === null) {
    return new Date().toISOString();
  }
  return toIsoString(normalized);
}

function applyServiceLinkDecision(overrides, bundle, row, summary) {
  const curation = row.curation ?? {};
  const decision = normalizeOptionalText(curation.decision);
  if (decision === null || decision === 'skip') {
    summary.service_link.skipped += 1;
    return;
  }
  const reviewer = normalizeOptionalText(curation.reviewer);
  if (reviewer === null) {
    throw new Error(`service_link row ${row.bundle_row_key} is missing curation.reviewer.`);
  }

  const reviewedAt = normalizeReviewedAt(curation.reviewed_at);
  const serviceType = row.target?.service_type;
  const config = SERVICE_FIELD_MAP[serviceType];
  if (!config) {
    throw new Error(`Unsupported service type for row ${row.bundle_row_key}: ${String(serviceType)}`);
  }

  const { row: overrideRow, created } = findOrCreateReleaseOverride(overrides, row.target);
  if (created) {
    summary.release_detail_overrides.created_rows += 1;
  }
  const traces = ensureTraceArray(overrideRow);
  const provenance = normalizeOptionalText(curation.provenance);
  const notes = normalizeOptionalText(curation.notes);

  if (decision === 'set_manual_override') {
    const resolvedUrl = normalizeOptionalUrl(curation.value);
    if (resolvedUrl === null) {
      throw new Error(`service_link row ${row.bundle_row_key} requires a valid https url in curation.value.`);
    }
    overrideRow[config.urlKey] = resolvedUrl;
    overrideRow[config.statusKey] = 'manual_override';
    overrideRow[config.provenanceKey] = provenance;
    delete overrideRow[config.reviewReasonKey];
    if (config.idKey) {
      const resolvedVideoId = extractYoutubeVideoId(resolvedUrl);
      if (resolvedVideoId) {
        overrideRow[config.idKey] = resolvedVideoId;
      } else {
        delete overrideRow[config.idKey];
      }
    }
    summary.service_link.set_manual_override += 1;
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        value: resolvedUrl,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  if (decision === 'mark_no_link') {
    delete overrideRow[config.urlKey];
    if (config.idKey) {
      delete overrideRow[config.idKey];
    }
    overrideRow[config.statusKey] = config.noLinkStatus;
    overrideRow[config.provenanceKey] = provenance;
    delete overrideRow[config.reviewReasonKey];
    summary.service_link.mark_no_link += 1;
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  if (decision === 'mark_review_needed') {
    if (serviceType !== 'youtube_mv') {
      throw new Error(`service_link row ${row.bundle_row_key} only supports mark_review_needed for youtube_mv.`);
    }
    delete overrideRow[config.urlKey];
    if (config.idKey) {
      delete overrideRow[config.idKey];
    }
    overrideRow[config.statusKey] = 'needs_review';
    overrideRow[config.provenanceKey] = provenance;
    overrideRow[config.reviewReasonKey] = notes ?? row.context?.review_reason ?? null;
    summary.service_link.mark_review_needed += 1;
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  throw new Error(`Unsupported service_link decision for row ${row.bundle_row_key}: ${decision}`);
}

function applyTitleTrackDecision(overrides, bundle, row, summary) {
  const curation = row.curation ?? {};
  const decision = normalizeOptionalText(curation.decision);
  if (decision === null || decision === 'skip') {
    summary.title_track.skipped += 1;
    return;
  }
  const reviewer = normalizeOptionalText(curation.reviewer);
  if (reviewer === null) {
    throw new Error(`title_track row ${row.bundle_row_key} is missing curation.reviewer.`);
  }

  const reviewedAt = normalizeReviewedAt(curation.reviewed_at);
  const provenance = normalizeOptionalText(curation.provenance);
  const notes = normalizeOptionalText(curation.notes);
  const { row: overrideRow, created } = findOrCreateReleaseOverride(overrides, row.target);
  if (created) {
    summary.release_detail_overrides.created_rows += 1;
  }
  const traces = ensureTraceArray(overrideRow);

  if (decision === 'set_manual_override') {
    const titles = normalizeTitleArray(curation.values);
    if (titles.length === 0) {
      throw new Error(`title_track row ${row.bundle_row_key} requires curation.values with at least one title.`);
    }
    overrideRow.title_tracks = titles;
    overrideRow.title_track_status = 'manual_override';
    overrideRow.title_track_provenance = provenance;
    delete overrideRow.title_track_review_reason;
    summary.title_track.set_manual_override += 1;
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        values: titles,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  if (decision === 'mark_review_needed' || decision === 'mark_unresolved') {
    delete overrideRow.title_tracks;
    overrideRow.title_track_status = decision === 'mark_review_needed' ? 'review' : 'unresolved';
    overrideRow.title_track_provenance = provenance;
    overrideRow.title_track_review_reason = notes ?? row.context?.review_reason ?? null;
    if (decision === 'mark_review_needed') {
      summary.title_track.mark_review_needed += 1;
    } else {
      summary.title_track.mark_unresolved += 1;
    }
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  throw new Error(`Unsupported title_track decision for row ${row.bundle_row_key}: ${decision}`);
}

function coerceIdentityValue(fieldConfig, value, rowKey) {
  if (fieldConfig.valueType === 'url') {
    const normalized = normalizeOptionalUrl(value);
    if (normalized === null) {
      throw new Error(`entity_identity row ${rowKey} requires a valid https url in curation.value.`);
    }
    return normalized;
  }
  if (fieldConfig.valueType === 'integer') {
    const numericValue = Number(value);
    if (!Number.isInteger(numericValue) || numericValue < 1800 || numericValue > 2100) {
      throw new Error(`entity_identity row ${rowKey} requires an integer debut year in curation.value.`);
    }
    return numericValue;
  }
  const normalized = normalizeOptionalText(value);
  if (normalized === null) {
    throw new Error(`entity_identity row ${rowKey} requires a non-empty curation.value.`);
  }
  return normalized;
}

function applyEntityIdentityDecision(artistProfiles, bundle, row, summary) {
  const curation = row.curation ?? {};
  const decision = normalizeOptionalText(curation.decision);
  if (decision === null || decision === 'skip') {
    summary.entity_identity.skipped += 1;
    return;
  }

  const reviewer = normalizeOptionalText(curation.reviewer);
  if (reviewer === null) {
    throw new Error(`entity_identity row ${row.bundle_row_key} is missing curation.reviewer.`);
  }
  const reviewedAt = normalizeReviewedAt(curation.reviewed_at);
  const provenance = normalizeOptionalText(curation.provenance);
  const notes = normalizeOptionalText(curation.notes);

  const profile = findEntityProfile(artistProfiles, row.target?.slug);
  if (profile === null) {
    throw new Error(`entity_identity row ${row.bundle_row_key} references unknown slug ${String(row.target?.slug)}.`);
  }
  const fieldConfig = IDENTITY_FIELD_MAP[row.field_family_key];
  if (!fieldConfig) {
    throw new Error(`Unsupported entity identity field: ${String(row.field_family_key)}`);
  }
  const traces = ensureTraceArray(profile);

  if (decision === 'set_value') {
    const coercedValue = coerceIdentityValue(fieldConfig, curation.value, row.bundle_row_key);
    profile[fieldConfig.profileKey] = coercedValue;
    if (fieldConfig.sourceKey) {
      profile[fieldConfig.sourceKey] = provenance;
    }
    summary.entity_identity.set_value += 1;
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        value: coercedValue,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  if (decision === 'keep_unresolved') {
    summary.entity_identity.keep_unresolved += 1;
    traces.push(
      buildTraceEntry({
        bundle,
        bundleRow: row,
        fieldFamilyKey: row.field_family_key,
        decision,
        provenance,
        reviewer,
        reviewedAt,
        notes,
      }),
    );
    return;
  }

  throw new Error(`Unsupported entity_identity decision for row ${row.bundle_row_key}: ${decision}`);
}

export function applyManualCurationImports({
  serviceLinkBundle = null,
  titleTrackBundle = null,
  entityIdentityBundle = null,
  releaseDetailOverrides,
  artistProfiles,
}) {
  const summary = {
    generated_at: new Date().toISOString(),
    release_detail_overrides: {
      created_rows: 0,
    },
    service_link: {
      set_manual_override: 0,
      mark_no_link: 0,
      mark_review_needed: 0,
      skipped: 0,
    },
    title_track: {
      set_manual_override: 0,
      mark_review_needed: 0,
      mark_unresolved: 0,
      skipped: 0,
    },
    entity_identity: {
      set_value: 0,
      keep_unresolved: 0,
      skipped: 0,
    },
  };

  if (serviceLinkBundle) {
    assertBundleShape(serviceLinkBundle, 'service_link');
    for (const row of serviceLinkBundle.rows ?? []) {
      applyServiceLinkDecision(releaseDetailOverrides, serviceLinkBundle, row, summary);
    }
  }

  if (titleTrackBundle) {
    assertBundleShape(titleTrackBundle, 'title_track');
    for (const row of titleTrackBundle.rows ?? []) {
      applyTitleTrackDecision(releaseDetailOverrides, titleTrackBundle, row, summary);
    }
  }

  if (entityIdentityBundle) {
    assertBundleShape(entityIdentityBundle, 'entity_identity');
    for (const row of entityIdentityBundle.rows ?? []) {
      applyEntityIdentityDecision(artistProfiles, entityIdentityBundle, row, summary);
    }
  }

  return {
    releaseDetailOverrides,
    artistProfiles,
    summary,
  };
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
