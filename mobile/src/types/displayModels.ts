export type ReleaseKind = 'single' | 'mini' | 'album' | 'ep' | 'ost' | 'collab';
export type ReleaseStream = 'song' | 'album';
export type UpcomingDatePrecision = 'exact' | 'month_only' | 'unknown';
export type UpcomingStatus = 'scheduled' | 'confirmed' | 'rumor';
export type UpcomingConfidence = 'low' | 'medium' | 'high';
export type UpcomingSourceType = 'agency_notice' | 'weverse_notice' | 'official_social' | 'news_rss' | 'database' | 'pending';
export type YoutubeVideoStatus = 'relation_match' | 'manual_override' | 'needs_review' | 'no_mv' | 'unresolved';

export interface TeamBadge {
  imageUrl?: string;
  monogram?: string;
  label: string;
}

export interface TeamSummaryModel {
  slug: string;
  group: string;
  displayName: string;
  agency?: string;
  badge?: TeamBadge;
  representativeImageUrl?: string;
  officialYoutubeUrl?: string;
  officialXUrl?: string;
  officialInstagramUrl?: string;
  youtubeChannelUrls: string[];
  artistSourceUrl?: string;
  searchTokens: string[];
}

export interface ReleaseSummaryModel {
  id: string;
  group: string;
  displayGroup: string;
  releaseTitle: string;
  releaseDate: string;
  releaseKind?: ReleaseKind | string;
  stream?: ReleaseStream;
  representativeSongTitle?: string;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
  youtubeMvUrl?: string;
  coverImageUrl?: string;
  sourceUrl?: string;
  contextTags: string[];
}

export interface UpcomingEventModel {
  id: string;
  group: string;
  displayGroup: string;
  scheduledDate?: string;
  scheduledMonth?: string;
  datePrecision: UpcomingDatePrecision;
  headline: string;
  releaseLabel?: string;
  status?: UpcomingStatus;
  confidence?: UpcomingConfidence;
  sourceType: UpcomingSourceType;
  sourceUrl?: string;
}

export interface TrackModel {
  order: number;
  title: string;
  isTitleTrack?: boolean;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
}

export interface ReleaseDetailModel {
  id: string;
  group: string;
  displayGroup: string;
  releaseTitle: string;
  releaseDate: string;
  releaseKind?: string;
  stream?: ReleaseStream;
  coverImageUrl?: string;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
  youtubeVideoId?: string;
  youtubeVideoUrl?: string;
  youtubeVideoStatus?: YoutubeVideoStatus;
  youtubeVideoProvenance?: string;
  notes?: string;
  tracks: TrackModel[];
}
