import type { MobileRawDataset } from '../types';

import {
  selectCalendarMonthSnapshot,
  createSelectorContext,
  selectEntityDetailSnapshot,
  selectLatestReleaseSummaryBySlug,
  selectMonthReleaseSummaries,
  selectRadarSnapshot,
  selectSearchResults,
  selectMonthUpcomingEvents,
  selectRecentReleaseSummariesBySlug,
  selectReleaseDetailById,
  selectTeamSummaryBySlug,
  selectUpcomingEventsBySlug,
} from './index';
import { buildReleaseId } from './normalize';

const dataset: MobileRawDataset = {
  artistProfiles: [
    {
      slug: 'yena',
      group: 'YENA',
      display_name: 'YENA',
      aliases: ['최예나'],
      search_aliases: ['예나'],
      agency: 'YUE HUA Entertainment',
      official_youtube_url: 'https://www.youtube.com/@YENA_OFFICIAL',
      official_x_url: 'https://x.com/YENA_OFFICIAL',
      official_instagram_url: 'https://www.instagram.com/yena.official/',
      representative_image_url: null,
      artist_source_url: 'https://musicbrainz.org/artist/example-yena',
    },
    {
      slug: 'blackpink',
      group: 'BLACKPINK',
      display_name: 'BLACKPINK',
      aliases: ['블랙핑크'],
      search_aliases: ['블핑'],
      agency: 'YG Entertainment',
      official_youtube_url: 'https://www.youtube.com/@BLACKPINK',
      representative_image_url: 'https://example.com/blackpink.jpg',
    },
    {
      slug: 'weeekly',
      group: 'Weeekly',
      display_name: 'Weeekly',
      aliases: ['위클리'],
      search_aliases: ['위클리'],
      agency: 'IST Entertainment',
      official_youtube_url: 'https://www.youtube.com/@Weeekly',
      artist_source_url: 'https://musicbrainz.org/artist/example-weeekly',
    },
    {
      slug: 'atheart',
      group: 'AtHeart',
      display_name: 'AtHeart',
      aliases: ['앳하트'],
      search_aliases: ['앳하트'],
      agency: 'Titan Content',
      official_youtube_url: 'https://www.youtube.com/@AtHeartOfficial',
      artist_source_url: 'https://musicbrainz.org/artist/example-atheart',
    },
  ],
  releases: [
    {
      group: 'YENA',
      latest_song: {
        title: 'Drama Queen',
        date: '2026-03-11',
        source: 'https://musicbrainz.org/release-group/drama-queen',
        release_kind: 'single',
        context_tags: [],
      },
      latest_album: {
        title: 'LOVE CATCHER',
        date: '2026-03-11',
        source: 'https://musicbrainz.org/release-group/love-catcher',
        release_kind: 'ep',
        context_tags: [],
      },
    },
    {
      group: 'Weeekly',
      latest_song: {
        title: 'Lights On',
        date: '2024-01-15',
        source: 'https://musicbrainz.org/release-group/lights-on',
        release_kind: 'single',
        context_tags: ['title_track'],
      },
    },
    {
      group: 'AtHeart',
      latest_song: {
        title: 'Glow Up',
        date: '2025-11-18',
        source: 'https://musicbrainz.org/release-group/glow-up',
        release_kind: 'single',
        context_tags: ['title_track'],
      },
    },
  ],
  upcomingCandidates: [
    {
      group: 'YENA',
      scheduled_date: '2026-03-11',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      headline: "최예나, 3월 11일 컴백 확정",
      release_label: 'LOVE CATCHER',
      source_type: 'news_rss',
      source_url: 'https://example.com/yena-news',
      confidence: 0.84,
    },
    {
      group: 'YENA',
      scheduled_month: '2026-03',
      date_precision: 'month_only',
      date_status: 'scheduled',
      headline: 'YENA spring follow-up rumored',
      source_type: 'official_social',
      source_url: 'https://example.com/yena-social',
      confidence: 0.41,
    },
    {
      group: 'AtHeart',
      scheduled_month: '2026-04',
      date_precision: 'month_only',
      date_status: 'scheduled',
      headline: 'AtHeart schedules an April follow-up',
      release_label: 'Spring chapter',
      source_type: 'official_social',
      source_url: 'https://example.com/atheart-social',
      confidence: 0.62,
    },
  ],
  releaseArtwork: [
    {
      group: 'YENA',
      release_title: 'LOVE CATCHER',
      release_date: '2026-03-11',
      stream: 'album',
      cover_image_url: 'https://example.com/love-catcher.jpg',
    },
    {
      group: 'Weeekly',
      release_title: 'Lights On',
      release_date: '2024-01-15',
      stream: 'song',
      cover_image_url: 'https://example.com/lights-on.jpg',
    },
    {
      group: 'AtHeart',
      release_title: 'Glow Up',
      release_date: '2025-11-18',
      stream: 'song',
      cover_image_url: 'https://example.com/glow-up.jpg',
    },
  ],
  releaseDetails: [
    {
      group: 'YENA',
      release_title: 'LOVE CATCHER',
      release_date: '2026-03-11',
      stream: 'album',
      release_kind: 'ep',
      spotify_url: 'https://open.spotify.com/album/love-catcher',
      youtube_music_url: 'https://music.youtube.com/playlist?list=love-catcher',
      youtube_video_status: 'manual_override',
      notes: 'Representative EP detail.',
      tracks: [
        {
          order: 1,
          title: 'Drama Queen',
          is_title_track: true,
        },
        {
          order: 2,
          title: 'Love Catcher',
          is_title_track: false,
        },
      ],
    },
    {
      group: 'Weeekly',
      release_title: 'Lights On',
      release_date: '2024-01-15',
      stream: 'song',
      release_kind: 'single',
      tracks: [
        {
          order: 1,
          title: 'Lights On',
          is_title_track: true,
        },
      ],
    },
    {
      group: 'AtHeart',
      release_title: 'Glow Up',
      release_date: '2025-11-18',
      stream: 'song',
      release_kind: 'single',
      tracks: [
        {
          order: 1,
          title: 'Glow Up',
          is_title_track: true,
        },
      ],
    },
  ],
  releaseHistory: [
    {
      group: 'YENA',
      releases: [
        {
          title: 'LOVE CATCHER',
          date: '2026-03-11',
          source: 'https://musicbrainz.org/release-group/love-catcher',
          release_kind: 'ep',
          stream: 'album',
          context_tags: [],
        },
        {
          title: 'NEMONEMO',
          date: '2024-09-01',
          source: 'https://musicbrainz.org/release-group/nemonemo',
          release_kind: 'single',
          stream: 'song',
          context_tags: [],
        },
      ],
    },
    {
      group: 'Weeekly',
      releases: [
        {
          title: 'Lights On',
          date: '2024-01-15',
          source: 'https://musicbrainz.org/release-group/lights-on',
          release_kind: 'single',
          stream: 'song',
          context_tags: ['title_track'],
        },
      ],
    },
    {
      group: 'AtHeart',
      releases: [
        {
          title: 'Glow Up',
          date: '2025-11-18',
          source: 'https://musicbrainz.org/release-group/glow-up',
          release_kind: 'single',
          stream: 'song',
          context_tags: ['title_track'],
        },
      ],
    },
  ],
  youtubeChannelAllowlists: [
    {
      group: 'YENA',
      primary_team_channel_url: 'https://www.youtube.com/@YENA_PRIMARY',
      channels: [
        {
          channel_url: 'https://www.youtube.com/@YENA_PRIMARY',
          display_in_team_links: true,
        },
      ],
    },
  ],
};

