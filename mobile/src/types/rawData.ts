export type LatestReleaseStreamRaw = {
  title: string;
  date: string;
  source?: string | null;
  release_kind?: string | null;
  release_format?: string | null;
  context_tags?: string[] | null;
};

export type ArtistProfileRaw = {
  slug: string;
  group: string;
  display_name?: string | null;
  aliases?: string[] | null;
  search_aliases?: string[] | null;
  agency?: string | null;
  badge_image_url?: string | null;
  representative_image_url?: string | null;
  official_youtube_url?: string | null;
  official_x_url?: string | null;
  official_instagram_url?: string | null;
  artist_source_url?: string | null;
  artist_source?: string | null;
};

export type ReleaseStreamCollectionRaw = {
  group: string;
  latest_song?: LatestReleaseStreamRaw | null;
  latest_album?: LatestReleaseStreamRaw | null;
  artist_source?: string | null;
};

export type UpcomingCandidateRaw = {
  group: string;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision?: string | null;
  date_status?: string | null;
  headline: string;
  release_label?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  confidence?: number | string | null;
};

export type ReleaseArtworkRaw = {
  group: string;
  release_title: string;
  release_date: string;
  stream: string;
  cover_image_url?: string | null;
};

export type TrackRaw = {
  order: number;
  title: string;
  is_title_track?: boolean | null;
  spotify_url?: string | null;
  youtube_music_url?: string | null;
};

export type ReleaseDetailRaw = {
  group: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind?: string | null;
  tracks?: TrackRaw[] | null;
  spotify_url?: string | null;
  youtube_music_url?: string | null;
  youtube_video_id?: string | null;
  youtube_video_url?: string | null;
  youtube_video_status?: string | null;
  youtube_video_provenance?: string | null;
  notes?: string | null;
};

export type ReleaseHistoryEntryRaw = {
  title: string;
  date: string;
  source?: string | null;
  release_kind?: string | null;
  release_format?: string | null;
  context_tags?: string[] | null;
  stream?: string | null;
};

export type ReleaseHistoryGroupRaw = {
  group: string;
  releases: ReleaseHistoryEntryRaw[];
};

export type YoutubeChannelRaw = {
  channel_url: string;
  channel_label?: string | null;
  owner_type?: string | null;
  allow_mv_uploads?: boolean | null;
  display_in_team_links?: boolean | null;
};

export type YoutubeChannelAllowlistRaw = {
  group: string;
  primary_team_channel_url?: string | null;
  mv_allowlist_urls?: string[] | null;
  channels?: YoutubeChannelRaw[] | null;
};

export type MobileRawDataset = {
  artistProfiles: ArtistProfileRaw[];
  releases: ReleaseStreamCollectionRaw[];
  upcomingCandidates: UpcomingCandidateRaw[];
  releaseArtwork: ReleaseArtworkRaw[];
  releaseDetails: ReleaseDetailRaw[];
  releaseHistory: ReleaseHistoryGroupRaw[];
  youtubeChannelAllowlists: YoutubeChannelAllowlistRaw[];
};
