import type { MobileRawDataset } from '../types';

const bundledDatasetFixture: MobileRawDataset = {
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
      artist_source_url: 'https://musicbrainz.org/artist/example-yena',
    },
    {
      slug: 'p1harmony',
      group: 'P1Harmony',
      display_name: 'P1Harmony',
      aliases: ['피원하모니'],
      search_aliases: ['피원하'],
      agency: 'FNC Entertainment',
      official_youtube_url: 'https://www.youtube.com/@P1Harmony',
      official_x_url: 'https://x.com/P1H_official',
      official_instagram_url: 'https://www.instagram.com/p1h_official/',
      artist_source_url: 'https://musicbrainz.org/artist/example-p1harmony',
    },
    {
      slug: 'bts',
      group: 'BTS',
      display_name: 'BTS',
      aliases: ['방탄소년단'],
      search_aliases: ['방탄'],
      agency: 'BIGHIT MUSIC',
      official_youtube_url: 'https://www.youtube.com/@BTS',
      official_x_url: 'https://x.com/bts_bighit',
      official_instagram_url: 'https://www.instagram.com/bts.bighitofficial/',
      artist_source_url: 'https://musicbrainz.org/artist/example-bts',
    },
    {
      slug: 'le-sserafim',
      group: 'LE SSERAFIM',
      display_name: 'LE SSERAFIM',
      aliases: ['르세라핌'],
      search_aliases: ['르세라핌'],
      agency: 'SOURCE MUSIC',
      official_youtube_url: 'https://www.youtube.com/@LESSERAFIM_OFFICIAL',
      official_x_url: 'https://x.com/le_sserafim',
      official_instagram_url: 'https://www.instagram.com/le_sserafim/',
      artist_source_url: 'https://musicbrainz.org/artist/example-le-sserafim',
    },
  ],
  releases: [
    {
      group: 'YENA',
      latest_song: {
        title: 'Drama Queen',
        date: '2026-03-11',
        source: 'https://musicbrainz.org/release-group/example-drama-queen',
        release_kind: 'single',
        context_tags: ['title_track'],
      },
      latest_album: {
        title: 'LOVE CATCHER',
        date: '2026-03-11',
        source: 'https://musicbrainz.org/release-group/example-love-catcher',
        release_kind: 'ep',
        context_tags: [],
      },
    },
    {
      group: 'BTS',
      latest_song: {
        title: 'Signal Fire',
        date: '2026-03-21',
        source: 'https://musicbrainz.org/release-group/example-signal-fire',
        release_kind: 'single',
        context_tags: ['title_track'],
      },
      latest_album: null,
    },
  ],
  upcomingCandidates: [
    {
      group: 'YENA',
      scheduled_date: '2026-03-11',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      headline: 'YENA confirms a March 11 comeback',
      release_label: 'LOVE CATCHER',
      source_type: 'news_rss',
      source_url: 'https://example.com/yena-comeback',
      confidence: 0.84,
    },
    {
      group: 'P1Harmony',
      scheduled_date: '2026-03-12',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'scheduled',
      headline: 'P1Harmony schedules a March 12 return',
      release_label: 'DUH!',
      source_type: 'official_social',
      source_url: 'https://example.com/p1harmony-return',
      confidence: 0.72,
    },
    {
      group: 'LE SSERAFIM',
      scheduled_month: '2026-03',
      date_precision: 'month_only',
      date_status: 'rumor',
      headline: 'LE SSERAFIM is rumored to return later this month',
      release_label: 'Rumored follow-up',
      source_type: 'news_rss',
      source_url: 'https://example.com/lesserafim-rumor',
      confidence: 0.44,
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
      group: 'BTS',
      release_title: 'Signal Fire',
      release_date: '2026-03-21',
      stream: 'song',
      cover_image_url: 'https://example.com/signal-fire.jpg',
    },
  ],
  releaseDetails: [
    {
      group: 'YENA',
      release_title: 'LOVE CATCHER',
      release_date: '2026-03-11',
      stream: 'album',
      release_kind: 'ep',
      spotify_url: 'https://open.spotify.com/album/example-love-catcher',
      youtube_music_url: 'https://music.youtube.com/playlist?list=example-love-catcher',
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
      group: 'BTS',
      release_title: 'Signal Fire',
      release_date: '2026-03-21',
      stream: 'song',
      release_kind: 'single',
      spotify_url: 'https://open.spotify.com/track/example-signal-fire',
      youtube_music_url: 'https://music.youtube.com/watch?v=example-signal-fire',
      youtube_video_status: 'manual_override',
      notes: 'Representative single detail.',
      tracks: [
        {
          order: 1,
          title: 'Signal Fire',
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
          source: 'https://musicbrainz.org/release-group/example-love-catcher',
          release_kind: 'ep',
          stream: 'album',
          context_tags: [],
        },
        {
          title: 'NEMONEMO',
          date: '2025-09-01',
          source: 'https://musicbrainz.org/release-group/example-nemonemo',
          release_kind: 'single',
          stream: 'song',
          context_tags: [],
        },
      ],
    },
    {
      group: 'BTS',
      releases: [
        {
          title: 'Signal Fire',
          date: '2026-03-21',
          source: 'https://musicbrainz.org/release-group/example-signal-fire',
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
      primary_team_channel_url: 'https://www.youtube.com/@YENA_OFFICIAL',
      channels: [
        {
          channel_url: 'https://www.youtube.com/@YENA_OFFICIAL',
          display_in_team_links: true,
        },
      ],
    },
    {
      group: 'BTS',
      primary_team_channel_url: 'https://www.youtube.com/@BTS',
      channels: [
        {
          channel_url: 'https://www.youtube.com/@BTS',
          display_in_team_links: true,
        },
      ],
    },
  ],
};

export const BUNDLED_DATASET_FIXTURE = bundledDatasetFixture;

export function cloneBundledDatasetFixture(): MobileRawDataset {
  return JSON.parse(JSON.stringify(bundledDatasetFixture)) as MobileRawDataset;
}
