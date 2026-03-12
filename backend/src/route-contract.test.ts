import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import type { DbPool } from './lib/db.js';
import type { ReadyStatusSnapshot } from './lib/readiness.js';

const NOW = '2026-03-08T06:00:00.000Z';
const ENTITY_ID = '11111111-1111-4111-8111-111111111111';
const YENA_RELEASE_ID = '22222222-2222-4222-8222-222222222222';
const IVE_RELEASE_ID = '33333333-3333-4333-8333-333333333333';
const MALFORMED_RELEASE_ID = '44444444-4444-4444-8444-444444444444';
const UPCOMING_SIGNAL_ID = '55555555-5555-4555-8555-555555555555';
const UPCOMING_REVIEW_ID = '66666666-6666-4666-8666-666666666666';
const MV_REVIEW_ID = '77777777-7777-4777-8777-777777777777';
const IVE_ENTITY_ID = '88888888-8888-4888-8888-888888888888';
const BLACKPINK_DEADLINE_UNRESOLVED_RELEASE_ID = '99999999-9999-4999-8999-999999999991';
const BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID = '99999999-9999-4999-8999-999999999992';
const CALLER_REQUEST_ID = 'web-search-trace-yena-001';

const TEST_CONFIG: AppConfig = {
  appEnv: 'development',
  port: 3000,
  appTimezone: 'Asia/Seoul',
  databaseUrl: 'postgresql://test:test@localhost/test',
  databaseMode: 'pooled',
  databaseConnectionTimeoutMs: 3_000,
  databaseReadTimeoutMs: 5_000,
  allowedWebOrigins: ['https://iamsomething.github.io'],
  readRateLimits: {
    search: { max: 600, windowMs: 60_000 },
    calendarMonth: { max: 300, windowMs: 60_000 },
    entityDetail: { max: 300, windowMs: 60_000 },
    releaseDetail: { max: 300, windowMs: 60_000 },
    radar: { max: 120, windowMs: 60_000 },
  },
};

type QueryResult<Row> = {
  rows: Row[];
  rowCount: number;
};

type FakeDbOptions = {
  malformedReleaseIds?: string[];
  timeoutEntitySearch?: boolean;
  pingFails?: boolean;
};

type TestAppOptions = FakeDbOptions & {
  readyStatusSnapshot?: ReadyStatusSnapshot;
};

function buildEntitySearchPayload() {
  return {
    entity_slug: 'yena',
    display_name: 'YENA',
    canonical_name: 'YENA',
    entity_type: 'solo',
    agency_name: 'Yuehua Entertainment',
    aliases: ['최예나'],
    latest_release: {
      release_id: YENA_RELEASE_ID,
      release_title: 'LOVE CATCHER',
      release_date: '2026-03-11',
      stream: 'album',
      release_kind: 'ep',
    },
    next_upcoming: {
      headline: '최예나, 3월 11일 컴백 확정',
      scheduled_date: '2026-03-11',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      release_format: 'ep',
      confidence_score: 0.84,
    },
  };
}

function buildIveEntitySearchPayload() {
  return {
    entity_slug: 'ive',
    display_name: 'IVE',
    canonical_name: 'IVE',
    entity_type: 'group',
    agency_name: 'Starship Entertainment',
    aliases: ['아이브'],
    latest_release: {
      release_id: IVE_RELEASE_ID,
      release_title: 'REVIVE+',
      release_date: '2026-02-23',
      stream: 'album',
      release_kind: 'ep',
    },
    next_upcoming: null,
  };
}

function buildEntityDetailPayload() {
  return {
    identity: {
      entity_slug: 'yena',
      display_name: 'YENA',
      canonical_name: 'YENA',
      entity_type: 'solo',
      agency_name: 'Yuehua Entertainment',
      debut_year: 2022,
      badge_image_url: null,
      badge_source_url: null,
      badge_source_label: null,
      badge_kind: null,
      representative_image_url: null,
      representative_image_source: null,
    },
    official_links: {
      youtube: 'https://www.youtube.com/@YENA_OFFICIAL',
      x: 'https://x.com/YENA_OFFICIAL',
      instagram: 'https://www.instagram.com/yena.jigumina',
    },
    youtube_channels: {
      primary_team_channel_url: 'https://www.youtube.com/@YENA_OFFICIAL',
      mv_allowlist_urls: ['https://www.youtube.com/@YENA_OFFICIAL'],
    },
    tracking_state: {
      tier: 'manual_watch',
      watch_reason: 'solo',
      tracking_status: 'watch_only',
    },
    next_upcoming: {
      upcoming_signal_id: UPCOMING_SIGNAL_ID,
      headline: '최예나, 3월 11일 컴백 확정',
      scheduled_date: '2026-03-11',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      release_format: 'ep',
      confidence_score: 0.84,
      latest_seen_at: NOW,
      source_type: 'news_rss',
      source_url: 'https://starnews.example/yena-love-catcher',
      source_domain: 'starnews.example',
      evidence_summary: 'StarNews confirmed the March 11 comeback timing.',
      source_count: 2,
    },
    latest_release: {
      release_id: YENA_RELEASE_ID,
      release_title: 'LOVE CATCHER',
      release_date: '2026-03-11',
      stream: 'album',
      release_kind: 'ep',
      release_format: 'ep',
      representative_song_title: 'LOVE CATCHER',
      spotify_url: 'https://open.spotify.com/album/love-catcher',
      youtube_music_url: 'https://music.youtube.com/playlist?list=PLLOVECATCHER',
      youtube_mv_url: null,
      artwork: {
        cover_image_url: 'https://cdn.example.com/love-catcher-cover.jpg',
        thumbnail_image_url: 'https://cdn.example.com/love-catcher-thumb.jpg',
        artwork_source_type: 'releaseArtwork.cover_image_url',
        artwork_source_url: 'https://artwork.example.com/love-catcher',
        is_placeholder: false,
      },
    },
    recent_albums: [
      {
        release_id: YENA_RELEASE_ID,
        release_title: 'LOVE CATCHER',
        release_date: '2026-03-11',
        stream: 'album',
        release_kind: 'ep',
        release_format: 'ep',
        representative_song_title: 'LOVE CATCHER',
        spotify_url: 'https://open.spotify.com/album/love-catcher',
        youtube_music_url: 'https://music.youtube.com/playlist?list=PLLOVECATCHER',
        youtube_mv_url: null,
        artwork: {
          cover_image_url: 'https://cdn.example.com/love-catcher-cover.jpg',
          thumbnail_image_url: 'https://cdn.example.com/love-catcher-thumb.jpg',
          artwork_source_type: 'releaseArtwork.cover_image_url',
          artwork_source_url: 'https://artwork.example.com/love-catcher',
          is_placeholder: false,
        },
      },
    ],
    source_timeline: [
      {
        event_type: 'official_announcement',
        headline: '최예나, 3월 11일 컴백 확정',
        occurred_at: NOW,
        summary: 'ep · confirmed · 2026-03-11',
        source_url: 'https://starnews.example/yena-love-catcher',
        source_type: 'news_rss',
        source_domain: 'starnews.example',
        published_at: NOW,
        scheduled_date: '2026-03-11',
        scheduled_month: '2026-03',
        date_precision: 'exact',
        date_status: 'confirmed',
        release_format: 'ep',
        confidence_score: 0.84,
        evidence_summary: 'StarNews confirmed the March 11 comeback timing.',
        source_count: 2,
      },
    ],
    artist_source_url: 'https://www.youtube.com/@YENA_OFFICIAL',
  };
}

