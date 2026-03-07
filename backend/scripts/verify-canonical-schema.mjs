import pg from 'pg';

const { Client } = pg;

const REQUIRED_TABLES = [
  'entities',
  'entity_aliases',
  'entity_official_links',
  'youtube_channels',
  'entity_youtube_channels',
  'releases',
  'release_artwork',
  'tracks',
  'release_service_links',
  'track_service_links',
  'upcoming_signals',
  'upcoming_signal_sources',
  'entity_tracking_state',
  'review_tasks',
  'release_link_overrides',
];

const REQUIRED_CONSTRAINTS = [
  ['entities', 'entities_slug_key'],
  ['entity_aliases', 'entity_aliases_entity_id_alias_key'],
  ['entity_official_links', 'entity_official_links_entity_id_link_type_url_key'],
  ['youtube_channels', 'youtube_channels_canonical_channel_url_key'],
  ['entity_youtube_channels', 'entity_youtube_channels_pkey'],
  ['releases', 'releases_entity_id_normalized_release_title_release_date_stream'],
  ['tracks', 'tracks_release_id_track_order_key'],
  ['release_service_links', 'release_service_links_release_id_service_type_key'],
  ['track_service_links', 'track_service_links_track_id_service_type_key'],
  ['upcoming_signal_sources', 'upcoming_signal_sources_upcoming_signal_id_source_url_key'],
  ['release_link_overrides', 'release_link_overrides_release_id_service_type_key'],
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const connectionString = requiredEnv('DATABASE_URL');
  const client = new Client({
    connectionString,
    application_name: 'idol-song-app-backend-verify',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const tableRows = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [REQUIRED_TABLES]
    );

    const existingTables = new Set(tableRows.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((name) => !existingTables.has(name));

    if (missingTables.length > 0) {
      throw new Error(`missing tables: ${missingTables.join(', ')}`);
    }

    const constraintRows = await client.query(
      `
        select table_name, constraint_name
        from information_schema.table_constraints
        where table_schema = 'public'
          and constraint_name = any($1::text[])
      `,
      [REQUIRED_CONSTRAINTS.map(([, constraint]) => constraint)]
    );

    const existingConstraints = new Set(
      constraintRows.rows.map((row) => `${row.table_name}.${row.constraint_name}`)
    );

    const missingConstraints = REQUIRED_CONSTRAINTS
      .map(([table, constraint]) => `${table}.${constraint}`)
      .filter((entry) => !existingConstraints.has(entry));

    if (missingConstraints.length > 0) {
      throw new Error(`missing constraints: ${missingConstraints.join(', ')}`);
    }

    console.log(`verified tables: ${REQUIRED_TABLES.length}`);
    console.log(`verified constraints: ${REQUIRED_CONSTRAINTS.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
