import test from 'node:test';
import assert from 'node:assert/strict';

import { applyManualCurationImports, buildManualCurationBundles } from './manualCurationBundles.mjs';

test('buildManualCurationBundles exports service, title-track, and entity bundles with pending curation payloads', () => {
  const bundles = buildManualCurationBundles({
    serviceLinkGapQueues: {
      counts: { spotify: { total: 1 }, youtube_music: { total: 0 }, youtube_mv: { total: 0 } },
      queues: {
        spotify: [
          {
            queue_key: 'release-1:spotify',
            group: 'YENA',
            slug: 'yena',
            release_title: 'Blooming Wings',
            release_date: '2026-03-11',
            stream: 'song',
            entity_type: 'solo',
            entity_tier: 'core',
            priority_tier: 'tier_1',
            release_kind: 'single',
            release_cohort: 'latest',
            current_status: 'no_link',
            current_url: '',
            provenance: '',
            review_reason: 'Missing Spotify url.',
            recommended_action: 'Curate Spotify link.',
            suggested_search_query: 'YENA Blooming Wings spotify',
            mv_allowlist_urls: [],
          },
        ],
        youtube_music: [],
        youtube_mv: [],
      },
    },
    titleTrackGapQueue: {
      counts: { total: 1 },
      rows: [
        {
          queue_key: 'release-1:title',
          group: 'YENA',
          slug: 'yena',
          release_title: 'Blooming Wings',
          release_date: '2026-03-11',
          stream: 'song',
          entity_type: 'solo',
          entity_tier: 'core',
          priority_tier: 'tier_1',
          release_kind: 'single',
          release_cohort: 'latest',
          track_titles: ['Blooming Wings'],
          candidate_titles: ['Blooming Wings'],
          candidate_sources: ['release_title_substring'],
          review_reason: 'Need explicit title-track confirmation.',
          recommended_action: 'Confirm title track.',
          double_title_candidate: false,
          title_track_status: 'review',
        },
      ],
    },
    entityIdentityWorkbench: {
      counts: { entities: 1, field_rows: 1 },
      entities: [
        {
          slug: 'yena',
          latest_release_date: '2026-03-11',
          has_active_upcoming: true,
          missing_fields: ['entities.official_youtube'],
        },
      ],
      field_queue: [
        {
          queue_key: 'yena:entities.official_youtube',
          group: 'YENA',
          slug: 'yena',
          entity_type: 'solo',
          entity_tier: 'core',
          priority_tier: 'tier_1',
          field_family_key: 'entities.official_youtube',
          field_label: 'Official YouTube',
          identity_critical: true,
          current_status: 'unresolved',
          candidate_source_hints: ['artist_socials_structured.youtube_url'],
          recommended_action: 'Curate official YouTube.',
        },
      ],
    },
    generatedAt: new Date('2026-03-12T00:00:00Z'),
  });

  assert.equal(bundles.serviceLink.bundle_version, 1);
  assert.equal(bundles.serviceLink.rows[0].curation.decision, null);
  assert.equal(bundles.titleTrack.rows[0].curation.values.length, 0);
  assert.equal(bundles.entityIdentity.rows[0].field_family_key, 'entities.official_youtube');
});

