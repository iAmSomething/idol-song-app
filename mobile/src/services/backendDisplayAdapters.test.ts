import type {
  BackendCalendarMonthData,
  BackendEntityDetailData,
  BackendReleaseDetailData,
  BackendSearchData,
} from './backendReadClient';
import {
  adaptBackendCalendarMonth,
  adaptBackendEntityDetail,
  adaptBackendReleaseDetail,
  adaptBackendSearchResults,
} from './backendDisplayAdapters';

describe('backend display adapter parity', () => {
  test('separates exact and month-only upcoming rows for calendar month responses', () => {
    const data: BackendCalendarMonthData = {
      summary: {
        verified_count: 0,
        exact_upcoming_count: 1,
        month_only_upcoming_count: 1,
      },
      nearest_upcoming: {
        upcoming_signal_id: 'upcoming-yena',
        entity_slug: 'yena',
        display_name: 'YENA',
        headline: 'YENA confirms a March 11 comeback',
        scheduled_date: '2026-03-11',
        scheduled_month: '2026-03',
        date_precision: 'exact',
        date_status: 'confirmed',
        source_type: 'news_rss',
      },
      days: [],
      month_only_upcoming: [
        {
          upcoming_signal_id: 'upcoming-le-sserafim',
          entity_slug: 'le-sserafim',
          display_name: 'LE SSERAFIM',
          headline: 'LE SSERAFIM is rumored to return later this month',
          scheduled_month: '2026-03',
          date_precision: 'month_only',
          date_status: 'rumor',
          source_type: 'news_rss',
        },
      ],
      verified_list: [],
      scheduled_list: [
        {
          upcoming_signal_id: 'upcoming-yena',
          entity_slug: 'yena',
          display_name: 'YENA',
          headline: 'YENA confirms a March 11 comeback',
          scheduled_date: '2026-03-11',
          scheduled_month: '2026-03',
          date_precision: 'exact',
          date_status: 'confirmed',
          source_type: 'news_rss',
        },
        {
          upcoming_signal_id: 'upcoming-le-sserafim',
          entity_slug: 'le-sserafim',
          display_name: 'LE SSERAFIM',
          headline: 'LE SSERAFIM is rumored to return later this month',
          scheduled_month: '2026-03',
          date_precision: 'month_only',
          date_status: 'rumor',
          source_type: 'news_rss',
        },
      ],
    };

    const snapshot = adaptBackendCalendarMonth('2026-03', data);

    expect(snapshot.month).toBe('2026-03');
    expect(snapshot.exactUpcoming).toHaveLength(1);
    expect(snapshot.monthOnlyUpcoming).toHaveLength(1);
    expect(snapshot.exactUpcoming[0]?.datePrecision).toBe('exact');
    expect(snapshot.monthOnlyUpcoming[0]?.datePrecision).toBe('month_only');
    expect(snapshot.nearestUpcoming?.displayGroup).toBe('YENA');
  });

  test('maps backend search segments into display models with explicit match kinds', () => {
    const data: BackendSearchData = {
      query: '최예나',
      entities: [
        {
          entity_slug: 'yena',
          display_name: 'YENA',
          canonical_name: 'YENA',
          entity_type: 'solo',
          aliases: ['최예나'],
          latest_release: {
            release_id: 'release-yena',
            release_title: 'LOVE CATCHER',
            release_date: '2026-03-11',
            stream: 'album',
            release_kind: 'ep',
          },
          match_reason: 'alias_exact',
        },
      ],
      releases: [
        {
          release_id: 'release-yena',
          entity_slug: 'yena',
          display_name: 'YENA',
          release_title: 'LOVE CATCHER',
          release_date: '2026-03-11',
          stream: 'album',
          release_kind: 'ep',
          match_reason: 'release_title_exact',
        },
      ],
      upcoming: [
        {
          upcoming_signal_id: 'upcoming-yena',
          entity_slug: 'yena',
          display_name: 'YENA',
          headline: 'YENA confirms a March 11 comeback',
          scheduled_date: '2026-03-11',
          scheduled_month: '2026-03',
          date_precision: 'exact',
          date_status: 'confirmed',
          release_format: 'LOVE CATCHER',
          source_type: 'news_rss',
          source_url: 'https://example.com/yena-news',
          match_reason: 'entity_exact',
        },
      ],
    };

    const results = adaptBackendSearchResults('최예나', data);

    expect(results.query).toBe('최예나');
    expect(results.entities[0]?.team.displayName).toBe('YENA');
    expect(results.entities[0]?.matchKind).toBe('alias_exact');
    expect(results.releases[0]?.matchKind).toBe('release_title_exact');
    expect(results.upcoming[0]?.matchKind).toBe('entity_exact');
    expect(results.upcoming[0]?.upcoming.sourceUrl).toBe('https://example.com/yena-news');
  });

  test('keeps missing official/source links undefined for sparse entity detail payloads', () => {
    const data: BackendEntityDetailData = {
      identity: {
        entity_slug: 'allday-project',
        display_name: 'ALLDAY PROJECT',
        canonical_name: 'ALLDAY PROJECT',
        entity_type: 'project',
      },
      official_links: {
        youtube: null,
        x: null,
        instagram: null,
      },
      youtube_channels: {
        mv_allowlist_urls: [],
      },
      tracking_state: {},
      next_upcoming: null,
      latest_release: null,
      recent_albums: [],
      source_timeline: [
        {
          event_type: 'upcoming_signal',
          headline: 'Sparse source timeline row',
          summary: 'No explicit source URL yet',
          source_url: null,
        },
      ],
      artist_source_url: null,
    };

    const snapshot = adaptBackendEntityDetail(data);

    expect(snapshot.team.actType).toBe('project');
    expect(snapshot.team.officialYoutubeUrl).toBeUndefined();
    expect(snapshot.team.officialXUrl).toBeUndefined();
    expect(snapshot.team.officialInstagramUrl).toBeUndefined();
    expect(snapshot.team.badge?.monogram).toBe('AP');
    expect(snapshot.team.artistSourceUrl).toBeUndefined();
    expect(snapshot.sourceTimeline[0]?.sourceUrl).toBeUndefined();
  });

  test('keeps release detail service links and MV state explicit without fake fallback values', () => {
    const data: BackendReleaseDetailData = {
      release: {
        release_id: 'release-atheart',
        entity_slug: 'atheart',
        display_name: 'AtHeart',
        release_title: 'Glow Up',
        release_date: '2025-11-18',
        stream: 'song',
        release_kind: 'single',
      },
      artwork: null,
      service_links: {
        spotify: {
          url: null,
        },
        youtube_music: {
          url: null,
        },
      },
      tracks: [
        {
          track_id: 'track-glow-up',
          order: 1,
          title: 'Glow Up',
          is_title_track: true,
          spotify: null,
          youtube_music: null,
        },
      ],
      mv: {
        status: 'unresolved',
        url: null,
        video_id: null,
      },
      notes: {
        summary: 'Backend detail remains sparse.',
      },
    };

    const detail = adaptBackendReleaseDetail(data);

    expect(detail.spotifyUrl).toBeUndefined();
    expect(detail.youtubeMusicUrl).toBeUndefined();
    expect(detail.youtubeVideoId).toBeUndefined();
    expect(detail.youtubeVideoUrl).toBeUndefined();
    expect(detail.youtubeVideoStatus).toBe('unresolved');
    expect(detail.notes).toBe('Backend detail remains sparse.');
    expect(detail.tracks[0]?.isTitleTrack).toBe(true);
    expect(detail.tracks[0]?.spotifyUrl).toBeUndefined();
  });
});
