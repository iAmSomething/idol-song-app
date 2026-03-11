#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectWorkbenchArtifacts } from './lib/canonicalGapWorkbenches.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');

const DEFAULT_SERVICE_LINK_JSON_PATH = path.join(BACKEND_DIR, 'reports', 'service_link_gap_queues.json');
const DEFAULT_TITLE_TRACK_JSON_PATH = path.join(BACKEND_DIR, 'reports', 'title_track_gap_queue.json');
const DEFAULT_ENTITY_IDENTITY_JSON_PATH = path.join(BACKEND_DIR, 'reports', 'entity_identity_workbench.json');

const DEFAULT_SERVICE_LINK_CSV_PATHS = {
  spotify: path.join(BACKEND_DIR, 'reports', 'service_link_gap_queue_spotify.csv'),
  youtube_music: path.join(BACKEND_DIR, 'reports', 'service_link_gap_queue_youtube_music.csv'),
  youtube_mv: path.join(BACKEND_DIR, 'reports', 'service_link_gap_queue_youtube_mv.csv'),
};

const DEFAULT_TITLE_TRACK_CSV_PATH = path.join(BACKEND_DIR, 'reports', 'title_track_gap_queue.csv');
const DEFAULT_ENTITY_IDENTITY_ENTITY_CSV_PATH = path.join(BACKEND_DIR, 'reports', 'entity_identity_workbench_entities.csv');
const DEFAULT_ENTITY_IDENTITY_FIELD_CSV_PATH = path.join(BACKEND_DIR, 'reports', 'entity_identity_field_queue.csv');

const SERVICE_LINK_COLUMNS = [
  'queue_key',
  'service_type',
  'group',
  'slug',
  'entity_type',
  'entity_tier',
  'priority_tier',
  'high_impact',
  'entity_cohort',
  'release_cohort',
  'release_title',
  'release_date',
  'release_year',
  'stream',
  'release_kind',
  'gap_status',
  'confidence_bucket',
  'current_status',
  'current_url',
  'provenance',
  'attempted_methods_count',
  'review_reason',
  'recommended_action',
  'suggested_search_query',
  'missing_mv_allowlist',
  'mv_allowlist_urls',
];

const TITLE_TRACK_COLUMNS = [
  'queue_key',
  'group',
  'slug',
  'entity_type',
  'entity_tier',
  'priority_tier',
  'high_impact',
  'entity_cohort',
  'release_cohort',
  'release_title',
  'release_date',
  'release_year',
  'stream',
  'release_kind',
  'title_track_status',
  'candidate_title_count',
  'double_title_candidate',
  'track_titles',
  'candidate_titles',
  'candidate_sources',
  'review_reason',
  'recommended_action',
];

const ENTITY_COLUMNS = [
  'queue_key',
  'group',
  'slug',
  'entity_type',
  'entity_tier',
  'priority_tier',
  'high_impact',
  'entity_cohort',
  'latest_release_date',
  'has_active_upcoming',
  'missing_fields',
  'identity_critical_missing_fields',
  'candidate_representative_image',
  'candidate_official_youtube',
  'candidate_official_x',
  'candidate_official_instagram',
  'recommended_action',
];

const ENTITY_FIELD_COLUMNS = [
  'queue_key',
  'group',
  'slug',
  'entity_type',
  'entity_tier',
  'priority_tier',
  'high_impact',
  'entity_cohort',
  'field_family_key',
  'field_label',
  'priority_rank',
  'identity_critical',
  'current_status',
  'candidate_source_hints',
  'recommended_action',
];

