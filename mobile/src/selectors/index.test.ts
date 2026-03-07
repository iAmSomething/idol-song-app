import type { MobileRawDataset } from '../types';

import {
  createSelectorContext,
  selectLatestReleaseSummaryBySlug,
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
      scheduled_month: '2026-04',
      date_precision: 'month_only',
      date_status: 'scheduled',
      headline: 'YENA spring follow-up rumored',
      source_type: 'official_social',
      source_url: 'https://example.com/yena-social',
      confidence: 0.41,
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
          date: '2025-09-01',
          source: 'https://musicbrainz.org/release-group/nemonemo',
          release_kind: 'single',
          stream: 'song',
          context_tags: [],
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
    expect(release?.releaseTitle).toBe('Drama Queen');
    expect(release?.stream).toBe('song');
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
