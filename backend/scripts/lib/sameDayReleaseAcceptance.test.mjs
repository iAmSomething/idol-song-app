import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSameDayReleaseAcceptanceReport,
  renderSameDayReleaseAcceptanceMarkdown,
} from './sameDayReleaseAcceptance.mjs';

function buildFixtureInputs() {
  return {
    releases: [
      {
        group: 'YENA',
        latest_song: {
          title: 'Drama Queen',
          date: '2026-03-11',
          release_kind: 'single',
        },
        latest_album: {
          title: 'LOVE CATCHER',
          date: '2026-03-11',
          release_kind: 'ep',
          release_format: 'ep',
        },
      },
      {
        group: 'P1Harmony',
        latest_song: null,
        latest_album: null,
      },
    ],
    details: [
      {
        group: 'YENA',
        release_title: 'LOVE CATCHER',
        release_date: '2026-03-11',
        stream: 'album',
        title_track_status: 'verified',
        youtube_video_status: 'manual_override',
        youtube_video_url: 'https://www.youtube.com/watch?v=yena-love-catcher',
        tracks: [
          { order: 1, title: 'LOVE CATCHER', is_title_track: true },
          { order: 2, title: 'Drama Queen', is_title_track: false },
        ],
      },
    ],
    artwork: [
      {
        group: 'YENA',
        release_title: 'LOVE CATCHER',
        release_date: '2026-03-11',
        stream: 'album',
        cover_image_url: 'https://cdn.example.com/love-catcher.jpg',
      },
    ],
    upcomingSignals: [
      {
        group: 'YENA',
        scheduled_date: '2026-03-11',
        date_precision: 'exact',
      },
      {
        group: 'P1Harmony',
        scheduled_date: '2026-03-12',
        date_precision: 'exact',
      },
    ],
  };
}

test('reports YENA suppression pass and P1Harmony acceptance fail when same-day release is still upcoming-only', () => {
  const report = buildSameDayReleaseAcceptanceReport(buildFixtureInputs(), '2026-03-12');

  assert.equal(report.overall_status, 'fail');
  const yena = report.fixtures.find((fixture) => fixture.key === 'yena_suppression');
  const p1 = report.fixtures.find((fixture) => fixture.key === 'p1harmony_acceptance');

  assert.equal(yena?.status, 'pass');
  assert.equal(yena?.checks.user_facing_upcoming_suppressed, true);

  assert.equal(p1?.status, 'fail');
  assert.deepEqual(p1?.missing_requirements, [
    'released_row',
    'album_cover',
    'track_list',
    'official_mv',
    'title_track',
    'user_surface_suppression',
  ]);
  assert.match(report.failure_update_markdown, /P1Harmony same-day release acceptance/);
});

test('passes the P1Harmony acceptance fixture when all five release-side fields are present', () => {
  const inputs = buildFixtureInputs();
  inputs.releases[1] = {
    group: 'P1Harmony',
    latest_song: null,
    latest_album: {
      title: 'UNIQUE',
      date: '2026-03-12',
      release_kind: 'ep',
      release_format: 'ep',
      source: 'https://musicbrainz.org/release-group/p1harmony-unique',
    },
  };
  inputs.details.push({
    group: 'P1Harmony',
    release_title: 'UNIQUE',
    release_date: '2026-03-12',
    stream: 'album',
    title_track_status: 'verified',
    youtube_video_status: 'manual_override',
    youtube_video_url: 'https://www.youtube.com/watch?v=p1harmony-unique',
    tracks: [
      { order: 1, title: 'UNIQUE', is_title_track: true },
      { order: 2, title: 'Hero', is_title_track: false },
    ],
  });
  inputs.artwork.push({
    group: 'P1Harmony',
    release_title: 'UNIQUE',
    release_date: '2026-03-12',
    stream: 'album',
    cover_image_url: 'https://cdn.example.com/unique.jpg',
  });

  const report = buildSameDayReleaseAcceptanceReport(inputs, '2026-03-12');
  const p1 = report.fixtures.find((fixture) => fixture.key === 'p1harmony_acceptance');

  assert.equal(p1?.status, 'pass');
  assert.equal(p1?.checks.album_cover_attached, true);
  assert.equal(p1?.checks.track_list_attached, true);
  assert.equal(p1?.checks.official_mv_attached, true);
  assert.equal(p1?.checks.title_track_attached, true);
});

test('renders a markdown report with the failed-cycle update template', () => {
  const report = buildSameDayReleaseAcceptanceReport(buildFixtureInputs(), '2026-03-12');
  const markdown = renderSameDayReleaseAcceptanceMarkdown(report);

  assert.match(markdown, /# Same-day Release Acceptance Report/);
  assert.match(markdown, /P1Harmony same-day release acceptance/);
  assert.match(markdown, /## Failed-cycle update template/);
});