function buildReleaseDetailPayload(releaseId: string) {
  return {
    release: {
      release_id: releaseId,
      entity_slug: 'ive',
      display_name: 'IVE',
      release_title: 'REVIVE+',
      release_date: '2026-02-23',
      stream: 'album',
      release_kind: 'ep',
    },
    detail_metadata: {
      status: 'verified',
      provenance: 'releaseDetails.existing_row',
    },
    title_track_metadata: {
      status: 'manual_override',
      provenance: 'release_detail_overrides.title_tracks',
    },
    artwork: {
      image_url: 'https://cdn.example.com/revive-plus.jpg',
      source_url: 'https://artwork.example.com/revive-plus',
      is_placeholder: false,
    },
    service_links: {
      spotify: {
        url: 'https://open.spotify.com/album/reviveplus',
        status: 'canonical',
        provenance: 'releaseDetails.spotify_url',
      },
      youtube_music: {
        url: 'https://music.youtube.com/playlist?list=PLIVE',
        status: 'manual_override',
        provenance: 'manual_override',
      },
    },
    tracks: [
      {
        track_id: 'track-blackhole',
        order: 1,
        title: 'BLACKHOLE',
        is_title_track: true,
        spotify: {
          url: 'https://open.spotify.com/track/blackhole',
          status: 'canonical',
          provenance: 'releaseDetails.spotify_url',
        },
        youtube_music: {
          url: 'https://music.youtube.com/watch?v=blackhole',
          status: 'manual_override',
          provenance: 'manual_override',
        },
      },
      {
        track_id: 'track-bangbang',
        order: 2,
        title: 'BANG BANG',
        is_title_track: true,
        spotify: {
          url: 'https://open.spotify.com/track/bangbang',
          status: 'canonical',
          provenance: 'releaseDetails.spotify_url',
        },
        youtube_music: null,
      },
    ],
    mv: {
      url: null,
      video_id: null,
      status: 'unresolved',
      provenance: null,
    },
    credits: [],
    charts: [],
    notes: {
      summary: 'double title track',
    },
  };
}

function buildBlackpinkDeadlinePayload(releaseId: string, releaseDate: string, detailStatus: string, titleStatus: string, youtubeMusicStatus: string) {
  return {
    release: {
      release_id: releaseId,
      entity_slug: 'blackpink',
      display_name: 'BLACKPINK',
      release_title: 'DEADLINE',
      release_date: releaseDate,
      stream: 'album',
      release_kind: 'ep',
    },
    detail_metadata: {
      status: detailStatus,
      provenance: detailStatus === 'verified' ? 'releaseDetails.existing_row' : 'releaseDetails.missing_row',
    },
    title_track_metadata: {
      status: titleStatus,
      provenance: titleStatus === 'verified' ? 'releaseDetails.existing_title_flags' : 'releaseDetails.missing_row',
    },
    artwork: {
      image_url: 'https://cdn.example.com/deadline.jpg',
      source_url: 'https://artwork.example.com/deadline',
      is_placeholder: false,
    },
    service_links: {
      spotify: {
        url: 'https://open.spotify.com/album/deadline',
        status: 'canonical',
        provenance: 'releaseDetails.spotify_url',
      },
      youtube_music: {
        url: 'https://music.youtube.com/playlist?list=PLBLACKPINK',
        status: youtubeMusicStatus,
        provenance: youtubeMusicStatus === 'canonical' ? 'releaseDetails.youtube_music_url' : 'ytmusicapi exact album search match',
      },
    },
    tracks: [
      {
        track_id: 'bp-track-1',
        order: 1,
        title: 'JUMP',
        is_title_track: true,
        spotify: {
          url: 'https://open.spotify.com/track/bp-jump',
          status: 'canonical',
          provenance: 'releaseDetails.spotify_url',
        },
        youtube_music: null,
      },
      {
        track_id: 'bp-track-2',
        order: 2,
        title: 'Ready For Love',
        is_title_track: false,
        spotify: null,
        youtube_music: null,
      },
    ],
    mv: {
      url: 'https://www.youtube.com/watch?v=2GJfWMYCWY0',
      video_id: '2GJfWMYCWY0',
      status: 'manual_override',
      provenance: 'official artist channel watch URL',
    },
    credits: [],
    charts: [],
    notes: null,
  };
}

