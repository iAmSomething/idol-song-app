import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const PROJECTIONS = [
  'entity_search_documents',
  'calendar_month_projection',
  'entity_detail_projection',
  'release_detail_projection',
  'radar_projection',
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    summaryPath: resolve(process.cwd(), './reports/projection_refresh_summary.json'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--summary-path') {
      options.summaryPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

async function fetchSingleJsonValue(client, query, params = [], column = 'payload') {
  const result = await client.query(query, params);
  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0][column];
}

async function fetchFirstAvailableJsonValue(client, queries, column = 'payload') {
  for (const query of queries) {
    const value = await fetchSingleJsonValue(client, query, [], column);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

async function fetchFirstAvailableRow(client, queries) {
  for (const query of queries) {
    const result = await client.query(query);
    if (result.rowCount > 0) {
      return result.rows[0];
    }
  }
  return null;
}

async function buildSummary(client) {
  const rowCounts = {};
  for (const projection of PROJECTIONS) {
    const result = await client.query(`select count(*)::int as count from ${projection}`);
    rowCounts[projection] = result.rows[0].count;
  }

  const searchSample = await fetchFirstAvailableJsonValue(
    client,
    [
      `
        select payload
        from entity_search_documents
        where entity_slug = 'yena'
        limit 1
      `,
      `
        select payload
        from entity_search_documents
        order by entity_slug
        limit 1
      `,
    ]
  );

  const calendarRow = await fetchFirstAvailableRow(
    client,
    [
      `
        select month_key, payload
        from calendar_month_projection
        where month_key = '2026-03'
        limit 1
      `,
      `
        select month_key, payload
        from calendar_month_projection
        order by month_start desc
        limit 1
      `,
    ]
  );
  const calendarSample = calendarRow
    ? {
        month_key: calendarRow.month_key,
        summary: calendarRow.payload.summary,
        nearest_upcoming: calendarRow.payload.nearest_upcoming,
      }
    : null;

  const entityDetailSample = await fetchFirstAvailableJsonValue(
    client,
    [
      `
        select payload
        from entity_detail_projection
        where entity_slug = 'yena'
        limit 1
      `,
      `
        select payload
        from entity_detail_projection
        order by entity_slug
        limit 1
      `,
    ]
  );

  const releaseDetailRow = await fetchFirstAvailableRow(
    client,
    [
      `
        select payload
        from release_detail_projection
        where entity_slug = 'blackpink'
          and normalized_release_title = projection_normalize_text('DEADLINE')
        limit 1
      `,
      `
        select payload
        from release_detail_projection
        order by release_date desc, entity_slug asc
        limit 1
      `,
    ]
  );
  const releaseDetailPayload = releaseDetailRow ? releaseDetailRow.payload : null;
  const releaseDetailSample = releaseDetailPayload
    ? {
        release: releaseDetailPayload.release,
        mv: releaseDetailPayload.mv,
        title_track_count: Array.isArray(releaseDetailPayload.tracks)
          ? releaseDetailPayload.tracks.filter((track) => track.is_title_track).length
          : 0,
      }
    : null;

  const radarPayload = await fetchSingleJsonValue(
    client,
    `select payload from radar_projection where projection_key = 'default'`
  );
  const radarSample = radarPayload
    ? {
        featured_upcoming: radarPayload.featured_upcoming,
        weekly_upcoming_count: Array.isArray(radarPayload.weekly_upcoming) ? radarPayload.weekly_upcoming.length : 0,
        change_feed_count: Array.isArray(radarPayload.change_feed) ? radarPayload.change_feed.length : 0,
        long_gap_count: Array.isArray(radarPayload.long_gap) ? radarPayload.long_gap.length : 0,
        rookie_count: Array.isArray(radarPayload.rookie) ? radarPayload.rookie.length : 0,
      }
    : null;

  return {
    generated_at: new Date().toISOString(),
    row_counts: rowCounts,
    samples: {
      search: searchSample,
      calendar: calendarSample,
      entity_detail: entityDetailSample,
      release_detail: releaseDetailSample,
      radar: radarSample,
    },
  };
}

async function main() {
  const { summaryPath } = parseArgs(process.argv.slice(2));
  const connectionString = requiredEnv('DATABASE_URL');
  const client = new Client({
    connectionString,
    application_name: 'idol-song-app-backend-projection-refresh',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    for (const projection of PROJECTIONS) {
      await client.query(`refresh materialized view ${projection}`);
    }

    const summary = await buildSummary(client);
    await mkdir(dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(
      JSON.stringify(
        {
          summary_path: summaryPath,
          row_counts: summary.row_counts,
          radar: summary.samples.radar,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