test('applyManualCurationImports writes release override rows and reviewer traces', () => {
  const releaseDetailOverrides = [];
  const artistProfiles = [
    {
      slug: 'yena',
      group: 'YENA',
      display_name: 'YENA',
      agency: '',
      official_youtube_url: '',
      official_x_url: '',
      official_instagram_url: '',
      representative_image_url: null,
      representative_image_source: null,
      search_aliases: ['최예나'],
    },
  ];

  const serviceLinkBundle = {
    bundle_version: 1,
    bundle_kind: 'manual_curation_bundle',
    field_family: 'service_link',
    generated_at: '2026-03-12T00:00:00.000Z',
    rows: [
      {
        bundle_row_key: 'release-1:spotify',
        field_family_key: 'release_service_links.spotify',
        target: {
          group: 'YENA',
          slug: 'yena',
          release_title: 'Blooming Wings',
          release_date: '2026-03-11',
          stream: 'song',
          service_type: 'spotify',
        },
        context: {},
        current_state: { status: 'no_link', url: null, provenance: null },
        curation: {
          decision: 'set_manual_override',
          value: 'https://open.spotify.com/album/example',
          values: null,
          provenance: 'manual curator verified canonical spotify album URL',
          reviewer: 'gimtaehun',
          reviewed_at: '2026-03-12T09:00:00+09:00',
          notes: 'Spotify manual override.',
        },
      },
    ],
  };

  const titleTrackBundle = {
    bundle_version: 1,
    bundle_kind: 'manual_curation_bundle',
    field_family: 'title_track',
    generated_at: '2026-03-12T00:00:00.000Z',
    rows: [
      {
        bundle_row_key: 'release-1:title',
        field_family_key: 'release_detail.title_tracks',
        target: {
          group: 'YENA',
          slug: 'yena',
          release_title: 'Blooming Wings',
          release_date: '2026-03-11',
          stream: 'song',
        },
        context: {},
        current_state: { status: 'review', values: [], provenance: null },
        curation: {
          decision: 'set_manual_override',
          value: null,
          values: ['Blooming Wings'],
          provenance: 'official teaser copy',
          reviewer: 'gimtaehun',
          reviewed_at: '2026-03-12T09:01:00+09:00',
          notes: 'Single title track.',
        },
      },
    ],
  };

  const entityIdentityBundle = {
    bundle_version: 1,
    bundle_kind: 'manual_curation_bundle',
    field_family: 'entity_identity',
    generated_at: '2026-03-12T00:00:00.000Z',
    rows: [
      {
        bundle_row_key: 'yena:entities.official_youtube',
        field_family_key: 'entities.official_youtube',
        target: { group: 'YENA', slug: 'yena', field_family_key: 'entities.official_youtube' },
        context: {},
        current_state: { status: 'unresolved', value: null, provenance: null },
        curation: {
          decision: 'set_value',
          value: 'https://www.youtube.com/@YENA_OFFICIAL',
          values: null,
          provenance: 'official youtube channel',
          reviewer: 'gimtaehun',
          reviewed_at: '2026-03-12T09:02:00+09:00',
          notes: 'Official channel verified.',
        },
      },
    ],
  };

  const result = applyManualCurationImports({
    serviceLinkBundle,
    titleTrackBundle,
    entityIdentityBundle,
    releaseDetailOverrides,
    artistProfiles,
  });

  assert.equal(result.releaseDetailOverrides.length, 1);
  assert.equal(result.releaseDetailOverrides[0].spotify_url, 'https://open.spotify.com/album/example');
  assert.equal(result.releaseDetailOverrides[0].spotify_status, 'manual_override');
  assert.deepEqual(result.releaseDetailOverrides[0].title_tracks, ['Blooming Wings']);
  assert.equal(result.releaseDetailOverrides[0].manual_curation_traces.length, 2);
  assert.equal(result.artistProfiles[0].official_youtube_url, 'https://www.youtube.com/@YENA_OFFICIAL');
  assert.equal(result.artistProfiles[0].official_youtube_source, 'official youtube channel');
  assert.equal(result.artistProfiles[0].manual_curation_traces.length, 1);
  assert.equal(result.summary.service_link.set_manual_override, 1);
  assert.equal(result.summary.title_track.set_manual_override, 1);
  assert.equal(result.summary.entity_identity.set_value, 1);
});

test('applyManualCurationImports supports explicit no-link and unresolved identity decisions', () => {
  const releaseDetailOverrides = [
    {
      group: 'YENA',
      release_title: 'Blooming Wings',
      release_date: '2026-03-11',
      stream: 'song',
      youtube_music_url: 'https://music.youtube.com/watch?v=old',
    },
  ];
  const artistProfiles = [
    {
      slug: 'yena',
      group: 'YENA',
      display_name: 'YENA',
      official_youtube_url: '',
      official_x_url: '',
      official_instagram_url: '',
      search_aliases: [],
    },
  ];

  const serviceLinkBundle = {
    bundle_version: 1,
    bundle_kind: 'manual_curation_bundle',
    field_family: 'service_link',
    generated_at: '2026-03-12T00:00:00.000Z',
    rows: [
      {
        bundle_row_key: 'release-1:youtube_music',
        field_family_key: 'release_service_links.youtube_music',
        target: {
          group: 'YENA',
          slug: 'yena',
          release_title: 'Blooming Wings',
          release_date: '2026-03-11',
          stream: 'song',
          service_type: 'youtube_music',
        },
        context: {},
        current_state: { status: 'no_link', url: null, provenance: null },
        curation: {
          decision: 'mark_no_link',
          value: null,
          values: null,
          provenance: 'manual no-link verification',
          reviewer: 'gimtaehun',
          reviewed_at: '2026-03-12T09:00:00+09:00',
          notes: 'No canonical YTM link.',
        },
      },
    ],
  };

  const entityIdentityBundle = {
    bundle_version: 1,
    bundle_kind: 'manual_curation_bundle',
    field_family: 'entity_identity',
    generated_at: '2026-03-12T00:00:00.000Z',
    rows: [
      {
        bundle_row_key: 'yena:entities.official_x',
        field_family_key: 'entities.official_x',
        target: { group: 'YENA', slug: 'yena', field_family_key: 'entities.official_x' },
        context: {},
        current_state: { status: 'unresolved', value: null, provenance: null },
        curation: {
          decision: 'keep_unresolved',
          value: null,
          values: null,
          provenance: 'official account not yet opened',
          reviewer: 'gimtaehun',
          reviewed_at: '2026-03-12T09:05:00+09:00',
          notes: 'Keep unresolved.',
        },
      },
    ],
  };

  const result = applyManualCurationImports({
    serviceLinkBundle,
    entityIdentityBundle,
    releaseDetailOverrides,
    artistProfiles,
  });

  assert.equal(result.releaseDetailOverrides[0].youtube_music_status, 'no_link');
  assert.equal(result.releaseDetailOverrides[0].youtube_music_url, undefined);
  assert.equal(result.artistProfiles[0].official_x_url, '');
  assert.equal(result.artistProfiles[0].manual_curation_traces[0].decision, 'keep_unresolved');
});