function buildCalendarMonthPayload() {
  return {
    summary: {
      verified_count: 1,
      exact_upcoming_count: 1,
      month_only_upcoming_count: 1,
    },
    nearest_upcoming: {
      upcoming_signal_id: UPCOMING_SIGNAL_ID,
      entity_slug: 'yena',
      display_name: 'YENA',
      entity_type: 'solo',
      agency_name: 'YUE HUA Entertainment',
      tracking_status: 'watch_only',
      headline: '최예나, 3월 11일 컴백 확정',
      scheduled_date: '2026-03-11',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      confidence_score: 0.84,
      release_format: 'ep',
      source_url: 'https://starnews.example/yena-love-catcher',
      source_type: 'news_rss',
      source_domain: 'starnews.example',
      evidence_summary: 'Korean article confirmed the release date.',
      source_count: 1,
    },
    days: [
      {
        date: '2026-03-11',
        verified_releases: [
          {
            release_id: YENA_RELEASE_ID,
            entity_slug: 'yena',
            display_name: 'YENA',
            entity_type: 'solo',
            agency_name: 'YUE HUA Entertainment',
            release_title: 'LOVE CATCHER',
            stream: 'album',
            release_kind: 'ep',
            release_format: 'ep',
            source_url: 'https://musicbrainz.example/yena-love-catcher',
            artist_source_url: 'https://www.youtube.com/@YENA_OFFICIAL',
            release_date: '2026-03-11',
          },
        ],
        exact_upcoming: [
          {
            upcoming_signal_id: UPCOMING_SIGNAL_ID,
            entity_slug: 'yena',
            display_name: 'YENA',
            entity_type: 'solo',
            agency_name: 'YUE HUA Entertainment',
            tracking_status: 'watch_only',
            headline: '최예나, 3월 11일 컴백 확정',
            scheduled_date: '2026-03-11',
            scheduled_month: '2026-03',
            date_precision: 'exact',
            date_status: 'confirmed',
            confidence_score: 0.84,
            release_format: 'ep',
            source_url: 'https://starnews.example/yena-love-catcher',
            source_type: 'news_rss',
            source_domain: 'starnews.example',
            evidence_summary: 'Korean article confirmed the release date.',
            source_count: 1,
          },
        ],
      },
    ],
    month_only_upcoming: [
      {
        upcoming_signal_id: 'month-only-signal',
        entity_slug: 'kickflip',
        display_name: 'KickFlip',
        entity_type: 'group',
        agency_name: 'JYP Entertainment',
        tracking_status: 'watch_only',
        headline: 'KickFlip announces April comeback',
        scheduled_date: null,
        scheduled_month: '2026-04',
        date_precision: 'month_only',
        date_status: 'scheduled',
        confidence_score: 0.76,
        release_format: null,
        source_url: 'https://example.com/kickflip-april',
        source_type: 'news_rss',
        source_domain: 'example.com',
        evidence_summary: 'Month-only teaser coverage.',
        source_count: 1,
      },
    ],
    verified_list: [
      {
        release_id: YENA_RELEASE_ID,
        entity_slug: 'yena',
        display_name: 'YENA',
        entity_type: 'solo',
        agency_name: 'YUE HUA Entertainment',
        release_title: 'LOVE CATCHER',
        stream: 'album',
        release_kind: 'ep',
        release_format: 'ep',
        source_url: 'https://musicbrainz.example/yena-love-catcher',
        artist_source_url: 'https://www.youtube.com/@YENA_OFFICIAL',
        release_date: '2026-03-11',
      },
    ],
    scheduled_list: [
      {
        upcoming_signal_id: UPCOMING_SIGNAL_ID,
        entity_slug: 'yena',
        display_name: 'YENA',
        entity_type: 'solo',
        agency_name: 'YUE HUA Entertainment',
        tracking_status: 'watch_only',
        headline: '최예나, 3월 11일 컴백 확정',
        scheduled_date: '2026-03-11',
        scheduled_month: '2026-03',
        date_precision: 'exact',
        date_status: 'confirmed',
        confidence_score: 0.84,
        release_format: 'ep',
        source_url: 'https://starnews.example/yena-love-catcher',
        source_type: 'news_rss',
        source_domain: 'starnews.example',
        evidence_summary: 'Korean article confirmed the release date.',
        source_count: 1,
      },
    ],
  };
}

function buildRadarPayload() {
  return {
    featured_upcoming: {
      upcoming_signal_id: 'upcoming-yena',
      entity_slug: 'yena',
      display_name: 'YENA',
      entity_type: 'solo',
      agency_name: 'YUE HUA Entertainment',
      tracking_status: 'watch_only',
      headline: 'YENA confirms March comeback',
      scheduled_date: '2026-03-11',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      confidence_score: 0.84,
      release_format: 'ep',
      source_url: 'https://starnews.example/yena-love-catcher',
      source_type: 'news_rss',
      source_domain: 'starnews.example',
      evidence_summary: 'Korean article confirmed the release date.',
      source_count: 1,
    },
    weekly_upcoming: [
      {
        upcoming_signal_id: 'upcoming-yena',
        entity_slug: 'yena',
        display_name: 'YENA',
        entity_type: 'solo',
        agency_name: 'YUE HUA Entertainment',
        tracking_status: 'watch_only',
        headline: 'YENA confirms March comeback',
        scheduled_date: '2026-03-11',
        scheduled_month: '2026-03',
        date_precision: 'exact',
        date_status: 'confirmed',
        confidence_score: 0.84,
        release_format: 'ep',
        source_url: 'https://starnews.example/yena-love-catcher',
        source_type: 'news_rss',
        source_domain: 'starnews.example',
        evidence_summary: 'Korean article confirmed the release date.',
        source_count: 1,
      },
    ],
    change_feed: [
      {
        kind: 'upcoming_signal',
        entity_slug: 'yena',
        display_name: 'YENA',
        upcoming_signal_id: 'upcoming-yena',
        headline: 'YENA confirms March comeback',
        scheduled_date: '2026-03-11',
        scheduled_month: null,
        date_precision: 'exact',
        date_status: 'confirmed',
        confidence_score: 0.84,
        occurred_at: NOW,
      },
    ],
    long_gap: [
      {
        entity_slug: 'woo-ah',
        display_name: 'woo!ah!',
        entity_type: 'group',
        agency_name: 'NV Entertainment',
        tracking_status: 'watch_only',
        watch_reason: 'long_gap',
        latest_release: {
          release_id: 'release-wooah',
          release_title: 'Shining on you',
          release_date: '2024-07-16',
          stream: 'album',
          release_kind: 'ep',
          release_format: 'ep',
          source_url: 'https://musicbrainz.example/wooah-shining-on-you',
          artist_source_url: 'https://www.youtube.com/@wooah',
        },
        gap_days: 600,
        has_upcoming_signal: false,
        latest_signal: null,
      },
    ],
    rookie: [
      {
        entity_slug: 'atheart',
        display_name: 'AtHeart',
        entity_type: 'group',
        agency_name: 'Titan Content',
        tracking_status: 'watch_only',
        debut_year: 2025,
        latest_release: {
          release_id: 'release-atheart',
          release_title: 'Shut Up',
          release_date: '2026-02-26',
          stream: 'song',
          release_kind: 'single',
          release_format: 'single',
          source_url: 'https://musicbrainz.example/atheart-shut-up',
          artist_source_url: 'https://www.youtube.com/@AtHeart',
        },
        has_upcoming_signal: true,
        latest_signal: {
          upcoming_signal_id: 'upcoming-atheart',
          headline: 'AtHeart April teaser',
          scheduled_date: null,
          scheduled_month: '2026-04-01',
          date_precision: 'month_only',
          date_status: 'scheduled',
          release_format: '',
          confidence_score: 0.76,
          latest_seen_at: NOW,
          source_url: 'https://example.com/atheart-april',
          source_type: 'news_rss',
          source_domain: 'example.com',
          evidence_summary: 'Month-only teaser coverage.',
          source_count: 1,
        },
      },
    ],
  };
}