describe('mobile selector/adapters scaffold', () => {
  test('builds a team summary with link and badge fallbacks', () => {
    const summary = selectTeamSummaryBySlug(dataset, 'yena');

    expect(summary).not.toBeNull();
    expect(summary?.displayName).toBe('YENA');
    expect(summary?.officialYoutubeUrl).toBe('https://www.youtube.com/@YENA_PRIMARY');
    expect(summary?.badge?.monogram).toBe('YE');
    expect(summary?.searchTokens).toContain('최예나');
  });

  test('selects the latest release summary from shared stream logic', () => {
    const release = selectLatestReleaseSummaryBySlug(dataset, 'yena');

    expect(release).not.toBeNull();
    expect(release?.releaseTitle).toBe('LOVE CATCHER');
    expect(release?.stream).toBe('album');
  });

  test('returns recent release history rows as normalized summary models', () => {
    const releases = selectRecentReleaseSummariesBySlug(dataset, 'yena', 2);

    expect(releases).toHaveLength(2);
    expect(releases[0]?.releaseTitle).toBe('LOVE CATCHER');
    expect(releases[0]?.coverImageUrl).toBe('https://example.com/love-catcher.jpg');
  });

  test('sorts group upcoming rows by exact date before month-only rows', () => {
    const upcoming = selectUpcomingEventsBySlug(dataset, 'yena');

    expect(upcoming).toHaveLength(2);
    expect(upcoming[0]?.datePrecision).toBe('exact');
    expect(upcoming[0]?.confidence).toBe('high');
    expect(upcoming[1]?.datePrecision).toBe('month_only');
    expect(upcoming[1]?.confidence).toBe('low');
  });

  test('builds month release summaries from release history rows', () => {
    const releases = selectMonthReleaseSummaries(dataset, '2026-03');

    expect(releases).toHaveLength(1);
    expect(releases[0]?.releaseTitle).toBe('LOVE CATCHER');
    expect(releases[0]?.coverImageUrl).toBe('https://example.com/love-catcher.jpg');
  });

  test('builds month upcoming rows with exact before month-only ordering', () => {
    const upcoming = selectMonthUpcomingEvents(dataset, '2026-03');

    expect(upcoming).toHaveLength(2);
    expect(upcoming[0]?.datePrecision).toBe('exact');
    expect(upcoming[1]?.datePrecision).toBe('month_only');
  });

  test('builds a calendar month snapshot with nearest exact upcoming', () => {
    const snapshot = selectCalendarMonthSnapshot(dataset, '2026-03', '2026-03-08');

    expect(snapshot.releaseCount).toBe(1);
    expect(snapshot.upcomingCount).toBe(2);
    expect(snapshot.nearestUpcoming?.headline).toContain('3월 11일');
    expect(snapshot.exactUpcoming).toHaveLength(1);
    expect(snapshot.monthOnlyUpcoming).toHaveLength(1);
  });

  test('returns sectioned search results for Korean alias and exact upcoming coverage', () => {
    const results = selectSearchResults(dataset, '최예나');

    expect(results.entities[0]?.team.slug).toBe('yena');
    expect(results.entities[0]?.matchKind).toBe('alias_exact');
    expect(results.releases[0]?.release.releaseTitle).toBe('LOVE CATCHER');
    expect(results.releases[0]?.matchKind).toBe('entity_exact_latest_release');
    expect(results.upcoming[0]?.upcoming.group).toBe('YENA');
    expect(results.upcoming[0]?.matchKind).toBe('entity_exact');
  });

  test('returns release-title exact search matches ahead of partial matches', () => {
    const results = selectSearchResults(dataset, 'LOVE CATCHER');

    expect(results.releases[0]?.release.releaseTitle).toBe('LOVE CATCHER');
    expect(results.releases[0]?.matchKind).toBe('release_title_exact');
  });

  test('builds a radar snapshot with featured, weekly, long-gap, and rookie sections', () => {
    const snapshot = selectRadarSnapshot(dataset, '2026-03-08');

    expect(snapshot.featuredUpcoming?.team.slug).toBe('yena');
    expect(snapshot.featuredUpcoming?.dayLabel).toBe('D-3');
    expect(snapshot.weeklyUpcoming).toHaveLength(1);
    expect(snapshot.changeFeed).toHaveLength(0);
    expect(snapshot.longGap[0]?.team.slug).toBe('weeekly');
    expect(snapshot.rookie[0]?.team.slug).toBe('atheart');
  });

  test('builds an entity detail snapshot with upcoming, albums, and ordered timeline rows', () => {
    const snapshot = selectEntityDetailSnapshot(dataset, 'yena');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.team.slug).toBe('yena');
    expect(snapshot?.nextUpcoming?.headline).toContain('3월 11일');
    expect(snapshot?.latestRelease?.releaseTitle).toBe('LOVE CATCHER');
    expect(snapshot?.recentAlbums[0]?.releaseTitle).toBe('LOVE CATCHER');
    expect(snapshot?.sourceTimeline[0]?.kind).toBe('upcoming_source');
    expect(snapshot?.sourceTimeline.at(-1)?.kind).toBe('artist_source');
  });

  test('resolves a release detail model by normalized release id', () => {
    const context = createSelectorContext(dataset);
    const releaseId = buildReleaseId('YENA', 'LOVE CATCHER', '2026-03-11', 'album');
    const detail = selectReleaseDetailById(context, releaseId);

    expect(detail).not.toBeNull();
    expect(detail?.releaseTitle).toBe('LOVE CATCHER');
    expect(detail?.coverImageUrl).toBe('https://example.com/love-catcher.jpg');
    expect(detail?.tracks[0]?.isTitleTrack).toBe(true);
    expect(detail?.youtubeVideoStatus).toBe('manual_override');
  });
});
