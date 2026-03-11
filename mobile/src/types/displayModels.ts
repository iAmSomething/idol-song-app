export type ReleaseKind = 'single' | 'mini' | 'album' | 'ep' | 'ost' | 'collab';
export type ReleaseStream = 'song' | 'album';
export type UpcomingDatePrecision = 'exact' | 'month_only' | 'unknown';
export type UpcomingStatus = 'scheduled' | 'confirmed' | 'rumor';
export type UpcomingConfidence = 'low' | 'medium' | 'high';
export type UpcomingSourceType = 'agency_notice' | 'weverse_notice' | 'official_social' | 'news_rss' | 'database' | 'pending';
export type YoutubeVideoStatus =
  | 'relation_match'
  | 'manual_override'
  | 'needs_review'
  | 'no_link'
  | 'no_mv'
  | 'unresolved';
export type TeamActType = 'group' | 'solo' | 'unit' | 'project';

export interface TeamBadge {
  imageUrl?: string;
  monogram?: string;
  label: string;
}

export interface TeamSummaryModel {
  slug: string;
  group: string;
  displayName: string;
  actType: TeamActType;
  debutYear?: number;
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
  sourceUrl?: string;
  youtubeMusicUrl?: string;
  youtubeVideoId?: string;
  youtubeVideoUrl?: string;
  youtubeVideoStatus?: YoutubeVideoStatus;
  youtubeVideoProvenance?: string;
  notes?: string;
  tracks: TrackModel[];
}

export type SearchTeamMatchKind =
  | 'display_name_exact'
  | 'search_alias_exact'
  | 'alias_exact'
  | 'alias_partial'
  | 'partial';

export type SearchReleaseMatchKind =
  | 'release_title_exact'
  | 'entity_exact_latest_release'
  | 'partial';

export type SearchUpcomingMatchKind =
  | 'entity_exact'
  | 'headline_exact'
  | 'partial';

export interface SearchTeamResultModel {
  team: TeamSummaryModel;
  latestRelease: ReleaseSummaryModel | null;
  matchKind: SearchTeamMatchKind;
}

export interface SearchReleaseResultModel {
  release: ReleaseSummaryModel;
  matchKind: SearchReleaseMatchKind;
}

export interface SearchUpcomingResultModel {
  upcoming: UpcomingEventModel;
  matchKind: SearchUpcomingMatchKind;
}

export interface SearchResultsModel {
  query: string;
  entities: SearchTeamResultModel[];
  releases: SearchReleaseResultModel[];
  upcoming: SearchUpcomingResultModel[];
}

export interface CalendarMonthSnapshotModel {
  month: string;
  releaseCount: number;
  upcomingCount: number;
  nearestUpcoming: UpcomingEventModel | null;
  releases: ReleaseSummaryModel[];
  exactUpcoming: UpcomingEventModel[];
  monthOnlyUpcoming: UpcomingEventModel[];
}

export type CalendarDayBadgeKind = 'release' | UpcomingStatus;

export interface CalendarDayBadgeModel {
  id: string;
  group: string;
  label: string;
  monogram: string;
  kind: CalendarDayBadgeKind;
}

export interface CalendarDayCellModel {
  isoDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  badges: CalendarDayBadgeModel[];
  overflowCount: number;
  releaseCount: number;
  upcomingCount: number;
}

export interface CalendarSelectedDayModel {
  isoDate: string;
  label: string;
  releases: ReleaseSummaryModel[];
  exactUpcoming: UpcomingEventModel[];
  isEmpty: boolean;
}

export interface CalendarMonthGridModel {
  month: string;
  weekdayLabels: string[];
  weeks: (CalendarDayCellModel | null)[][];
  selectedDay: CalendarSelectedDayModel | null;
}

export interface RadarUpcomingCardModel {
  id: string;
  team: TeamSummaryModel;
  upcoming: UpcomingEventModel;
  dayLabel: string;
  sourceLabel: string;
  sourceUrl?: string;
}

export interface RadarChangeFeedItemModel {
  id: string;
  team: TeamSummaryModel;
  changeTypeLabel: string;
  previousScheduleLabel: string;
  nextScheduleLabel: string;
  occurredAtLabel?: string;
  releaseLabel?: string;
  headline?: string;
  sourceLabel: string;
  sourceUrl?: string;
}

export interface RadarLongGapItemModel {
  id: string;
  team: TeamSummaryModel;
  latestRelease: ReleaseSummaryModel | null;
  gapDays: number;
  gapLabel: string;
  hasUpcomingSignal: boolean;
}

export interface RadarRookieItemModel {
  id: string;
  team: TeamSummaryModel;
  debutYear: number;
  latestRelease: ReleaseSummaryModel | null;
  hasUpcomingSignal: boolean;
}

export interface RadarSnapshotModel {
  futureUpcoming: RadarUpcomingCardModel[];
  featuredUpcoming: RadarUpcomingCardModel | null;
  weeklyUpcoming: RadarUpcomingCardModel[];
  changeFeed: RadarChangeFeedItemModel[];
  longGap: RadarLongGapItemModel[];
  rookie: RadarRookieItemModel[];
}

export type EntityTimelineItemKind = 'artist_source' | 'upcoming_source' | 'release_source';

export interface EntityTimelineItemModel {
  id: string;
  kind: EntityTimelineItemKind;
  title: string;
  meta: string;
  sourceUrl?: string;
}

export interface EntityDetailSnapshotModel {
  team: TeamSummaryModel;
  nextUpcoming: UpcomingEventModel | null;
  latestRelease: ReleaseSummaryModel | null;
  recentAlbums: ReleaseSummaryModel[];
  sourceTimeline: EntityTimelineItemModel[];
}
