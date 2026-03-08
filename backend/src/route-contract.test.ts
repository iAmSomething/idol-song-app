import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import type { DbPool } from './lib/db.js';

const NOW = '2026-03-08T06:00:00.000Z';
const ENTITY_ID = '11111111-1111-4111-8111-111111111111';
const YENA_RELEASE_ID = '22222222-2222-4222-8222-222222222222';
const IVE_RELEASE_ID = '33333333-3333-4333-8333-333333333333';
const MALFORMED_RELEASE_ID = '44444444-4444-4444-8444-444444444444';
const UPCOMING_SIGNAL_ID = '55555555-5555-4555-8555-555555555555';
const UPCOMING_REVIEW_ID = '66666666-6666-4666-8666-666666666666';
const MV_REVIEW_ID = '77777777-7777-4777-8777-777777777777';

const TEST_CONFIG: AppConfig = {
  appEnv: 'development',
  port: 3000,
  appTimezone: 'Asia/Seoul',
  databaseUrl: 'postgresql://test:test@localhost/test',
  databaseMode: 'pooled',
  databaseConnectionTimeoutMs: 3_000,
  databaseReadTimeoutMs: 5_000,
  allowedWebOrigins: ['https://iamsomething.github.io'],
};

type QueryResult<Row> = {
  rows: Row[];
  rowCount: number;
};

type FakeDbOptions = {
  malformedReleaseIds?: string[];
  timeoutEntitySearch?: boolean;
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
      date_precision: 'exact',
      date_status: 'confirmed',
      confidence_score: 0.84,
    },
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
      release_title: 'Hate Rodrigo',
      release_date: '2025-06-29',
      stream: 'song',
      release_kind: 'single',
      release_format: 'single',
      artwork: {
        cover_image_url: 'https://cdn.example.com/hate-rodrigo-cover.jpg',
        thumbnail_image_url: 'https://cdn.example.com/hate-rodrigo-thumb.jpg',
        artwork_source_type: 'releaseArtwork.cover_image_url',
        artwork_source_url: 'https://artwork.example.com/hate-rodrigo',
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
            release_title: 'LOVE CATCHER',
            stream: 'album',
            release_kind: 'ep',
            release_date: '2026-03-11',
          },
        ],
        exact_upcoming: [
          {
            upcoming_signal_id: UPCOMING_SIGNAL_ID,
            entity_slug: 'yena',
            display_name: 'YENA',
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
        release_title: 'LOVE CATCHER',
        stream: 'album',
        release_kind: 'ep',
        release_date: '2026-03-11',
      },
    ],
    scheduled_list: [
      {
        upcoming_signal_id: UPCOMING_SIGNAL_ID,
        entity_slug: 'yena',
        display_name: 'YENA',
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
      entity_slug: 'yena',
      display_name: 'YENA',
      scheduled_date: '2026-03-11',
      date_precision: 'exact',
      date_status: 'confirmed',
    },
    weekly_upcoming: [{ entity_slug: 'yena' }],
    change_feed: [{ kind: 'verified_release', entity_slug: 'ive' }],
    long_gap: [{ entity_slug: 'woo-ah', gap_days: 600 }],
    rookie: [{ entity_slug: 'atheart', debut_year: 2025 }],
  };
}

class FakeDb {
  private readonly malformedReleaseIds: Set<string>;
  private readonly timeoutEntitySearch: boolean;

  constructor(options: FakeDbOptions = {}) {
    this.malformedReleaseIds = new Set(options.malformedReleaseIds ?? []);
    this.timeoutEntitySearch = options.timeoutEntitySearch === true;
  }

  async query<Row extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<Row>> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql === 'select 1') {
      return this.result<Row>([{ '?column?': 1 } as unknown as Row]);
    }

    if (normalizedSql.includes('from entity_search_documents')) {
      if (this.timeoutEntitySearch) {
        const error = new Error('canceling statement due to statement timeout') as Error & { code?: string };
        error.code = '57014';
        throw error;
      }

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

    if (normalizedSql.includes('from releases r') && normalizedSql.includes('projection_normalize_text(r.release_title)')) {
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
      return this.result<Row>([]);
    }

    if (normalizedSql.includes('distinct on (us.entity_id)')) {
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

function createTestApp(t: TestContext, options: FakeDbOptions = {}) {
  const db = new FakeDb(options) as unknown as DbPool;
  const app = buildApp({
    config: TEST_CONFIG,
    db,
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
  const app = createTestApp(t);
  const response = await app.inject({
    method: 'GET',
    url: '/ready',
  });

  assert.equal(response.statusCode, 200);
  const body = parseJson(response);
  assert.equal(body.status, 'ready');
  assert.equal(body.database.mode, TEST_CONFIG.databaseMode);
  assert.equal(body.timezone, TEST_CONFIG.appTimezone);
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
  assert.equal(body.data.entities[0].match_reason, 'alias_exact');
  assert.equal(body.data.releases[0].release_id, YENA_RELEASE_ID);
  assert.equal(body.data.releases[0].match_reason, 'entity_exact_latest_release');
  assert.equal(body.data.upcoming[0].upcoming_signal_id, UPCOMING_SIGNAL_ID);
  assert.equal(body.data.upcoming[0].match_reason, 'entity_exact');
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
  assert.equal(body.data.next_upcoming.upcoming_signal_id, UPCOMING_SIGNAL_ID);
  assert.equal(body.data.next_upcoming.source_url, 'https://starnews.example/yena-love-catcher');
  assert.equal(body.data.next_upcoming.source_count, 2);
  assert.equal(body.data.latest_release.release_format, 'single');
  assert.equal(body.data.latest_release.artwork.cover_image_url, 'https://cdn.example.com/hate-rodrigo-cover.jpg');
  assert.equal(body.data.recent_albums.length, 1);
  assert.equal(body.data.recent_albums[0].release_format, 'ep');
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
  assert.equal(body.data.summary.exact_upcoming_count, 1);
  assert.equal(body.data.days[0].exact_upcoming[0].date_precision, 'exact');
  assert.equal(body.data.month_only_upcoming[0].date_precision, 'month_only');
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
  assert.equal(body.data.featured_upcoming.entity_slug, 'yena');
  assert.equal(body.data.weekly_upcoming.length, 1);
  assert.equal(body.data.rookie.length, 1);
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
  });
  assert.equal(invalidReleaseId.statusCode, 400);
  assertErrorEnvelope(parseJson(invalidReleaseId), 'invalid_request', '/v1/releases/:id');

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
