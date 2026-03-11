import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEntityIdentityWorkbench,
  buildServiceLinkGapQueues,
  buildTitleTrackGapQueue,
} from './canonicalGapWorkbenches.mjs';

function createSupport() {
  return {
    socialByGroup: new Map([
      ['YENA', { tier: 'solo', x_url: 'https://x.com/yena', instagram_url: 'https://instagram.com/yena' }],
      ['BLACKPINK', { tier: 'core' }],
    ]),
    youtubeByGroup: new Map([
      ['YENA', { primary_team_channel_url: 'https://www.youtube.com/@yena' }],
    ]),
    badgeByGroup: new Map([
      ['YENA', { badge_image_url: 'https://example.com/yena.png' }],
    ]),
    mvReviewByKey: new Map([
      ['BLACKPINK|DEADLINE|2026-02-26|song', {
        review_reason: 'Need canonical MV confirmation.',
        recommended_action: 'Review official channel uploads.',
        suggested_search_query: 'BLACKPINK DEADLINE official mv',
        missing_mv_allowlist: false,
        mv_allowlist_urls: ['https://www.youtube.com/@BLACKPINK'],
      }],
    ]),
    titleTrackByKey: new Map([
      ['IVE|REVIVE+|2026-02-23|album', {
        track_titles: ['BLACKHOLE', 'BANG BANG'],
        candidate_titles: ['BLACKHOLE', 'BANG BANG'],
        candidate_sources: ['manual_review_queue'],
        review_reason: 'Double title candidate.',
        recommended_action: 'Confirm both promoted tracks.',
      }],
    ]),
    releaseDetailByKey: new Map([
      ['BLACKPINK|DEADLINE|2026-02-26|song', { attempted_methods_count: 5 }],
    ]),
  };
}

test('service-link queues split by service type and keep high-impact rows first', () => {
  const inputs = {
    releases: [
      {
        entity_id: 'entity-1',
        slug: 'blackpink',
        display_name: 'BLACKPINK',
        canonical_name: 'BLACKPINK',
        entity_type: 'group',
        agency_name: 'YG',
        debut_year: 2016,
        representative_image_url: '',
        official_youtube_url: 'https://www.youtube.com/@BLACKPINK',
        official_x_url: '',
        official_instagram_url: '',
        release_id: 'release-1',
        release_title: 'DEADLINE',
        release_date: '2026-02-26',
        release_year: 2026,
        stream: 'song',
        release_kind: 'single',
        title_track_count: 1,
        spotify_url: '',
        spotify_status: 'unresolved',
        spotify_provenance: '',
        youtube_music_url: '',
        youtube_music_status: 'no_link',
        youtube_music_provenance: '',
        youtube_mv_url: '',
        youtube_mv_status: 'needs_review',
        youtube_mv_provenance: '',
        has_active_upcoming: 1,
      },
    ],
  };

  const report = buildServiceLinkGapQueues(inputs, createSupport(), new Date('2026-03-11T00:00:00Z'));

  assert.equal(report.queues.spotify.length, 1);
  assert.equal(report.queues.youtube_music.length, 1);
  assert.equal(report.queues.youtube_mv.length, 1);
  assert.equal(report.queues.youtube_mv[0].priority_tier, 'tier_1');
  assert.equal(report.queues.youtube_mv[0].review_reason, 'Need canonical MV confirmation.');
  assert.equal(report.queues.youtube_music[0].gap_status, 'no_link');
});

test('title-track queue flags double-title candidates', () => {
  const inputs = {
    releases: [
      {
        entity_id: 'entity-2',
        slug: 'ive',
        display_name: 'IVE',
        canonical_name: 'IVE',
        entity_type: 'group',
        release_id: 'release-2',
        release_title: 'REVIVE+',
        release_date: '2026-02-23',
        release_year: 2026,
        stream: 'album',
        release_kind: 'album',
        title_track_count: 0,
        has_active_upcoming: 0,
      },
    ],
  };

  const report = buildTitleTrackGapQueue(inputs, createSupport(), new Date('2026-03-11T00:00:00Z'));

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].double_title_candidate, true);
  assert.equal(report.counts.double_title_candidates, 1);
});

test('entity identity workbench prioritizes identity-critical missing fields', () => {
  const inputs = {
    entities: [
      {
        entity_id: 'entity-3',
        slug: 'yena',
        display_name: 'YENA',
        canonical_name: 'YENA',
        entity_type: 'solo',
        agency_name: '',
        debut_year: null,
        representative_image_url: '',
        official_youtube_url: '',
        official_x_url: '',
        official_instagram_url: '',
        artist_source_url: '',
        has_active_upcoming: 1,
        latest_release_date: '2026-03-11',
      },
    ],
  };

  const report = buildEntityIdentityWorkbench(inputs, createSupport(), new Date('2026-03-11T00:00:00Z'));

  assert.equal(report.entities.length, 1);
  assert.deepEqual(report.entities[0].identity_critical_missing_fields, [
    'entities.representative_image',
    'entities.official_youtube',
    'entities.official_x',
    'entities.official_instagram',
  ]);
  assert.equal(report.field_queue[0].field_family_key, 'entities.representative_image');
  assert.deepEqual(report.field_queue[0].candidate_source_hints, ['teamBadgeAssets.badge_image_url']);
  assert.equal(report.counts.identity_critical_rows, 4);
});