function parseArgs(argv) {
  const options = {
    serviceLinkJsonPath: DEFAULT_SERVICE_LINK_JSON_PATH,
    titleTrackJsonPath: DEFAULT_TITLE_TRACK_JSON_PATH,
    entityIdentityJsonPath: DEFAULT_ENTITY_IDENTITY_JSON_PATH,
    serviceLinkCsvPaths: { ...DEFAULT_SERVICE_LINK_CSV_PATHS },
    titleTrackCsvPath: DEFAULT_TITLE_TRACK_CSV_PATH,
    entityIdentityEntityCsvPath: DEFAULT_ENTITY_IDENTITY_ENTITY_CSV_PATH,
    entityIdentityFieldCsvPath: DEFAULT_ENTITY_IDENTITY_FIELD_CSV_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--service-link-json-path') {
      options.serviceLinkJsonPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--title-track-json-path') {
      options.titleTrackJsonPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--entity-identity-json-path') {
      options.entityIdentityJsonPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--service-link-spotify-csv-path') {
      options.serviceLinkCsvPaths.spotify = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--service-link-youtube-music-csv-path') {
      options.serviceLinkCsvPaths.youtube_music = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--service-link-youtube-mv-csv-path') {
      options.serviceLinkCsvPaths.youtube_mv = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--title-track-csv-path') {
      options.titleTrackCsvPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--entity-identity-entity-csv-path') {
      options.entityIdentityEntityCsvPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--entity-identity-field-csv-path') {
      options.entityIdentityFieldCsvPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

function serializeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(' | ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvValue(value) {
  const stringValue = serializeCsvValue(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function rowsToCsv(rows, columns, mapper = (row) => row) {
  const header = columns.join(',');
  const lines = rows.map((row) => {
    const mappedRow = mapper(row);
    return columns.map((column) => escapeCsvValue(mappedRow[column])).join(',');
  });
  return `${header}\n${lines.join('\n')}\n`;
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeCsv(filePath, rows, columns, mapper) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, rowsToCsv(rows, columns, mapper), 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifacts = await collectWorkbenchArtifacts(ROOT_DIR, process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED);

  await Promise.all([
    writeJson(options.serviceLinkJsonPath, artifacts.serviceLinkQueues),
    writeJson(options.titleTrackJsonPath, artifacts.titleTrackQueue),
    writeJson(options.entityIdentityJsonPath, artifacts.entityIdentityWorkbench),
    ...Object.entries(options.serviceLinkCsvPaths).map(([serviceType, filePath]) =>
      writeCsv(filePath, artifacts.serviceLinkQueues.queues[serviceType] ?? [], SERVICE_LINK_COLUMNS),
    ),
    writeCsv(options.titleTrackCsvPath, artifacts.titleTrackQueue.rows, TITLE_TRACK_COLUMNS),
    writeCsv(options.entityIdentityEntityCsvPath, artifacts.entityIdentityWorkbench.entities, ENTITY_COLUMNS, (row) => ({
      ...row,
      candidate_representative_image: row.candidate_sources_available?.representative_image ?? false,
      candidate_official_youtube: row.candidate_sources_available?.official_youtube ?? false,
      candidate_official_x: row.candidate_sources_available?.official_x ?? false,
      candidate_official_instagram: row.candidate_sources_available?.official_instagram ?? false,
    })),
    writeCsv(options.entityIdentityFieldCsvPath, artifacts.entityIdentityWorkbench.field_queue, ENTITY_FIELD_COLUMNS),
  ]);

  const summary = {
    generated_at: new Date().toISOString(),
    service_link_gap_queues: {
      path: path.relative(BACKEND_DIR, options.serviceLinkJsonPath),
      total: Object.values(artifacts.serviceLinkQueues.counts).reduce((accumulator, serviceCount) => accumulator + serviceCount.total, 0),
      by_service_type: Object.fromEntries(
        Object.entries(artifacts.serviceLinkQueues.counts).map(([serviceType, counts]) => [serviceType, counts.total]),
      ),
    },
    title_track_gap_queue: {
      path: path.relative(BACKEND_DIR, options.titleTrackJsonPath),
      total: artifacts.titleTrackQueue.counts.total,
      double_title_candidates: artifacts.titleTrackQueue.counts.double_title_candidates,
    },
    entity_identity_workbench: {
      path: path.relative(BACKEND_DIR, options.entityIdentityJsonPath),
      entities: artifacts.entityIdentityWorkbench.counts.entities,
      field_rows: artifacts.entityIdentityWorkbench.counts.field_rows,
      identity_critical_rows: artifacts.entityIdentityWorkbench.counts.identity_critical_rows,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

await main();
