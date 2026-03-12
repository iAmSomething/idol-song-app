#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import {
  SAME_DAY_FIXTURES,
  buildSameDayReleaseAcceptanceReport,
  renderSameDayReleaseAcceptanceMarkdown,
} from './lib/sameDayReleaseAcceptance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'same_day_release_acceptance_report.json');
const DEFAULT_MARKDOWN_PATH = path.join(BACKEND_DIR, 'reports', 'same_day_release_acceptance_report.md');
const DEFAULT_RELEASES_PATH = path.join(REPO_ROOT, 'group_latest_release_since_2025-06-01_mb.json');
const DEFAULT_DETAILS_PATH = path.join(REPO_ROOT, 'release_detail_catalog.json');
const DEFAULT_ARTWORK_PATH = path.join(REPO_ROOT, 'release_artwork_catalog.json');
const DEFAULT_UPCOMING_PATH = path.join(REPO_ROOT, 'upcoming_release_candidates.json');

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
    markdownPath: DEFAULT_MARKDOWN_PATH,
    releasesPath: DEFAULT_RELEASES_PATH,
    detailsPath: DEFAULT_DETAILS_PATH,
    artworkPath: DEFAULT_ARTWORK_PATH,
    upcomingPath: DEFAULT_UPCOMING_PATH,
    referenceDate: new Date().toISOString().slice(0, 10),
    databaseUrlEnv: 'DATABASE_URL',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--report-path') {
      options.reportPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--markdown-path') {
      options.markdownPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--releases-path') {
      options.releasesPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--details-path') {
      options.detailsPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--artwork-path') {
      options.artworkPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--upcoming-path') {
      options.upcomingPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--reference-date') {
      options.referenceDate = String(argv[index + 1] ?? '').trim();
      index += 1;
      continue;
    }
    if (value === '--database-url-env') {
      options.databaseUrlEnv = String(argv[index + 1] ?? '').trim();
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function buildReleaseRollups(releaseRows) {
  const rowsByGroup = new Map();
  for (const row of releaseRows) {
    const group = row.group;
    const streamKey = row.stream === 'song' ? 'latest_song' : 'latest_album';
    const existing = rowsByGroup.get(group) ?? { group, latest_song: null, latest_album: null };
    const current = existing[streamKey];
    if (
      current === null ||
      String(row.release_date).localeCompare(String(current.date)) > 0 ||
      (
        String(row.release_date) === String(current.date) &&
        String(row.release_title).localeCompare(String(current.title)) < 0
      )
    ) {
      existing[streamKey] = {
        title: row.release_title,
        date: row.release_date,
        release_kind: row.release_kind,
        release_format: row.release_format,
        source: row.source_url,
      };
    }
    rowsByGroup.set(group, existing);
  }
  return Array.from(rowsByGroup.values());
}

function buildDetailRows(detailRows) {
  return detailRows.map((row) => ({
    group: row.group,
    release_title: row.release_title,
    release_date: row.release_date,
    stream: row.stream,
    title_track_status: row.title_track_status,
    youtube_video_status: row.youtube_video_status,
    youtube_video_url: row.youtube_video_url,
    tracks: Array.isArray(row.tracks) ? row.tracks : [],
  }));
}

function buildArtworkRows(detailRows) {
  return detailRows.map((row) => ({
    group: row.group,
    release_title: row.release_title,
    release_date: row.release_date,
    stream: row.stream,
    cover_image_url: row.cover_image_url,
  }));
}

async function loadDatabaseInputs(databaseUrl, fixtureGroups) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const releaseResult = await client.query(
      `
        select
          e.display_name as group,
          r.release_title,
          r.release_date::text as release_date,
          r.stream,
          r.release_kind,
          r.release_format,
          r.source_url
        from releases r
        join entities e on e.id = r.entity_id
        where e.display_name = any($1::text[])
        order by e.display_name asc, r.release_date desc, r.release_title asc
      `,
      [fixtureGroups],
    );

    const detailResult = await client.query(
      `
        select
          e.display_name as group,
          r.release_title,
          r.release_date::text as release_date,
          r.stream,
          coalesce(rdp.payload #>> '{title_track_metadata,status}', '') as title_track_status,
          coalesce(rdp.payload #>> '{mv,status}', '') as youtube_video_status,
          nullif(rdp.payload #>> '{mv,url}', '') as youtube_video_url,
          coalesce(rdp.payload #> '{tracks}', '[]'::jsonb) as tracks,
          nullif(rdp.payload #>> '{artwork,cover_image_url}', '') as cover_image_url
        from release_detail_projection rdp
        join releases r on r.id = rdp.release_id
        join entities e on e.id = r.entity_id
        where e.display_name = any($1::text[])
      `,
      [fixtureGroups],
    );

    const upcomingResult = await client.query(
      `
        select
          e.display_name as group,
          us.headline,
          us.scheduled_date::text as scheduled_date,
          case
            when us.scheduled_month is null then null
            else to_char(us.scheduled_month, 'YYYY-MM')
          end as scheduled_month,
          us.date_precision,
          us.date_status
        from upcoming_signals us
        join entities e on e.id = us.entity_id
        where us.is_active = true
          and e.display_name = any($1::text[])
      `,
      [fixtureGroups],
    );

    return {
      dataSource: 'database',
      releases: buildReleaseRollups(releaseResult.rows),
      details: buildDetailRows(detailResult.rows),
      artwork: buildArtworkRows(detailResult.rows),
      upcomingSignals: upcomingResult.rows,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixtureGroups = Array.from(new Set(SAME_DAY_FIXTURES.map((fixture) => fixture.group)));
  const databaseUrl = process.env[options.databaseUrlEnv];
  const inputs = databaseUrl
    ? await loadDatabaseInputs(databaseUrl, fixtureGroups)
    : {
        dataSource: 'json',
        releases: await loadJson(options.releasesPath),
        details: await loadJson(options.detailsPath),
        artwork: await loadJson(options.artworkPath),
        upcomingSignals: await loadJson(options.upcomingPath),
      };

  const report = buildSameDayReleaseAcceptanceReport(
    {
      releases: inputs.releases,
      details: inputs.details,
      artwork: inputs.artwork,
      upcomingSignals: inputs.upcomingSignals,
    },
    options.referenceDate,
  );
  report.data_source = inputs.dataSource;
  const markdown = renderSameDayReleaseAcceptanceMarkdown(report);

  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await mkdir(path.dirname(options.markdownPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(options.markdownPath, markdown, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
