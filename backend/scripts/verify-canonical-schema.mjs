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
  'notification_signal_states',
  'notification_events',
  'mobile_push_registrations',
  'notification_event_push_deliveries',
  'entity_tracking_state',
  'review_tasks',
  'release_link_overrides',
];
const REQUIRED_MATERIALIZED_VIEWS = [
  'entity_search_documents',
  'calendar_month_projection',
  'entity_detail_projection',
  'release_detail_projection',
  'radar_projection',
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
  ['notification_events', 'notification_events_dedupe_key_key'],
  ['mobile_push_registrations', 'mobile_push_registrations_installation_id_key'],
  ['notification_event_push_deliveries', 'notification_event_push_deliveries_event_device_key'],
  ['release_link_overrides', 'release_link_overrides_release_id_service_type_key'],
];
const REQUIRED_INDEXES = [
  ['entity_aliases', 'idx_entity_aliases_normalized_alias'],
  ['entity_official_links', 'idx_entity_official_links_entity_id'],
  ['releases', 'idx_releases_entity_id_release_date'],
  ['releases', 'idx_releases_release_date'],
  ['releases', 'idx_releases_musicbrainz_release_group_id'],
  ['upcoming_signals', 'idx_upcoming_signals_entity_id'],
  ['upcoming_signals', 'idx_upcoming_signals_scheduled_date'],
  ['upcoming_signals', 'idx_upcoming_signals_scheduled_month'],
  ['upcoming_signals', 'idx_upcoming_signals_dedupe_key'],
  ['notification_signal_states', 'idx_notification_signal_states_last_seen_at'],
  ['notification_signal_states', 'idx_notification_signal_states_is_active'],
  ['notification_events', 'idx_notification_events_status_event_type'],
  ['notification_events', 'idx_notification_events_fingerprint_emitted_at'],
  ['mobile_push_registrations', 'idx_mobile_push_registrations_expo_push_token'],
  ['mobile_push_registrations', 'idx_mobile_push_registrations_active'],
  ['mobile_push_registrations', 'idx_mobile_push_registrations_seen_at'],
  ['notification_event_push_deliveries', 'idx_notification_event_push_deliveries_status'],
  ['notification_event_push_deliveries', 'idx_notification_event_push_deliveries_registration'],
  ['entity_tracking_state', 'idx_entity_tracking_state_tracking_status'],
  ['review_tasks', 'idx_review_tasks_status_review_type'],
  ['release_service_links', 'idx_release_service_links_status'],
  ['entity_search_documents', 'idx_entity_search_documents_entity_id'],
  ['entity_search_documents', 'idx_entity_search_documents_slug'],
  ['entity_search_documents', 'idx_entity_search_documents_normalized_terms'],
  ['release_detail_projection', 'idx_release_detail_projection_release_id'],
  ['release_detail_projection', 'idx_release_detail_projection_legacy_lookup'],
  ['entity_detail_projection', 'idx_entity_detail_projection_entity_id'],
  ['entity_detail_projection', 'idx_entity_detail_projection_slug'],
  ['calendar_month_projection', 'idx_calendar_month_projection_month_start'],
  ['calendar_month_projection', 'idx_calendar_month_projection_month_key'],
  ['radar_projection', 'idx_radar_projection_key'],
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

    const viewRows = await client.query(
      `
        select matviewname
        from pg_matviews
        where schemaname = 'public'
          and matviewname = any($1::text[])
      `,
      [REQUIRED_MATERIALIZED_VIEWS]
    );

    const existingViews = new Set(viewRows.rows.map((row) => row.matviewname));
    const missingViews = REQUIRED_MATERIALIZED_VIEWS.filter((name) => !existingViews.has(name));

    if (missingViews.length > 0) {
      throw new Error(`missing materialized views: ${missingViews.join(', ')}`);
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

    const indexRows = await client.query(
      `
        select tablename, indexname
        from pg_indexes
        where schemaname = 'public'
          and indexname = any($1::text[])
      `,
      [REQUIRED_INDEXES.map(([, index]) => index)]
    );

    const existingIndexes = new Set(
      indexRows.rows.map((row) => `${row.tablename}.${row.indexname}`)
    );

    const missingIndexes = REQUIRED_INDEXES
      .map(([table, index]) => `${table}.${index}`)
      .filter((entry) => !existingIndexes.has(entry));

    if (missingIndexes.length > 0) {
      throw new Error(`missing indexes: ${missingIndexes.join(', ')}`);
    }

    console.log(`verified tables: ${REQUIRED_TABLES.length}`);
    console.log(`verified materialized views: ${REQUIRED_MATERIALIZED_VIEWS.length}`);
    console.log(`verified constraints: ${REQUIRED_CONSTRAINTS.length}`);
    console.log(`verified indexes: ${REQUIRED_INDEXES.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