class FakeDb {
  private readonly malformedReleaseIds: Set<string>;
  private readonly timeoutEntitySearch: boolean;

  constructor(options: FakeDbOptions = {}) {
    this.malformedReleaseIds = new Set(options.malformedReleaseIds ?? []);
    this.timeoutEntitySearch = options.timeoutEntitySearch === true;
    this.pingFails = options.pingFails === true;
  }

  private readonly pingFails: boolean;

  async query<Row extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<Row>> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql === 'select 1') {
      if (this.pingFails) {
        throw new Error('database unreachable');
      }
      return this.result<Row>([{ '?column?': 1 } as unknown as Row]);
    }

    if (normalizedSql.includes('from entity_search_documents')) {
      if (this.timeoutEntitySearch) {
        const error = new Error('canceling statement due to statement timeout') as Error & { code?: string };
        error.code = '57014';
        throw error;
      }

      if (normalizedSql.includes('where entity_slug = any($1::text[])')) {
        const slugs = Array.isArray(params[0]) ? params[0] : [];
        const rows: Row[] = [];
        if (slugs.includes('ive')) {
          rows.push({
            entity_id: IVE_ENTITY_ID,
            entity_slug: 'ive',
            aliases: ['아이브'],
            payload: buildIveEntitySearchPayload(),
            generated_at: NOW,
          } as unknown as Row);
        }
        if (slugs.includes('yena')) {
          rows.push({
            entity_id: ENTITY_ID,
            entity_slug: 'yena',
            aliases: ['최예나'],
            payload: buildEntitySearchPayload(),
            generated_at: NOW,
          } as unknown as Row);
        }
        return this.result<Row>(rows);
      }

      if (params[0] === '최예나' || params[0] === 'yena') {
        return this.result<Row>([
          {
            entity_id: ENTITY_ID,
            entity_slug: 'yena',
            aliases: ['최예나'],
            payload: buildEntitySearchPayload(),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from releases r') && normalizedSql.includes('projection_normalize_text(r.release_title)')) {
      if (params[0] === 'revive') {
        return this.result<Row>([
          {
            release_id: IVE_RELEASE_ID,
            entity_slug: 'ive',
            display_name: 'IVE',
            release_title: 'REVIVE+',
            release_date: '2026-02-23',
            stream: 'album',
            release_kind: 'ep',
            release_format: 'ep',
          } as unknown as Row,
        ]);
      }
      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from releases r') && normalizedSql.includes('where r.id = any($1::uuid[])')) {
      return this.result<Row>([
        {
          release_id: YENA_RELEASE_ID,
          entity_slug: 'yena',
          display_name: 'YENA',
          release_title: 'LOVE CATCHER',
          release_date: '2026-03-11',
          stream: 'album',
          release_kind: 'ep',
          release_format: 'ep',
        } as unknown as Row,
      ]);
    }

    if (normalizedSql.includes('from upcoming_signals us') && normalizedSql.includes('projection_normalize_text(us.headline)')) {
      if (params[0] === '컴백') {
        return this.result<Row>([
          {
            upcoming_signal_id: 'month-only-signal',
            entity_id: 'kickflip-entity-id',
            entity_slug: 'kickflip',
            display_name: 'KickFlip',
            headline: 'KickFlip announces April comeback',
            scheduled_date: null,
            scheduled_month: '2026-04',
            date_precision: 'month_only',
            date_status: 'scheduled',
            release_format: 'album',
            confidence_score: 0.74,
            source_type: 'weverse_notice',
            source_url: 'https://www.weverse.io/kickflip/notice/1',
            evidence_summary: 'April comeback teaser posted on Weverse.',
          } as unknown as Row,
        ]);
      }
      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from upcoming_signals us') && normalizedSql.includes('us.entity_id = any($1::uuid[])')) {
      return this.result<Row>([
        {
          upcoming_signal_id: UPCOMING_SIGNAL_ID,
          entity_id: ENTITY_ID,
          entity_slug: 'yena',
          display_name: 'YENA',
          headline: '최예나, 3월 11일 컴백 확정',
          scheduled_date: '2026-03-11',
          scheduled_month: '2026-03',
          date_precision: 'exact',
          date_status: 'confirmed',
          release_format: 'ep',
          confidence_score: 0.84,
          source_type: 'news_rss',
          source_url: 'https://starnews.example/yena-love-catcher',
          evidence_summary: 'Korean article confirmed the release date.',
        } as unknown as Row,
      ]);
    }

    if (normalizedSql.includes('from entity_detail_projection')) {
      if (params[0] === 'yena') {
        return this.result<Row>([
          {
            entity_slug: 'yena',
            payload: buildEntityDetailPayload(),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from release_detail_projection') && normalizedSql.includes('where entity_slug = $1')) {
      if (params[0] === 'ive' && params[2] === '2026-02-23' && params[3] === 'album') {
        return this.result<Row>([
          {
            release_id: IVE_RELEASE_ID,
            entity_slug: 'ive',
            normalized_release_title: 'revive',
            release_date: '2026-02-23',
            stream: 'album',
            payload: buildReleaseDetailPayload(IVE_RELEASE_ID),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      if (params[0] === 'blackpink' && params[3] === 'album') {
        return this.result<Row>([
          {
            release_id: BLACKPINK_DEADLINE_UNRESOLVED_RELEASE_ID,
            entity_slug: 'blackpink',
            normalized_release_title: 'deadline',
            release_date: '2026-02-26',
            stream: 'album',
            payload: buildBlackpinkDeadlinePayload(
              BLACKPINK_DEADLINE_UNRESOLVED_RELEASE_ID,
              '2026-02-26',
              'unresolved',
              'unresolved',
              'manual_override',
            ),
            generated_at: NOW,
          } as unknown as Row,
          {
            release_id: BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID,
            entity_slug: 'blackpink',
            normalized_release_title: 'deadline',
            release_date: '2026-02-27',
            stream: 'album',
            payload: buildBlackpinkDeadlinePayload(
              BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID,
              '2026-02-27',
              'verified',
              'verified',
              'canonical',
            ),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from release_detail_projection') && normalizedSql.includes('where release_id = $1::uuid')) {
      const releaseId = String(params[0] ?? '');
      if (releaseId === IVE_RELEASE_ID) {
        return this.result<Row>([
          {
            release_id: IVE_RELEASE_ID,
            entity_slug: 'ive',
            normalized_release_title: 'revive',
            release_date: '2026-02-23',
            stream: 'album',
            payload: buildReleaseDetailPayload(IVE_RELEASE_ID),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      if (releaseId === BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID) {
        return this.result<Row>([
          {
            release_id: BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID,
            entity_slug: 'blackpink',
            normalized_release_title: 'deadline',
            release_date: '2026-02-27',
            stream: 'album',
            payload: buildBlackpinkDeadlinePayload(
              BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID,
              '2026-02-27',
              'verified',
              'verified',
              'canonical',
            ),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      if (this.malformedReleaseIds.has(releaseId)) {
        return this.result<Row>([
          {
            release_id: releaseId,
            entity_slug: 'ive',
            normalized_release_title: 'revive',
            release_date: '2026-02-23',
            stream: 'album',
            payload: {
              release: {
                release_id: 'wrong-id',
              },
            },
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from release_detail_projection') && normalizedSql.includes('where release_id = any($1::uuid[])')) {
      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from calendar_month_projection')) {
      if (params[0] === '2026-03') {
        return this.result<Row>([
          {
            month_key: '2026-03',
            payload: buildCalendarMonthPayload(),
            generated_at: NOW,
          } as unknown as Row,
        ]);
      }

      return this.result<Row>([]);
    }

    if (normalizedSql.includes('from radar_projection')) {
      return this.result<Row>([
        {
          payload: buildRadarPayload(),
          generated_at: NOW,
        } as unknown as Row,
      ]);
    }

    if (normalizedSql.includes('from review_tasks rt') && normalizedSql.includes("rt.review_type = 'upcoming_signal'")) {
      return this.result<Row>([
        {
          review_task_id: UPCOMING_REVIEW_ID,
          review_type: 'upcoming_signal',
          status: 'open',
          review_reason: ['missing_source_link'],
          recommended_action: 'Verify official source link.',
          payload: { notes: 'needs manual review' },
          created_at: NOW,
          entity_id: ENTITY_ID,
          entity_slug: 'yena',
          display_name: 'YENA',
          entity_type: 'solo',
          upcoming_signal_id: UPCOMING_SIGNAL_ID,
          headline: '최예나, 3월 11일 컴백 확정',
          scheduled_date: '2026-03-11',
          scheduled_month: '2026-03',
          date_precision: 'exact',
          date_status: 'confirmed',
          release_format: 'ep',
          confidence_score: 0.84,
          tracking_status: 'watch_only',
          is_active: true,
          source_items: [
            {
              source_type: 'news_rss',
              source_url: 'https://starnews.example/yena-love-catcher',
              source_domain: 'starnews.example',
              published_at: NOW,
              search_term: '최예나 컴백',
              evidence_summary: 'Korean article confirmed the release date.',
            },
          ],
        } as unknown as Row,
      ]);
    }

    if (normalizedSql.includes('from review_tasks rt') && normalizedSql.includes("rt.review_type = 'mv_candidate'")) {
      return this.result<Row>([
        {
          review_task_id: MV_REVIEW_ID,
          review_type: 'mv_candidate',
          status: 'open',
          review_reason: ['needs_review'],
          recommended_action: 'Check official MV target.',
          payload: { candidate_count: 2 },
          created_at: NOW,
          entity_id: ENTITY_ID,
          entity_slug: 'yena',
          display_name: 'YENA',
          entity_type: 'solo',
          release_id: YENA_RELEASE_ID,
          release_title: 'LOVE CATCHER',
          release_date: '2026-03-11',
          stream: 'album',
          release_kind: 'ep',
          release_format: 'ep',
          youtube_mv_url: null,
          youtube_mv_status: 'needs_review',
          youtube_mv_provenance: null,
          channel_items: [
            {
              canonical_channel_url: 'https://www.youtube.com/@YENA_OFFICIAL',
              channel_label: 'YENA',
              owner_type: 'team',
              display_in_team_links: true,
              allow_mv_uploads: true,
              provenance: 'artistProfiles.official_youtube_url',
              channel_role: 'both',
            },
          ],
        } as unknown as Row,
      ]);
    }

    if (normalizedSql.includes('from entities e') && normalizedSql.includes('left join entity_youtube_channels')) {
      return this.result<Row>([]);
    }

    throw new Error(`Unhandled SQL in fake DB: ${normalizedSql}`);
  }

  async end(): Promise<void> {}

  private result<Row>(rows: Row[]): QueryResult<Row> {
    return {
      rows,
      rowCount: rows.length,
    };
  }
}

function buildReadyStatusSnapshot(status: ReadyStatusSnapshot['status']): ReadyStatusSnapshot {
  return {
    status,
    reasons:
      status === 'ready'
        ? []
        : status === 'degraded'
          ? ['parity_report_unclean']
          : ['projection_freshness_not_ready'],
    projections: {
      status: status === 'not_ready' ? 'not_ready' : status === 'degraded' ? 'degraded' : 'healthy',
      generated_at: NOW,
      summary_lines: [],
      lag_minutes: status === 'ready' ? 5 : status === 'degraded' ? 30 : 90,
      thresholds: {
        pass_lag_minutes: 20,
        degraded_lag_minutes: 60,
      },
      row_counts: {
        entity_search_documents: 117,
        calendar_month_projection: 216,
        entity_detail_projection: 117,
        release_detail_projection: 1771,
        radar_projection: 1,
      },
    },
    dependencies: {
      parity_report: {
        status: status === 'ready' ? 'healthy' : 'degraded',
        generated_at: NOW,
        summary_lines: status === 'ready' ? ['parity clean'] : ['parity drift'],
        clean: status === 'ready',
      },
      shadow_report: {
        status: status === 'ready' ? 'healthy' : 'degraded',
        generated_at: NOW,
        summary_lines: status === 'ready' ? ['shadow clean'] : ['shadow drift'],
        clean: status === 'ready',
      },
      runtime_gate_report: {
        status: status === 'ready' ? 'healthy' : 'degraded',
        generated_at: NOW,
        summary_lines: status === 'ready' ? ['gate pass'] : ['gate degraded'],
        stage_gates: {
          shadow_to_web_cutover: status === 'ready' ? 'pass' : 'fail',
          web_cutover_to_json_demotion: status === 'ready' ? 'pass' : 'fail',
        },
      },
    },
  };
}

function createTestApp(t: TestContext, options: TestAppOptions = {}) {
  const db = new FakeDb(options) as unknown as DbPool;
  const app = buildApp({
    config: TEST_CONFIG,
    db,
    readyStatusProvider: async () => options.readyStatusSnapshot ?? buildReadyStatusSnapshot('ready'),
  });

  t.after(async () => {
    await app.close();
  });

  return app;
}

function parseJson(response: { body: string }) {
  return JSON.parse(response.body) as Record<string, any>;
}

function assertReadMeta(meta: Record<string, any>, expectedRoute: string) {
  assert.equal(meta.timezone, TEST_CONFIG.appTimezone);
  assert.equal(meta.route, expectedRoute);
  assert.equal(meta.source, 'backend');
  assert.equal(typeof meta.request_id, 'string');
  assert.equal(typeof meta.generated_at, 'string');
}

function assertErrorEnvelope(body: Record<string, any>, code: string, route: string) {
  assert.equal(body.error.code, code);
  assert.equal(body.meta.route, route);
  assert.equal(body.meta.timezone, TEST_CONFIG.appTimezone);
  assert.equal(typeof body.meta.request_id, 'string');
}

test('caller-provided x-request-id is echoed in success envelope and response headers', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
    headers: {
      'x-request-id': CALLER_REQUEST_ID,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-request-id'], CALLER_REQUEST_ID);
  const body = parseJson(response);
  assert.equal(body.meta.request_id, CALLER_REQUEST_ID);
});

test('GET /health returns plain health status', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'idol-song-app-backend');
  assert.equal(typeof body.now, 'string');
});

test('GET /ready returns ready status and database mode', async (t) => {
  const app = createTestApp(t, {
    readyStatusSnapshot: buildReadyStatusSnapshot('ready'),
  });
  const response = await app.inject({
    method: 'GET',
    url: '/ready',
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(body.status, 'ready');
  assert.equal(body.database.mode, TEST_CONFIG.databaseMode);
  assert.equal(body.database.status, 'ready');
  assert.equal(body.projections.status, 'healthy');
  assert.equal(body.dependencies.parity_report.status, 'healthy');
  assert.equal(body.dependencies.runtime_gate_report.stage_gates.shadow_to_web_cutover, 'pass');
  assert.deepEqual(body.reasons, []);
  assert.equal(body.timezone, TEST_CONFIG.appTimezone);
});

test('GET /ready returns degraded status when projection or dependency health is degraded', async (t) => {
  const app = createTestApp(t, {
    readyStatusSnapshot: buildReadyStatusSnapshot('degraded'),
  });
  const response = await app.inject({
    method: 'GET',
    url: '/ready',
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assert.equal(body.status, 'degraded');
  assert.equal(body.database.status, 'ready');
  assert.equal(body.projections.status, 'degraded');
  assert.equal(body.dependencies.parity_report.status, 'degraded');
  assert.equal(body.dependencies.runtime_gate_report.stage_gates.shadow_to_web_cutover, 'fail');
  assert.ok(body.reasons.includes('parity_report_unclean'));
});

test('GET /ready returns 503 not_ready when database is unreachable', async (t) => {
  const app = createTestApp(t, {
    pingFails: true,
    readyStatusSnapshot: buildReadyStatusSnapshot('ready'),
  });
  const response = await app.inject({
    method: 'GET',
    url: '/ready',
  });

  assert.equal(response.statusCode, 503);
  const body = parseJson(response);
  assert.equal(body.status, 'not_ready');
  assert.equal(body.database.status, 'not_ready');
  assert.ok(body.reasons.includes('database_unreachable'));
});

test('GET /v1/search returns envelope with entity, release, and upcoming matches', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/search');
  assert.equal(body.data.entities[0].entity_slug, 'yena');
  assert.equal(body.data.entities[0].canonical_path, '/artists/yena');
  assert.equal(body.data.entities[0].match_reason, 'alias_exact');
  assert.equal(body.data.entities[0].next_upcoming, null);
  assert.equal(body.data.releases[0].release_id, YENA_RELEASE_ID);
  assert.equal(body.data.releases[0].detail_path, '/artists/yena/releases/22222222-2222-4222-8222-222222222222');
  assert.equal(body.data.releases[0].entity_path, '/artists/yena');
  assert.equal(body.data.releases[0].match_reason, 'entity_exact_latest_release');
  assert.equal(body.data.upcoming.length, 0);
});

test('GET /v1/search includes owner entity for exact release-title queries without client patching', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: 'REVIVE+',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/search');
  assert.equal(body.data.entities[0].entity_slug, 'ive');
  assert.equal(body.data.entities[0].canonical_path, '/artists/ive');
  assert.equal(body.data.entities[0].match_reason, 'partial');
  assert.equal(body.data.entities[0].matched_alias, null);
  assert.equal(body.data.releases[0].release_id, IVE_RELEASE_ID);
  assert.equal(body.data.releases[0].detail_path, '/artists/ive/releases/33333333-3333-4333-8333-333333333333');
  assert.equal(body.data.releases[0].match_reason, 'release_title_exact');
});

test('GET /v1/search includes direct-render fields for upcoming matches', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '컴백',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/search');
  assert.equal(body.data.upcoming[0].entity_slug, 'kickflip');
  assert.equal(body.data.upcoming[0].entity_path, '/artists/kickflip');
  assert.equal(body.data.upcoming[0].source_domain, 'weverse.io');
});

test('public read endpoints return deterministic 429 envelopes when rate limited', async (t) => {
  const app = buildApp({
    config: {
      ...TEST_CONFIG,
      readRateLimits: {
        ...TEST_CONFIG.readRateLimits,
        search: {
          max: 2,
          windowMs: 60_000,
        },
      },
    },
    db: new FakeDb() as unknown as DbPool,
  });

  t.after(async () => {
    await app.close();
  });

  const first = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
    headers: {
      'x-forwarded-for': '203.0.113.42',
    },
  });
  const second = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
    headers: {
      'x-forwarded-for': '203.0.113.42',
    },
  });
  const third = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
    headers: {
      'x-forwarded-for': '203.0.113.42',
    },
  });
  const otherClient = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
    headers: {
      'x-forwarded-for': '203.0.113.99',
    },
  });

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['ratelimit-limit'], '2');
  assert.equal(first.headers['ratelimit-remaining'], '1');
  assert.equal(first.headers['x-ratelimit-bucket'], 'search');

  assert.equal(second.statusCode, 200);
  assert.equal(second.headers['ratelimit-remaining'], '0');

  assert.equal(third.statusCode, 429);
  assert.equal(third.headers['ratelimit-limit'], '2');
  assert.equal(third.headers['ratelimit-remaining'], '0');
  assert.equal(third.headers['x-ratelimit-bucket'], 'search');
  assert.ok(Number(third.headers['retry-after']) >= 1);

  const thirdBody = parseJson(third);
  assert.equal(thirdBody.error.code, 'rate_limited');
  assert.equal(thirdBody.meta.rate_limit_bucket, 'search');
  assert.equal(thirdBody.meta.rate_limit_limit, 2);
  assert.equal(thirdBody.meta.rate_limit_identifier_kind, 'ip');
  assert.ok(typeof thirdBody.meta.rate_limit_reset_at === 'string');

  assert.equal(otherClient.statusCode, 200);
  assert.equal(otherClient.headers['ratelimit-remaining'], '1');
});

test('GET /v1/entities/:slug returns entity detail projection payload', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/entities/yena',
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/entities/:slug');
  assert.equal(body.data.identity.entity_slug, 'yena');
  assert.equal(body.data.official_links.youtube, 'https://www.youtube.com/@YENA_OFFICIAL');
  assert.equal(body.data.next_upcoming, null);
  assert.equal(body.data.latest_release.release_format, 'ep');
  assert.equal(body.data.latest_release.representative_song_title, 'LOVE CATCHER');
  assert.equal(body.data.latest_release.spotify_url, 'https://open.spotify.com/album/love-catcher');
  assert.equal(body.data.latest_release.youtube_music_url, 'https://music.youtube.com/playlist?list=PLLOVECATCHER');
  assert.equal(body.data.latest_release.youtube_mv_url, null);
  assert.equal(body.data.latest_release.artwork.cover_image_url, 'https://cdn.example.com/love-catcher-cover.jpg');
  assert.equal(body.data.recent_albums.length, 1);
  assert.equal(body.data.recent_albums[0].release_format, 'ep');
  assert.equal(body.data.recent_albums[0].representative_song_title, 'LOVE CATCHER');
  assert.equal(body.data.recent_albums[0].spotify_url, 'https://open.spotify.com/album/love-catcher');
  assert.equal(body.data.recent_albums[0].youtube_music_url, 'https://music.youtube.com/playlist?list=PLLOVECATCHER');
  assert.equal(body.data.recent_albums[0].artwork.thumbnail_image_url, 'https://cdn.example.com/love-catcher-thumb.jpg');
  assert.equal(body.data.source_timeline[0].event_type, 'official_announcement');
  assert.equal(body.data.source_timeline[0].summary, 'ep · confirmed · 2026-03-11');
});

test('GET /v1/releases/lookup resolves legacy key to release id', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/releases/lookup',
    query: {
      entity_slug: 'IVE',
      title: 'REVIVE+',
      date: '2026-02-23',
      stream: 'album',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/releases/lookup');
  assert.equal(body.data.release_id, IVE_RELEASE_ID);
  assert.equal(body.data.canonical_path, `/v1/releases/${IVE_RELEASE_ID}`);
  assert.equal(body.data.release.release_title, 'REVIVE+');
});

test('GET /v1/releases/lookup prefers adjacent verified candidate over sparse exact duplicate', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/releases/lookup',
    query: {
      entity_slug: 'BLACKPINK',
      title: 'DEADLINE',
      date: '2026-02-26',
      stream: 'album',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/releases/lookup');
  assert.equal(body.data.release_id, BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID);
  assert.equal(body.data.canonical_path, `/v1/releases/${BLACKPINK_DEADLINE_VERIFIED_RELEASE_ID}`);
  assert.equal(body.data.release.release_date, '2026-02-27');
  assert.equal(body.data.release.release_title, 'DEADLINE');
});

test('GET /v1/releases/:id returns release detail payload with title tracks', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: `/v1/releases/${IVE_RELEASE_ID}`,
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/releases/:id');
  assert.equal(body.data.release.release_id, IVE_RELEASE_ID);
  assert.equal(body.data.detail_metadata.status, 'verified');
  assert.equal(body.data.detail_metadata.provenance, 'releaseDetails.existing_row');
  assert.equal(body.data.title_track_metadata.status, 'manual_override');
  assert.equal(body.data.title_track_metadata.provenance, 'release_detail_overrides.title_tracks');
  assert.equal(body.data.tracks.length, 2);
  assert.equal(body.data.tracks.filter((track: { is_title_track: boolean }) => track.is_title_track).length, 2);
  assert.equal(body.data.service_links.youtube_music.status, 'manual_override');
});

test('GET /v1/calendar/month returns calendar projection contract', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/calendar/month',
    query: {
      month: '2026-03',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/calendar/month');
  assert.equal(body.data.summary.exact_upcoming_count, 0);
  assert.equal(body.data.days[0].exact_upcoming.length, 0);
  assert.equal(body.data.scheduled_list.length, 0);
  assert.equal(body.data.nearest_upcoming, null);
  assert.equal(body.data.verified_list[0].release_id, YENA_RELEASE_ID);
  assert.equal(body.data.verified_list[0].entity_type, 'solo');
  assert.equal(body.data.verified_list[0].agency_name, 'YUE HUA Entertainment');
  assert.equal(body.data.verified_list[0].artist_source_url, 'https://www.youtube.com/@YENA_OFFICIAL');
  assert.equal(body.data.month_only_upcoming[0].date_precision, 'month_only');
  assert.equal(body.data.month_only_upcoming[0].tracking_status, 'watch_only');
  assert.equal(body.data.month_only_upcoming[0].agency_name, 'JYP Entertainment');
});

test('GET /v1/radar returns projection-backed radar payload', async (t) => {
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/v1/radar',
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assertReadMeta(body.meta, '/v1/radar');
  assert.equal(body.data.featured_upcoming, null);
  assert.equal(body.data.weekly_upcoming.length, 0);
  assert.equal(body.data.rookie.length, 1);
  assert.equal(body.data.long_gap[0].agency_name, 'NV Entertainment');
  assert.equal(body.data.long_gap[0].latest_release.artist_source_url, 'https://www.youtube.com/@wooah');
  assert.equal(body.data.long_gap[0].latest_release.stream, 'album');
  assert.equal(body.data.rookie[0].tracking_status, 'watch_only');
  assert.equal(body.data.rookie[0].latest_signal.scheduled_month, '2026-04');
  assert.equal(body.data.rookie[0].latest_signal.release_format, null);
  assert.equal(body.data.rookie[0].latest_signal.source_domain, 'example.com');
  assert.equal(typeof body.data.change_feed[0].occurred_at, 'string');
});

test('review routes return no-store payloads for upcoming and mv tasks', async (t) => {
  const app = createTestApp(t);

  const upcomingResponse = await app.inject({
    method: 'GET',
    url: '/v1/review/upcoming',
  });

  assert.equal(upcomingResponse.statusCode, 200);
  assert.equal(upcomingResponse.headers['cache-control'], 'no-store');
  const upcomingBody = parseJson(upcomingResponse);
  assertReadMeta(upcomingBody.meta, '/v1/review/upcoming');
  assert.equal(upcomingBody.data.items[0].review_task.review_task_id, UPCOMING_REVIEW_ID);
  assert.equal(upcomingBody.data.items[0].upcoming_signal.upcoming_signal_id, UPCOMING_SIGNAL_ID);

  const mvResponse = await app.inject({
    method: 'GET',
    url: '/v1/review/mv',
  });

  assert.equal(mvResponse.statusCode, 200);
  assert.equal(mvResponse.headers['cache-control'], 'no-store');
  const mvBody = parseJson(mvResponse);
  assertReadMeta(mvBody.meta, '/v1/review/mv');
  assert.equal(mvBody.data.items[0].review_task.review_task_id, MV_REVIEW_ID);
  assert.equal(mvBody.data.items[0].allowlist.official_youtube_url, 'https://www.youtube.com/@YENA_OFFICIAL');
});

test('error envelopes cover invalid request, not found, and stale projection cases', async (t) => {
  const standardApp = createTestApp(t);

  const invalidSearch = await standardApp.inject({
    method: 'GET',
    url: '/v1/search',
  });
  assert.equal(invalidSearch.statusCode, 400);
  assertErrorEnvelope(parseJson(invalidSearch), 'invalid_request', '/v1/search');

  const missingEntity = await standardApp.inject({
    method: 'GET',
    url: '/v1/entities/no-such-entity',
  });
  assert.equal(missingEntity.statusCode, 404);
  assertErrorEnvelope(parseJson(missingEntity), 'not_found', '/v1/entities/:slug');

  const invalidReleaseId = await standardApp.inject({
    method: 'GET',
    url: '/v1/releases/not-a-uuid',
    headers: {
      'x-request-id': CALLER_REQUEST_ID,
    },
  });
  assert.equal(invalidReleaseId.statusCode, 400);
  assert.equal(invalidReleaseId.headers['x-request-id'], CALLER_REQUEST_ID);
  const invalidReleaseIdBody = parseJson(invalidReleaseId);
  assertErrorEnvelope(invalidReleaseIdBody, 'invalid_request', '/v1/releases/:id');
  assert.equal(invalidReleaseIdBody.meta.request_id, CALLER_REQUEST_ID);

  const invalidCalendarMonth = await standardApp.inject({
    method: 'GET',
    url: '/v1/calendar/month',
    query: {
      month: '2026-3',
    },
  });
  assert.equal(invalidCalendarMonth.statusCode, 400);
  assertErrorEnvelope(parseJson(invalidCalendarMonth), 'invalid_request', '/v1/calendar/month');

  const malformedApp = createTestApp(t, {
    malformedReleaseIds: [MALFORMED_RELEASE_ID],
  });
  const staleProjection = await malformedApp.inject({
    method: 'GET',
    url: `/v1/releases/${MALFORMED_RELEASE_ID}`,
  });
  assert.equal(staleProjection.statusCode, 500);
  assertErrorEnvelope(parseJson(staleProjection), 'stale_projection', '/v1/releases/:id');
});

test('database timeout is classified as a timeout error envelope', async (t) => {
  const app = createTestApp(t, {
    timeoutEntitySearch: true,
  });

  const response = await app.inject({
    method: 'GET',
    url: '/v1/search',
    query: {
      q: '최예나',
    },
  });

  assert.equal(response.statusCode, 504);
  const body = parseJson(response);
  assertErrorEnvelope(body, 'timeout', '/v1/search');
});
