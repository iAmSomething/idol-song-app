import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import './App.css'
import {
  classifyBackendFetchError,
  extractBackendFetchRequestId,
  fetchJsonWithTimeout,
} from './lib/backendFetch'
import {
  buildServiceActionLinks,
  buildYouTubeMvSearchUrl,
  openMusicHandoff,
  shouldBypassManagedHandoff,
  type MusicHandoffLink,
  type MusicHandoffUrls,
  type ServiceActionId,
} from './lib/mobileWebHandoff'
import {
  getSurfaceFallbackReasonKey,
  type SurfaceStatusSource,
} from './lib/surfaceStatus'
import { buildBridgeSearchApiData, type BridgeSearchIndex } from './lib/bridgeSearch'
import {
  buildEntityDetailRecoverySearchTerms,
  pickEntityDetailRecoveryCandidate,
} from './lib/entityDetailRecovery'
import { shouldReloadForRuntimeRefresh } from './lib/runtimeRefresh'

type ReleaseFact = {
  title: string
  date: string
  source: string
  release_kind: 'single' | 'album' | 'ep'
  release_format: ReleaseFormat
  context_tags: ContextTag[]
  music_handoffs?: MusicHandoffUrls
}

type ReleaseRow = {
  group: string
  artist_name_mb: string
  artist_mbid: string
  artist_source: string
  latest_song: ReleaseFact | null
  latest_album: ReleaseFact | null
}

type ReleaseHistorySeedRow = {
  group: string
  artist_name_mb: string
  artist_mbid: string
  artist_source: string
  releases: Array<
    ReleaseFact & {
      stream: 'song' | 'album'
    }
  >
}

type RadarTag = 'rookie'
type RelatedRadarTag = RadarTag | 'long_gap' | 'manual_watch'

type ArtistProfileRow = {
  slug: string
  group: string
  display_name: string
  aliases: string[]
  search_aliases: string[]
  debut_year?: number | null
  radar_tags?: RadarTag[]
  agency: string | null
  official_youtube_url: string | null
  official_x_url: string | null
  official_instagram_url: string | null
  representative_image_url: string | null
  representative_image_source: string | null
}

type YouTubeChannelOwnerType = 'team' | 'label'

type YouTubeChannelSourceRow = {
  channel_url: string
  channel_label: string
  owner_type: YouTubeChannelOwnerType
  allow_mv_uploads: boolean
  display_in_team_links: boolean
  provenance: string
}

type YouTubeChannelAllowlistRow = {
  group: string
  primary_team_channel_url: string | null
  mv_allowlist_urls: string[]
  channels: YouTubeChannelSourceRow[]
}

type ReleaseArtworkRow = {
  group: string
  release_title: string
  release_date: string
  stream: 'song' | 'album'
  cover_image_url: string
  thumbnail_image_url: string
  artwork_source_type: string
  artwork_source_url: string
}

type ResolvedReleaseArtwork = ReleaseArtworkRow & {
  isPlaceholder: boolean
}

type TeamBadgeAssetRow = {
  group: string
  badge_image_url: string
  badge_source_url: string
  badge_source_label: string
  badge_kind: string
}

type ReleaseDetailTrack = {
  order: number
  title: string
  is_title_track?: boolean
}

type ReleaseDetailRow = {
  group: string
  release_title: string
  release_date: string
  stream: 'song' | 'album'
  release_kind: ReleaseFact['release_kind']
  tracks: ReleaseDetailTrack[]
  spotify_url: string | null
  youtube_music_url: string | null
  youtube_video_id: string | null
  youtube_video_url?: string | null
  youtube_video_status?: 'relation_match' | 'manual_override' | 'needs_review' | 'no_link' | 'no_mv' | 'unresolved'
  youtube_video_provenance?: string | null
  notes: string
}

type ResolvedReleaseDetail = ReleaseDetailRow & {
  isFallback: boolean
}

type ReleaseEnrichmentCredits = {
  lyrics: string[]
  composition: string[]
  arrangement: string[]
}

type ReleaseEnrichmentChart = {
  source: string
  label: string
  peak: string
  dated_at: string
}

type ReleaseEnrichmentRow = {
  group: string
  release_title: string
  release_date: string
  stream: 'song' | 'album'
  credits: ReleaseEnrichmentCredits
  charts: ReleaseEnrichmentChart[]
  notes: string
}

type ResolvedReleaseEnrichment = ReleaseEnrichmentRow & {
  isFallback: boolean
}

type ReleaseDetailLookupApiResponse = {
  data?: {
    release_id?: string
    canonical_path?: string
  }
  error?: {
    code?: string
  }
}

type ReleaseDetailApiResponse = {
  data?: {
    release?: {
      release_id?: string
      release_title?: string
      release_date?: string
      stream?: string
      release_kind?: string | null
    }
    artwork?: Record<string, unknown> | null
    service_links?: {
      spotify?: {
        url?: string | null
      } | null
      youtube_music?: {
        url?: string | null
      } | null
    } | null
    tracks?: Array<{
      order?: number
      title?: string
      is_title_track?: boolean
    }>
    mv?: {
      url?: string | null
      video_id?: string | null
      status?: string | null
      provenance?: string | null
    } | null
    notes?: unknown
  }
  error?: {
    code?: string
  }
}

type ReleaseDetailApiSnapshot = {
  detail: ResolvedReleaseDetail
  artwork: ResolvedReleaseArtwork
  releaseId: string | null
  canonicalPath: string | null
}

type ReleaseDetailApiResource = {
  snapshot: ReleaseDetailApiSnapshot | null
  source: SurfaceStatusSource
  loading: boolean
  errorCode: string | null
  traceId: string | null
}

type ReleaseDetailApiRequest = {
  title: string
  date: string
  stream: VerifiedRelease['stream']
  release_kind: VerifiedRelease['release_kind']
  release_id?: string
}

type BackendTargetEnvironment = 'production' | 'preview' | 'local' | 'bridge' | 'unknown'

type SearchApiEntityMatch = {
  entity_slug?: string
  canonical_path?: string
  display_name?: string
  canonical_name?: string
  entity_type?: string
  agency_name?: string | null
  matched_alias?: string | null
  match_reason?: string
  latest_release?: {
    release_id?: string
    release_title?: string
    release_date?: string
    stream?: string
    release_kind?: string | null
  } | null
  next_upcoming?: {
    headline?: string
    scheduled_date?: string | null
    scheduled_month?: string | null
    date_precision?: string
    date_status?: string
    release_format?: string | null
    confidence_score?: number | null
  } | null
}

type SearchApiReleaseMatch = {
  release_id?: string
  canonical_path?: string
  detail_path?: string
  entity_path?: string
  entity_slug?: string
  display_name?: string
  release_title?: string
  release_date?: string
  stream?: string
  release_kind?: string | null
  release_format?: string | null
  matched_alias?: string | null
  match_reason?: string
}

type SearchApiUpcomingMatch = {
  upcoming_signal_id?: string
  entity_path?: string
  entity_slug?: string
  display_name?: string
  headline?: string
  scheduled_date?: string | null
  scheduled_month?: string | null
  date_precision?: string
  date_status?: string
  release_format?: string | null
  confidence_score?: number | null
  source_type?: string | null
  source_url?: string | null
  source_domain?: string | null
  evidence_summary?: string | null
  matched_alias?: string | null
  match_reason?: string
}

type SearchApiResponse = {
  data?: {
    entities?: SearchApiEntityMatch[]
    releases?: SearchApiReleaseMatch[]
    upcoming?: SearchApiUpcomingMatch[]
  }
  error?: {
    code?: string
  }
}

type SearchSurfaceEntityResult = {
  entitySlug: string
  canonicalPath: string
  displayName: string
  canonicalName: string
  entityType: string
  agencyName: string | null
  matchReason: string
  matchedAlias: string | null
  latestRelease: {
    releaseId: string
    title: string
    date: string
    stream: 'album' | 'song'
    releaseKind: ReleaseFact['release_kind']
  } | null
  nextUpcoming: {
    headline: string
    scheduledDate: string
    scheduledMonth: string
    datePrecision: 'exact' | 'month_only' | 'unknown'
    dateStatus: 'confirmed' | 'scheduled' | 'rumor'
    releaseFormat: ReleaseFormat | ''
    confidence: number
  } | null
}

type SearchSurfaceReleaseResult = {
  releaseId: string
  detailPath: string
  entityPath: string
  entitySlug: string
  displayName: string
  releaseTitle: string
  releaseDate: string
  stream: 'album' | 'song'
  releaseKind: ReleaseFact['release_kind']
  releaseFormat: ReleaseFormat | ''
  matchReason: string
  matchedAlias: string | null
}

type SearchSurfaceUpcomingResult = {
  upcomingSignalId: string
  entityPath: string
  entitySlug: string
  displayName: string
  headline: string
  scheduled_date: string
  scheduled_month: string
  date_precision: 'exact' | 'month_only' | 'unknown'
  date_status: 'confirmed' | 'scheduled' | 'rumor'
  release_format: ReleaseFormat | ''
  confidence: number
  source_type: string
  source_url: string
  source_domain: string
  evidence_summary: string
  matchReason: string
  matchedAlias: string | null
}

type SearchSurfaceSnapshot = {
  entities: SearchSurfaceEntityResult[]
  releases: SearchSurfaceReleaseResult[]
  upcoming: SearchSurfaceUpcomingResult[]
}

type SearchSurfaceResource = SearchSurfaceSnapshot & {
  source: SurfaceStatusSource
  loading: boolean
  errorCode: string | null
  traceId: string | null
}

type ReleaseRouteSelection = {
  entitySlug: string
  releaseSlug: string
  releaseDate: string | null
  releaseStream: VerifiedRelease['stream'] | null
  releaseId: string | null
}

type EntityDetailReleaseSummary = {
  release_id?: string
  release_title?: string
  release_date?: string
  stream?: string
  release_kind?: string | null
  release_format?: string | null
  representative_song_title?: string | null
  spotify_url?: string | null
  youtube_music_url?: string | null
  youtube_mv_url?: string | null
  source_url?: string | null
  artist_source_url?: string | null
  artwork?: Record<string, unknown> | null
}

type EntityDetailApiResponse = {
  data?: {
    identity?: {
      entity_slug?: string
      display_name?: string
      canonical_name?: string
      agency_name?: string | null
      badge_image_url?: string | null
      representative_image_url?: string | null
    }
    official_links?: {
      youtube?: string | null
      x?: string | null
      instagram?: string | null
    } | null
    youtube_channels?: {
      primary_team_channel_url?: string | null
      mv_allowlist_urls?: string[]
    } | null
    tracking_state?: {
      tier?: string | null
      tracking_status?: string | null
    } | null
    next_upcoming?: {
      upcoming_signal_id?: string
      headline?: string
      scheduled_date?: string | null
      scheduled_month?: string | null
      date_precision?: string
      date_status?: string
      release_format?: string | null
      confidence_score?: number | null
      latest_seen_at?: string | null
      source_type?: string | null
      source_url?: string | null
      source_domain?: string | null
      evidence_summary?: string | null
      source_count?: number | null
    } | null
    latest_release?: EntityDetailReleaseSummary | null
    release_history?: EntityDetailReleaseSummary[]
    recent_albums?: EntityDetailReleaseSummary[]
    source_timeline?: Array<{
      headline?: string
      source_url?: string | null
      source_type?: string | null
      source_domain?: string | null
      published_at?: string | null
      scheduled_date?: string | null
      scheduled_month?: string | null
      date_precision?: string | null
      date_status?: string | null
      release_format?: string | null
      confidence_score?: number | null
    }>
    artist_source_url?: string | null
    compare_candidates?: Array<{
      entity_slug?: string
      display_name?: string
      entity_type?: string | null
      agency_name?: string | null
    }>
    related_acts?: Array<{
      entity_slug?: string
      display_name?: string
      entity_type?: string | null
      agency_name?: string | null
      reason?: {
        kind?: string
        value?: string | null
      } | null
    }>
  }
  error?: {
    code?: string
  }
}

type EntityDetailSurfaceResource = {
  team: TeamProfile | null
  source: SurfaceStatusSource
  loading: boolean
  errorCode: string | null
  traceId: string | null
}

type EntityDetailTimelineEntry = NonNullable<NonNullable<EntityDetailApiResponse['data']>['source_timeline']>[number]

type CalendarMonthApiVerifiedRelease = {
  release_id?: string
  entity_slug?: string
  display_name?: string
  entity_type?: string | null
  agency_name?: string | null
  release_title?: string
  release_format?: string | null
  stream?: string
  release_kind?: string | null
  release_date?: string
  source_url?: string | null
  artist_source_url?: string | null
}

type CalendarMonthApiUpcomingItem = {
  upcoming_signal_id?: string
  entity_slug?: string
  display_name?: string
  entity_type?: string | null
  agency_name?: string | null
  tracking_status?: string | null
  headline?: string
  scheduled_date?: string | null
  scheduled_month?: string | null
  date_precision?: string
  date_status?: string
  confidence_score?: number | null
  release_format?: string | null
  source_url?: string | null
  source_type?: string | null
  source_domain?: string | null
  evidence_summary?: string | null
  source_count?: number | null
}

type CalendarMonthApiResponse = {
  data?: {
    summary?: {
      verified_count?: number
      exact_upcoming_count?: number
      month_only_upcoming_count?: number
    }
    nearest_upcoming?: CalendarMonthApiUpcomingItem | null
    days?: Array<{
      date?: string
      verified_releases?: CalendarMonthApiVerifiedRelease[]
      exact_upcoming?: CalendarMonthApiUpcomingItem[]
    }>
    month_only_upcoming?: CalendarMonthApiUpcomingItem[]
    verified_list?: CalendarMonthApiVerifiedRelease[]
    scheduled_list?: CalendarMonthApiUpcomingItem[]
  }
  error?: {
    code?: string
  }
}

type CalendarMonthApiSnapshot = {
  verifiedRows: VerifiedRelease[]
  scheduledRows: DatedUpcomingSignal[]
  monthOnlyRows: UpcomingCandidateRow[]
}

type CalendarMonthSurfaceResource = {
  snapshot: CalendarMonthApiSnapshot | null
  source: SurfaceStatusSource
  loading: boolean
  errorCode: string | null
  traceId: string | null
}

type RadarApiReleaseSummary = {
  release_id?: string | null
  release_title?: string
  release_date?: string | null
  stream?: string | null
  release_kind?: string | null
  release_format?: string | null
  source_url?: string | null
  artist_source_url?: string | null
}

type RadarApiUpcomingSummary = {
  upcoming_signal_id?: string
  entity_slug?: string
  display_name?: string
  headline?: string
  scheduled_date?: string | null
  scheduled_month?: string | null
  date_precision?: string
  date_status?: string
  confidence_score?: number | null
  release_format?: string | null
  source_url?: string | null
  source_type?: string | null
  source_domain?: string | null
  evidence_summary?: string | null
  source_count?: number | null
  latest_seen_at?: string | null
}

type RadarApiLongGapItem = {
  entity_slug?: string
  display_name?: string
  entity_type?: string | null
  agency_name?: string | null
  tracking_status?: string | null
  watch_reason?: string | null
  latest_release?: RadarApiReleaseSummary | null
  gap_days?: number | null
  has_upcoming_signal?: boolean
  latest_signal?: RadarApiUpcomingSummary | null
}

type RadarApiRookieItem = {
  entity_slug?: string
  display_name?: string
  entity_type?: string | null
  agency_name?: string | null
  tracking_status?: string | null
  debut_year?: number | null
  latest_release?: RadarApiReleaseSummary | null
  has_upcoming_signal?: boolean
  latest_signal?: RadarApiUpcomingSummary | null
}

type RadarApiResponse = {
  data?: {
    long_gap?: RadarApiLongGapItem[]
    rookie?: RadarApiRookieItem[]
  }
  error?: {
    code?: string
  }
}

type RadarApiSnapshot = {
  longGapEntries: LongGapRadarEntry[]
  rookieEntries: RookieRadarEntry[]
}

type RadarSurfaceResource = {
  snapshot: RadarApiSnapshot | null
  source: SurfaceStatusSource
  loading: boolean
  errorCode: string | null
  traceId: string | null
}

type ActType = 'group' | 'solo' | 'unit'
type UpcomingDatePrecision = 'exact' | 'month_only' | 'unknown'

type VerifiedRelease = ReleaseFact & {
  group: string
  entitySlug?: string
  displayName?: string
  agencyName?: string | null
  artist_name_mb: string
  artist_mbid: string
  artist_source: string
  actType: ActType
  stream: 'song' | 'album'
  dateValue: Date
  isoDate: string
  release_id?: string
  artwork?: ResolvedReleaseArtwork | null
  youtube_mv_url?: string | null
}

type UnresolvedRow = {
  group: string
  reason: string
  artist_mbid?: string
}

type UpcomingSignalBase = {
  group: string
  entitySlug?: string
  displayName?: string
  agencyName?: string | null
  actType?: ActType
  scheduled_date: string
  scheduled_month: string
  date_precision: UpcomingDatePrecision
  date_status: 'confirmed' | 'scheduled' | 'rumor'
  headline: string
  release_format: ReleaseFormat | ''
  context_tags: ContextTag[]
  source_type: string
  source_url: string
  source_domain: string
  published_at: string
  confidence: number
  evidence_summary: string
  tracking_status: string
  search_term: string
}

type UpcomingCandidateRow = UpcomingSignalBase & {
  event_key?: string
  evidence_count?: number
  hidden_source_count?: number
  supporting_evidence?: UpcomingSignalBase[]
}

type DatedUpcomingSignal = UpcomingCandidateRow & {
  dateValue: Date
  isoDate: string
}

type SourceTimelineEventType =
  | 'first_signal'
  | 'official_announcement'
  | 'tracklist_reveal'
  | 'date_update'
  | 'release_verified'

type SourceTimelineItem = {
  group: string
  occurred_at: string
  event_type: SourceTimelineEventType
  source_type: string
  headline: string
  source_url: string
  summary: string
  source_domain: string
  sortValue: number
}

type AgencyMonthSection = {
  agency: string
  verifiedRows: VerifiedRelease[]
  scheduledRows: DatedUpcomingSignal[]
}

const WEEKLY_DIGEST_MAX_ITEMS = 8
const DAILY_SHARE_VERIFIED_LIMIT = 6
const DAILY_SHARE_UPCOMING_LIMIT = 4

type RelatedActsOverrideRow = {
  group: string
  related_groups: string[]
}

type RelatedActReason =
  | {
      kind: 'agency'
      agency: string
    }
  | {
      kind: 'entity_type'
      entityType: string
    }
  | {
      kind: 'radar_tag'
      radarTag: RelatedRadarTag
    }
  | {
      kind: 'manual_override'
    }

type RelatedActRecommendation = {
  group: string
  entitySlug: string | null
  displayName: string
  reason: RelatedActReason
  score: number
}

type ReleaseChangeType =
  | 'scheduled_date_added'
  | 'scheduled_date_changed'
  | 'date_status_changed'
  | 'headline_changed'
  | 'verified_release_detected'

type ReleaseChangeSnapshotState = {
  scheduled_date: string
  date_status: string
  headline: string
  source_type: string
  source_url: string
  published_at: string
}

type ReleaseChangeVerifiedRelease = {
  title: string
  date: string
  release_kind: string
  source: string
}

type ReleaseChangeLogRow = {
  key: string
  diff_key: string
  group: string
  change_type: ReleaseChangeType
  occurred_at: string
  summary: string
  source_url: string
  source_domain: string
  previous_state_hash: string
  next_state_hash: string
  previous: ReleaseChangeSnapshotState | null
  next: ReleaseChangeSnapshotState | null
  verified_release: ReleaseChangeVerifiedRelease | null
  snapshot: {
    previous_ref: string
    next_ref: string
  }
}

type AnnualReleaseTimelineItem =
  | {
      kind: 'release'
      occurredAt: string
      release: VerifiedRelease
    }
  | {
      kind: 'scheduled'
      occurredAt: string
      signal: UpcomingCandidateRow
    }

type AnnualReleaseTimelineSection = {
  year: number
  items: AnnualReleaseTimelineItem[]
}

type TeamCompareSnapshot = {
  group: string
  latestVerifiedRelease: VerifiedRelease | null
  latestAlbum: VerifiedRelease | null
  latestSong: VerifiedRelease | null
  nextUpcomingSignal: UpcomingCandidateRow | null
  recentYearReleaseCount: number
}

type TeamCompareOption = {
  group: string
  entitySlug: string
  displayName: string
}

type TeamDirectoryEntry = {
  group: string
  entitySlug: string | null
  displayName: string
  nextUpcomingSignal: UpcomingCandidateRow | null
}

type WatchReason = 'recent_release' | 'long_gap' | 'manual_watch'

type WatchlistRow = {
  group: string
  tier: string
  watch_reason: WatchReason
  tracking_status: string
  latest_release_title: string
  latest_release_date: string
  latest_release_kind: string
  x_url: string
  instagram_url: string
  search_terms: string[]
}

type CalendarDay = {
  date: Date
  iso: string
  inMonth: boolean
}

type ReleaseFormat = 'single' | 'album' | 'ep'

type ContextTag =
  | 'pre_release'
  | 'title_track'
  | 'ost'
  | 'collab'
  | 'japanese_release'
  | 'special_project'

type SourceBadgeType = 'agency_notice' | 'weverse_notice' | 'news_rss' | 'database' | 'pending'

type TeamLatestRelease = {
  title: string
  date: string
  releaseKind: string
  releaseFormat: ReleaseFormat | ''
  contextTags: ContextTag[]
  streamLabel: string
  stream: 'song' | 'album' | 'watchlist'
  source: string
  artistSource: string
  musicHandoffs?: MusicHandoffUrls
  youtubeMvUrl?: string | null
  verified: boolean
}

type TeamProfile = {
  group: string
  slug: string
  displayName: string
  aliases: string[]
  tier: string
  trackingStatus: string
  artistSource: string
  xUrl: string
  instagramUrl: string
  youtubeUrl: string | null
  hasOfficialYouTubeUrl: boolean
  agency: string
  badgeImageUrl: string | null
  badgeSourceUrl: string | null
  badgeSourceLabel: string | null
  representativeImageUrl: string | null
  representativeImageSource: string | null
  latestRelease: TeamLatestRelease | null
  recentAlbums: VerifiedRelease[]
  upcomingSignals: UpcomingCandidateRow[]
  sourceTimeline: SourceTimelineItem[]
  annualReleaseTimeline: AnnualReleaseTimelineSection[]
  changeLog: ReleaseChangeLogRow[]
  nextUpcomingSignal: UpcomingCandidateRow | null
  compareOptions: TeamCompareOption[]
  relatedActs: RelatedActRecommendation[]
}

type CanonicalDisclosureStatus = 'missing' | 'unresolved' | 'review_needed' | 'conditional_none'

type CanonicalSurfaceDisclosure = {
  title: string
  lines: string[]
}

type DashboardSortDirection = 'asc' | 'desc'
type VerifiedDashboardSortKey = 'date' | 'team'
type ScheduledDashboardSortKey = 'date' | 'team' | 'status' | 'confidence'

type LongGapRadarEntry = {
  group: string
  entitySlug?: string
  agencyName?: string | null
  watchReason: WatchReason
  latestRelease: TeamLatestRelease
  gapDays: number
  hasUpcomingSignal: boolean
  latestSignal: UpcomingCandidateRow | null
}

type RookieRadarEntry = {
  group: string
  entitySlug?: string
  agencyName?: string | null
  debutYear: number | null
  latestRelease: TeamLatestRelease | null
  hasUpcomingSignal: boolean
  latestSignal: UpcomingCandidateRow | null
}

type DashboardSectionNavigatorItem = {
  id: string
  label: string
  shortLabel: string
}

type CalendarQuickJumpSource = 'today' | 'upcoming' | 'current_month' | 'verified'

type CalendarQuickJumpTarget = {
  isoDate: string
  monthKey: string
  source: CalendarQuickJumpSource
}

const DASHBOARD_SECTION_NAV_IDS = [
  'dashboard-weekly-digest',
  'dashboard-calendar',
  'dashboard-monthly-view',
  'dashboard-agency-view',
  'dashboard-upcoming-scan',
  'dashboard-radar',
  'dashboard-recent-feed',
] as const

type Language = 'ko' | 'en'
type CountdownState = 'd_day' | 'd_1' | 'd_3' | 'd_7' | 'date'

type SearchNeedle = {
  normalized: string
  compact: string
}

type SearchIndex = {
  normalizedTerms: string[]
  compactTerms: string[]
}

const LANGUAGE_STORAGE_KEY = 'idol-song-app-language'
const MY_TEAMS_STORAGE_KEY = 'idol-song-app-my-teams'
const MY_TEAMS_LIMIT = 20
const LANGUAGE_OPTIONS: Language[] = ['ko', 'en']

const TRANSLATIONS = {
  ko: {
    locale: 'ko-KR',
    eyebrow: '케이팝 발매 캘린더',
    heroTitle: '캘린더 UI와 주간 컴백 인텔리전스 사이클.',
    heroText:
      '검증된 발매는 캘린더에 유지됩니다. 더 넓은 워치리스트는 필터에서 빠진 팀과 휴면 팀도 추적 대상으로 남겨두고, 주간 스캔은 뉴스와 공식 출처 단서를 바탕으로 다음 컴백 신호를 찾습니다.',
    languageLabel: '언어',
    languageNames: { ko: '한국어', en: 'English' },
    monthlyContextLabel: '월간 탐색',
    monthlySummaryLabels: {
      verified: '이번 달 발매',
      scheduled: '예정 컴백',
      nearest: '가장 가까운 일정',
    },
    searchSummaryLabels: {
      teams: '팀 결과',
      releases: '릴리즈 결과',
      upcoming: '예정 결과',
    },
    monthlyNearestEmpty: '정확한 날짜 없음',
    monthlyHighlightLabel: '가장 가까운 일정',
    monthlyHighlightEmpty: '현재 월과 필터 기준으로 정확한 날짜가 있는 예정 컴백이 없습니다.',
    monthlyHighlightUndatedOnly: '현재 월에는 날짜 미정 월 단위 신호만 있습니다. 아래 월간 목록에서 확인하세요.',
    searchResultsLabel: '검색 결과',
    searchResultsSpotlightLabel: '대표 결과',
    searchResultsEmptyTitle: '검색 결과 없음',
    searchResultsEmptyBody: '정확한 이름을 넣었는데도 비어 있다면 API 응답 또는 alias 데이터를 다시 확인해야 합니다.',
    searchResultsEntityLabel: '팀',
    searchResultsReleaseLabel: '릴리즈',
    searchResultsUpcomingLabel: '예정',
    searchResultsMatchedAliasLabel: '일치',
    stats: {
      verifiedReleases: '검증된 발매',
      watchTargets: '추적 대상',
      upcomingSignals: '예정 신호',
      needsReview: '검토 필요',
    },
    monthlyGrid: '월간 캘린더',
    calendarQuickJumpLabel: '빠른 이동',
    calendarQuickJumpToday: '오늘',
    calendarQuickJumpNearest: '가장 가까운 일정',
    calendarQuickJumpUnavailable: '이동할 날짜 없음',
    calendarQuickJumpSourceLabels: {
      today: '현재 실제 날짜',
      upcoming: '향후 exact date 우선',
      current_month: '현재 월 fallback',
      verified: '최근 verified fallback',
    },
    prev: '이전',
    next: '다음',
    searchLabel: '그룹, 곡, 앨범 검색',
    searchShort: '검색',
    searchPlaceholder: 'BLACKPINK, Hearts2Hearts, DEADLINE, RUDE!...',
    searchBackendLoading: 'backend /v1/search 결과를 확인하는 중입니다.',
    searchBackendActive: '현재 검색 결과는 backend /v1/search 응답을 사용 중입니다.',
    searchBridgeActive: '현재 검색 결과는 embedded 로컬 데이터로 표시 중입니다.',
    searchBackendFallback: 'backend 검색 응답을 불러오지 못했습니다. 검색 결과 fallback은 비활성화되어 있습니다.',
    searchBackendTimeout: 'backend /v1/search 응답 시간이 초과되었습니다. 검색 결과 fallback은 비활성화되어 있습니다.',
    calendarBackendLoading: 'backend /v1/calendar/month 결과를 확인하는 중입니다.',
    calendarBackendActive: '현재 월간 캘린더와 대시보드는 backend /v1/calendar/month 응답을 우선 사용 중입니다.',
    calendarJsonActive: '현재 월간 캘린더와 대시보드는 legacy JSON 데이터로 표시 중입니다.',
    calendarBackendFallback:
      'backend 월간 캘린더 응답을 불러오지 못했습니다. 월간 캘린더는 이제 backend-only runtime으로 동작합니다.',
    calendarBackendTimeout:
      'backend /v1/calendar/month 응답 시간이 초과되었습니다. 월간 캘린더는 이제 backend-only runtime으로 동작합니다.',
    radarBackendLoading: 'backend /v1/radar 결과를 확인하는 중입니다.',
    radarBackendActive: '현재 레이더 섹션은 backend /v1/radar 응답을 우선 사용 중입니다.',
    radarJsonActive: '현재 레이더 섹션은 legacy JSON 데이터로 표시 중입니다.',
    radarBackendFallback:
      'backend 레이더 응답을 불러오지 못했습니다. 레이더 섹션은 이제 backend-only runtime으로 동작합니다.',
    radarBackendTimeout:
      'backend /v1/radar 응답 시간이 초과되었습니다. 레이더 섹션은 이제 backend-only runtime으로 동작합니다.',
    surfaceSourceLabel: '소스',
    surfaceReasonLabel: '이유',
    surfaceTraceLabel: '요청 ID',
      surfaceSourceModeLabels: {
        api: 'backend API',
        json: 'legacy JSON',
        backend_unavailable: 'backend unavailable',
      },
    surfaceFallbackReasonLabels: {
      timeout: '응답 시간 초과',
      network_error: '네트워크 오류',
      not_found: 'not_found / 404',
      stale_projection: 'stale projection',
      disallowed_origin: '허용되지 않은 origin',
      invalid_request: '잘못된 요청',
      unknown: '기타 backend 오류',
    },
    monthSummaryVerified: '검증됨',
    monthSummaryScheduled: '예정',
    filterLabels: {
      releaseKind: '발매 종류',
      actType: '액트 유형',
      status: '표시 상태',
      agency: '소속사',
      myTeams: '관심 팀',
    },
    myTeamsOnlyToggle: '관심 팀만 보기',
    myTeamsOnlyHint: '캘린더, 예정 리스트, 레이더, 월간 대시보드를 저장한 팀 기준으로만 좁힙니다.',
    myTeamsEmpty: '관심 팀이 아직 없습니다. 팀 페이지에서 먼저 추가하세요.',
    agencyFilterExpand: '전체 소속사 보기',
    agencyFilterCollapse: '접기',
    filterOptions: {
      all: '전체',
      single: '싱글',
      album: '앨범',
      ep: 'EP',
      group: '그룹',
      solo: '솔로',
      unit: '유닛',
      verified: '검증 발매',
      confirmed: '확정',
      scheduled: '예정',
      rumor: '루머',
      agency_unknown: '소속사 미상',
    },
    statusLabels: {
      recent_release: '최근 발매',
      filtered_out: '필터 제외, 계속 추적',
      needs_manual_review: '수동 검토 필요',
      watch_only: '수동 추적만',
    },
    upcomingScan: '예정 스캔',
    upcomingTitle: '다가오는 컴백 신호',
    noUpcomingCandidates: '아직 수집된 예정 후보가 없습니다.',
    selectedDay: '선택한 날짜',
    noReleaseSelected: '선택된 날짜가 없습니다.',
    noVerifiedRelease: '이 날짜에 검증된 발매나 예정 신호가 없습니다.',
    selectedDayVerified: '검증된 발매',
    selectedDayScheduled: '예정 컴백',
    selectedDayVerifiedEmpty: '이 날짜에 검증된 발매가 없습니다.',
    selectedDayScheduledEmpty: '이 날짜에 예정 컴백이 없습니다.',
    shareCardLabel: '공유 카드',
    shareCardTitle: '원데이 스냅샷 공유',
    shareCardHint: '브라우저 공유를 열거나 텍스트를 복사한 뒤, 아래 카드를 그대로 캡처해 보낼 수 있습니다.',
    shareCardShare: '공유',
    shareCardShareFallback: '공유 텍스트 복사',
    shareCardCopySummary: '요약 복사',
    shareCardCopySuccess: '공유 텍스트를 복사했습니다.',
    shareCardSummaryCopied: '요약을 복사했습니다.',
    shareCardUnavailable: '이 브라우저에서는 공유나 복사를 사용할 수 없습니다.',
    shareCardBrand: 'Idol Song App',
    shareCardBrandServices: 'Spotify · YouTube Music · YouTube MV',
    shareCardCaptureHint: '아래 카드는 브라우저 공유나 캡처 전달을 기준으로 정리됩니다.',
    shareCardVerifiedEmpty: '표시할 verified release 없음',
    shareCardScheduledEmpty: '표시할 scheduled comeback 없음',
    noFilteredMatches: '현재 검색어와 필터 조합에 맞는 월간 항목이 없습니다.',
    releaseSource: '발매 출처',
    artistSource: '아티스트 출처',
    sourceLink: '출처 링크',
    noSourceLink: '출처 링크 없음',
    open: '열기',
    monthlyDashboard: '월간 릴리즈 대시보드',
    monthlyDashboardTitle: '선택한 월을 표 기반으로 훑어봅니다.',
    monthlyDashboardMonth: '현재 월',
    monthlyDashboardFilters: '적용 필터',
    monthlyDashboardFiltersDefault: '헤더 기본 필터 그대로',
    monthlyDashboardSort: '정렬',
    monthlyDashboardVerifiedTitle: 'Verified releases',
    monthlyDashboardScheduledTitle: 'Scheduled comebacks',
    monthlyDashboardScheduledExactTitle: '날짜가 잡힌 예정',
    monthlyDashboardScheduledMonthOnlyTitle: '월 단위 신호 · 날짜 미정',
    monthlyDashboardDatePending: '날짜 미정',
    monthlyDashboardVerifiedEmpty: '이 월에 표시할 검증 발매가 없습니다.',
    monthlyDashboardScheduledEmpty: '이 월에 표시할 예정 컴백이 없습니다.',
    agencyView: '소속사 뷰',
    agencyViewTitle: '선택한 월을 소속사 기준으로 다시 묶어 봅니다.',
    agencyViewEmpty: '선택한 월과 필터 조합에 맞는 소속사 항목이 없습니다.',
    agencyViewVerifiedCount: '검증',
    agencyViewScheduledCount: '예정',
    weeklyDigest: '이번 주 꼭 들을 것',
    weeklyDigestTitle: '최근 7일 verified release만 얇게 큐레이션합니다.',
    weeklyDigestEmpty: '현재 필터 기준으로 최근 7일 digest에 들어갈 verified release가 없습니다.',
    weeklyDigestWindow: '집계 기간',
    weeklyDigestCards: '카드 수',
    dashboardTeam: '팀명',
    dashboardRelease: '릴리즈명',
    dashboardLeadTrack: '대표곡',
    dashboardFormat: '형식',
    dashboardDate: '날짜',
    dashboardListen: '듣기 링크',
    dashboardActions: '액션',
    dashboardScheduledTitle: '예정명',
    dashboardStatus: '상태',
    dashboardConfidence: '신뢰도',
    dashboardSource: '출처',
    mvShort: 'MV',
    musicServices: {
      spotify: 'Spotify',
      youtube_music: 'YouTube Music',
      youtube_mv: 'YouTube MV',
    },
    handoffModeLabels: {
      canonical: '바로 열기',
      search: '검색 결과 열기',
    },
    handoffHint: '모바일에서는 설치된 앱 열기를 먼저 시도하고, 불가능하면 같은 서비스의 웹 페이지로 안전하게 이동합니다.',
    recentFeed: '최근 피드',
    newestReleasesFirst: '최신 발매 순',
    dataState: '데이터 상태',
    pipelineNotes: '파이프라인 메모',
    latestVerified: '가장 최근 검증',
    earliestInRange: '범위 내 가장 이른 날짜',
    openQuestions: '추가 확인 필요',
    none: '없음',
    streamLabels: {
      song: '곡',
      album: '앨범',
    },
    releaseKindLabels: {
      single: '싱글',
      album: '앨범',
      ep: 'EP',
    },
    contextTagLabels: {
      pre_release: '선공개',
      title_track: '타이틀',
      ost: 'OST',
      collab: '콜라보',
      japanese_release: '일본 발매',
      special_project: '스페셜',
    },
    sourceTypeLabels: {
      agency_notice: '기획사 공지',
      weverse_notice: '위버스 공지',
      news_rss: '기사 RSS',
      database: '데이터베이스',
      pending: '출처 확인 중',
    },
    dateStatusLabels: {
      confirmed: '확정',
      scheduled: '예정',
      rumor: '루머',
    },
    confidenceToneLabels: {
      high: '높음',
      medium: '보통',
      low: '낮음',
    },
    changeTypeLabels: {
      scheduled_date_added: '날짜 추가',
      scheduled_date_changed: '날짜 변경',
      date_status_changed: '상태 변경',
      headline_changed: '헤드라인 변경',
      verified_release_detected: '검증 발매 감지',
    },
    timelineEventLabels: {
      first_signal: '첫 신호',
      official_announcement: '공식 공지',
      tracklist_reveal: '트랙리스트 공개',
      date_update: '날짜 업데이트',
      release_verified: '검증된 발매',
    },
    watchReasonLabels: {
      recent_release: '최근 발매',
      long_gap: '장기 공백',
      manual_watch: '수동 관찰',
    },
    longGapRadar: '장기 공백 레이더',
    longGapRadarTitle: '오래 비어 있던 팀을 따로 추적',
    longGapRadarEmpty: '검색 조건에 맞는 장기 공백 대상이 없습니다.',
    longGapLastRelease: '마지막 발매',
    longGapElapsed: '경과',
    longGapSignalPresent: '예정 신호 있음',
    longGapSignalMissing: '예정 신호 없음',
    longGapLatestSignal: '최근 신호',
    longGapLatestSignalEmpty: '아직 표시할 신호가 없습니다.',
    rookieRadar: '루키 레이더',
    rookieRadarTitle: '신규·롱테일 팀을 따로 본다',
    rookieRadarEmpty: '검색 조건에 맞는 루키 대상이 없습니다.',
    rookieBadge: '루키',
    rookieDebutYear: '데뷔 연도',
    rookieLatestRelease: '최근 발매',
    rookieSignalPresent: '예정 신호 있음',
    rookieSignalMissing: '예정 신호 없음',
    rookieLatestSignal: '최근 신호',
    rookieLatestSignalEmpty: '아직 포착된 예정 신호가 없습니다.',
    sectionNavigator: '섹션 이동',
    sectionNavigatorHint: '긴 페이지에서 원하는 블록으로 바로 이동합니다.',
    sectionNavigatorToggle: '목차',
    sectionNavigatorWeekly: '이번 주',
    sectionNavigatorCalendar: '캘린더',
    sectionNavigatorDashboard: '대시보드',
    sectionNavigatorAgency: '소속사',
    sectionNavigatorUpcoming: '예정 스캔',
    sectionNavigatorRadar: '레이더',
    sectionNavigatorFeed: '최근 피드',
  },
  en: {
    locale: 'en-US',
    eyebrow: 'K-pop Release Calendar',
    heroTitle: 'Calendar UI plus a weekly comeback-intelligence cycle.',
    heroText:
      'Verified releases stay in the calendar. A wider watchlist keeps filtered and dormant teams in circulation, then a weekly scan looks for future comeback signals from news and official source trails.',
    languageLabel: 'Language',
    languageNames: { ko: 'Korean', en: 'English' },
    monthlyContextLabel: 'Monthly context',
    monthlySummaryLabels: {
      verified: 'This month releases',
      scheduled: 'Scheduled comebacks',
      nearest: 'Closest schedule',
    },
    searchSummaryLabels: {
      teams: 'Teams',
      releases: 'Releases',
      upcoming: 'Upcoming',
    },
    monthlyNearestEmpty: 'No exact date',
    monthlyHighlightLabel: 'Closest schedule',
    monthlyHighlightEmpty: 'No exact-date scheduled comebacks match this month and filter state.',
    monthlyHighlightUndatedOnly: 'Only month-level undated signals remain for this month. Check the monthly list below.',
    searchResultsLabel: 'Search results',
    searchResultsSpotlightLabel: 'Top matches',
    searchResultsEmptyTitle: 'No search results',
    searchResultsEmptyBody: 'If an exact name still returns nothing, we should inspect the API response or alias coverage again.',
    searchResultsEntityLabel: 'Team',
    searchResultsReleaseLabel: 'Release',
    searchResultsUpcomingLabel: 'Upcoming',
    searchResultsMatchedAliasLabel: 'Matched',
    stats: {
      verifiedReleases: 'Verified releases',
      watchTargets: 'Watch targets',
      upcomingSignals: 'Upcoming signals',
      needsReview: 'Needs review',
    },
    monthlyGrid: 'Monthly grid',
    calendarQuickJumpLabel: 'Quick jump',
    calendarQuickJumpToday: 'Today',
    calendarQuickJumpNearest: 'Closest schedule',
    calendarQuickJumpUnavailable: 'No jump target',
    calendarQuickJumpSourceLabels: {
      today: 'Current real date',
      upcoming: 'Future exact date first',
      current_month: 'Current month fallback',
      verified: 'Latest verified fallback',
    },
    prev: 'Prev',
    next: 'Next',
    searchLabel: 'Search group, song, or album',
    searchShort: 'Search',
    searchPlaceholder: 'BLACKPINK, Hearts2Hearts, DEADLINE, RUDE!...',
    searchBackendLoading: 'Checking backend /v1/search results now.',
    searchBackendActive: 'Search results are currently coming from the backend /v1/search response.',
    searchBridgeActive: 'Search results are currently being shown from the embedded local dataset.',
    searchBackendFallback:
      'The backend search response was unavailable. Runtime search fallback is disabled.',
    searchBackendTimeout:
      'The backend /v1/search request timed out. Runtime search fallback is disabled.',
    calendarBackendLoading: 'Checking backend /v1/calendar/month now.',
    calendarBackendActive:
      'The monthly calendar and dashboard are currently using the backend /v1/calendar/month response.',
    calendarJsonActive: 'The monthly calendar and dashboard are currently being shown from the legacy JSON dataset.',
    calendarBackendFallback:
      'The backend calendar/month response was unavailable. The monthly calendar now runs backend-only.',
    calendarBackendTimeout:
      'The backend /v1/calendar/month request timed out. The monthly calendar now runs backend-only.',
    radarBackendLoading: 'Checking backend /v1/radar now.',
    radarBackendActive: 'The radar sections are currently using the backend /v1/radar response.',
    radarJsonActive: 'The radar sections are currently being shown from the legacy JSON dataset.',
    radarBackendFallback:
      'The backend radar response was unavailable. The radar sections now run backend-only.',
    radarBackendTimeout:
      'The backend /v1/radar request timed out. The radar sections now run backend-only.',
    surfaceSourceLabel: 'Source',
    surfaceReasonLabel: 'Reason',
    surfaceTraceLabel: 'Request ID',
      surfaceSourceModeLabels: {
        api: 'backend API',
        json: 'legacy JSON',
        backend_unavailable: 'backend unavailable',
      },
    surfaceFallbackReasonLabels: {
      timeout: 'timeout',
      network_error: 'network failure',
      not_found: 'not found / 404',
      stale_projection: 'stale projection',
      disallowed_origin: 'disallowed origin',
      invalid_request: 'invalid request',
      unknown: 'other backend error',
    },
    monthSummaryVerified: 'verified',
    monthSummaryScheduled: 'scheduled',
    filterLabels: {
      releaseKind: 'Release kind',
      actType: 'Act type',
      status: 'Status',
      agency: 'Agency',
      myTeams: 'My Teams',
    },
    myTeamsOnlyToggle: 'Only my teams',
    myTeamsOnlyHint: 'Narrow the calendar, upcoming lists, radar, and monthly dashboard to saved teams only.',
    myTeamsEmpty: 'No saved teams yet. Add them from a team page first.',
    agencyFilterExpand: 'Browse all agencies',
    agencyFilterCollapse: 'Collapse',
    filterOptions: {
      all: 'All',
      single: 'Single',
      album: 'Album',
      ep: 'EP',
      group: 'Group',
      solo: 'Solo',
      unit: 'Unit',
      verified: 'Verified',
      confirmed: 'Confirmed',
      scheduled: 'Scheduled',
      rumor: 'Rumor',
      agency_unknown: 'Unknown agency',
    },
    statusLabels: {
      recent_release: 'Recent release',
      filtered_out: 'Filtered but watched',
      needs_manual_review: 'Needs manual review',
      watch_only: 'Manual watch-only',
    },
    upcomingScan: 'Upcoming scan',
    upcomingTitle: 'Future comeback signals',
    noUpcomingCandidates: 'No upcoming candidates captured yet.',
    selectedDay: 'Selected day',
    noReleaseSelected: 'No date selected',
    noVerifiedRelease: 'No verified release or scheduled signal on this date.',
    selectedDayVerified: 'Verified releases',
    selectedDayScheduled: 'Scheduled comebacks',
    selectedDayVerifiedEmpty: 'No verified releases on this date.',
    selectedDayScheduledEmpty: 'No scheduled comebacks on this date.',
    shareCardLabel: 'Share card',
    shareCardTitle: 'One-day share snapshot',
    shareCardHint: 'Open native share, copy the summary text, or send the card below as a screenshot.',
    shareCardShare: 'Share',
    shareCardShareFallback: 'Copy share text',
    shareCardCopySummary: 'Copy summary',
    shareCardCopySuccess: 'Copied share text.',
    shareCardSummaryCopied: 'Copied summary.',
    shareCardUnavailable: 'Sharing and clipboard copy are unavailable in this browser.',
    shareCardBrand: 'Idol Song App',
    shareCardBrandServices: 'Spotify · YouTube Music · YouTube MV',
    shareCardCaptureHint: 'This card is tuned for browser share or a quick screenshot.',
    shareCardVerifiedEmpty: 'No verified releases to show',
    shareCardScheduledEmpty: 'No scheduled comebacks to show',
    noFilteredMatches: 'No monthly items match this search and filter combination.',
    releaseSource: 'Release source',
    artistSource: 'Artist source',
    sourceLink: 'Source link',
    noSourceLink: 'No source link',
    open: 'Open',
    monthlyDashboard: 'Monthly release dashboard',
    monthlyDashboardTitle: 'Scan the selected month in an index view.',
    monthlyDashboardMonth: 'Current month',
    monthlyDashboardFilters: 'Active filters',
    monthlyDashboardFiltersDefault: 'Using the header defaults',
    monthlyDashboardSort: 'Sort',
    monthlyDashboardVerifiedTitle: 'Verified releases',
    monthlyDashboardScheduledTitle: 'Scheduled comebacks',
    monthlyDashboardScheduledExactTitle: 'Exact-date comebacks',
    monthlyDashboardScheduledMonthOnlyTitle: 'Month-only signals',
    monthlyDashboardDatePending: 'Date TBA',
    monthlyDashboardVerifiedEmpty: 'No verified releases to show for this month.',
    monthlyDashboardScheduledEmpty: 'No scheduled comebacks to show for this month.',
    agencyView: 'Agency view',
    agencyViewTitle: 'Regroup the current month by agency.',
    agencyViewEmpty: 'No agency sections match the current month and filter state.',
    agencyViewVerifiedCount: 'Verified',
    agencyViewScheduledCount: 'Scheduled',
    weeklyDigest: 'This week must-listen',
    weeklyDigestTitle: 'A thin queue built from verified releases in the latest 7-day window.',
    weeklyDigestEmpty: 'No verified releases match the current filters inside the latest 7-day digest window.',
    weeklyDigestWindow: 'Window',
    weeklyDigestCards: 'Cards',
    dashboardTeam: 'Team',
    dashboardRelease: 'Release',
    dashboardLeadTrack: 'Lead track',
    dashboardFormat: 'Format',
    dashboardDate: 'Date',
    dashboardListen: 'Listen',
    dashboardActions: 'Actions',
    dashboardScheduledTitle: 'Scheduled title',
    dashboardStatus: 'Status',
    dashboardConfidence: 'Confidence',
    dashboardSource: 'Source',
    mvShort: 'MV',
    musicServices: {
      spotify: 'Spotify',
      youtube_music: 'YouTube Music',
      youtube_mv: 'YouTube MV',
    },
    handoffModeLabels: {
      canonical: 'Open direct link',
      search: 'Open search results',
    },
    handoffHint: 'On mobile, the app tries the installed service first and safely falls back to the web page when it cannot open it.',
    recentFeed: 'Recent feed',
    newestReleasesFirst: 'Newest releases first',
    dataState: 'Data state',
    pipelineNotes: 'Pipeline notes',
    latestVerified: 'Latest verified',
    earliestInRange: 'Earliest in range',
    openQuestions: 'Open questions',
    none: 'n/a',
    streamLabels: {
      song: 'song',
      album: 'album',
    },
    releaseKindLabels: {
      single: 'single',
      album: 'album',
      ep: 'ep',
    },
    contextTagLabels: {
      pre_release: 'pre-release',
      title_track: 'title track',
      ost: 'OST',
      collab: 'collab',
      japanese_release: 'Japanese release',
      special_project: 'special project',
    },
    sourceTypeLabels: {
      agency_notice: 'Agency notice',
      weverse_notice: 'Weverse notice',
      news_rss: 'News RSS',
      database: 'Database',
      pending: 'Source pending',
    },
    dateStatusLabels: {
      confirmed: 'confirmed',
      scheduled: 'scheduled',
      rumor: 'rumor',
    },
    confidenceToneLabels: {
      high: 'high',
      medium: 'medium',
      low: 'low',
    },
    changeTypeLabels: {
      scheduled_date_added: 'Date added',
      scheduled_date_changed: 'Date changed',
      date_status_changed: 'Status changed',
      headline_changed: 'Headline changed',
      verified_release_detected: 'Verified release',
    },
    timelineEventLabels: {
      first_signal: 'First signal',
      official_announcement: 'Official announcement',
      tracklist_reveal: 'Tracklist reveal',
      date_update: 'Date update',
      release_verified: 'Release verified',
    },
    watchReasonLabels: {
      recent_release: 'Recent release',
      long_gap: 'Long-gap',
      manual_watch: 'Manual watch',
    },
    longGapRadar: 'Long-gap radar',
    longGapRadarTitle: 'Track dormant teams in a separate view',
    longGapRadarEmpty: 'No long-gap targets match the current search.',
    longGapLastRelease: 'Last release',
    longGapElapsed: 'Elapsed',
    longGapSignalPresent: 'Upcoming signal',
    longGapSignalMissing: 'No upcoming signal',
    longGapLatestSignal: 'Latest signal',
    longGapLatestSignalEmpty: 'No captured signal to show yet.',
    rookieRadar: 'Rookie radar',
    rookieRadarTitle: 'Pull new and long-tail acts into one view',
    rookieRadarEmpty: 'No rookie targets match the current search.',
    rookieBadge: 'Rookie',
    rookieDebutYear: 'Debut year',
    rookieLatestRelease: 'Latest release',
    rookieSignalPresent: 'Upcoming signal',
    rookieSignalMissing: 'No upcoming signal',
    rookieLatestSignal: 'Latest signal',
    rookieLatestSignalEmpty: 'No captured upcoming signal yet.',
    sectionNavigator: 'Jump to sections',
    sectionNavigatorHint: 'Use a lightweight navigator to jump between major blocks.',
    sectionNavigatorToggle: 'Sections',
    sectionNavigatorWeekly: 'This week',
    sectionNavigatorCalendar: 'Calendar',
    sectionNavigatorDashboard: 'Dashboard',
    sectionNavigatorAgency: 'Agency',
    sectionNavigatorUpcoming: 'Upcoming',
    sectionNavigatorRadar: 'Radar',
    sectionNavigatorFeed: 'Feed',
  },
} as const

const TEAM_COPY = {
  ko: {
    action: '팀 페이지',
    back: '대시보드로',
    pinAction: '관심 팀 추가',
    unpinAction: '관심 팀 해제',
    pinnedLabel: '관심 팀',
    pinLimitReached: '관심 팀은 최대 20개까지 저장할 수 있습니다.',
    panelLabel: '팀 페이지',
    intro:
      '해당 팀의 컴백 신호를 먼저 보고, 최신 발매와 앨범 상세를 같은 화면에서 바로 확인할 수 있습니다.',
    agencyHint: '소속 힌트',
    latestReleaseDate: '최근 발매일',
    comebackStatus: '컴백 상태',
    tier: '티어',
    representativeImage: '팀 마크 소스',
    generatedMark: '모노그램 fallback',
    badgeSourceLink: '배지 출처',
    footnote:
      '공식 badge/avatar가 있으면 우선 사용하고, 없을 때만 대표 이미지나 모노그램 fallback으로 내려갑니다.',
    backendLoading: 'backend /v1/entities 응답을 불러오는 중입니다.',
    backendActive: '이 팀 페이지는 backend /v1/entities 응답을 우선 사용 중입니다.',
    bridgeActive: '이 팀 페이지는 read bridge snapshot으로 표시 중입니다.',
    backendFallback: '이 팀 페이지는 backend 응답을 불러오지 못해 표시가 제한됩니다.',
    backendUnavailable: 'backend 팀 페이지 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    backendTimeout: 'backend 팀 페이지 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
    backendNotFound: 'backend에 이 팀의 detail payload가 아직 준비되지 않았습니다.',
    backendLoadingBody: '팀 상세 데이터를 backend에서 읽어오는 중입니다.',
    bridgeActiveBody: '현재 이 팀 상세는 read bridge snapshot을 기준으로 표시 중입니다.',
    backendFallbackBody: '현재 이 팀 상세는 backend 응답을 불러오지 못해 표시가 제한됩니다.',
    backendUnavailableBody: '팀 상세 데이터를 지금은 표시할 수 없습니다. API 응답이 복구되면 다시 열어 주세요.',
    backendNotFoundBody: '이 팀의 backend detail payload가 아직 준비되지 않아 상세 화면을 표시할 수 없습니다.',
    upcomingLabel: '예정 컴백',
    upcomingTitle: '예정 신호 우선 보기',
    upcomingEmptyTitle: '아직 컴백 신호 없음',
    upcomingEmpty: '이 팀에 대해 수집된 예정/루머 신호가 아직 없습니다.',
    latestLabel: '최신 발매',
    latestEmptyTitle: '검증된 최신 발매 없음',
    verifiedRelease: '검증된 발매',
    watchlistFallback: '워치리스트 기준',
    releaseSourcePending: '발매 출처 준비 중',
    recentAlbumsLabel: '최근 앨범',
    recentAlbumsTitle: '앨범 카드는 전용 상세 페이지로 이동합니다.',
    recentAlbumsEmptyTitle: '앨범 카드 없음',
    recentAlbumsEmpty: '검증된 앨범 또는 EP가 아직 없습니다.',
    openAlbumDetail: '앨범 상세 페이지 열기',
    releaseDetail: '릴리즈 상세',
    releasePageBack: '이전으로',
    quickJumpLabel: '빠른 이동',
    quickJumpTitle: '다른 추적 팀',
    noOtherTeams: '다른 필터된 팀이 없습니다.',
    noSignal: '신호 없음',
    relatedActsLabel: '관련 팀 추천',
    relatedActsTitle: '비슷한 결로 바로 이동',
    relatedActsEmpty: '추천할 관련 팀 데이터가 아직 충분하지 않습니다.',
    relatedActsReasonAgency: '같은 소속사',
    relatedActsReasonType: '같은 유형',
    relatedActsReasonRadarTag: '같은 레이더 태그',
    relatedActsReasonManual: '수동 추천',
    compareAction: '비교',
    compareHelperLabel: '2팀 비교',
    compareHelperTitle: 'compare with',
    compareHelperHint: '다른 팀 하나를 고르면 query 기반 비교 화면을 바로 엽니다.',
    compareSelectLabel: '비교할 팀',
    compareSelectPlaceholder: '팀 선택',
    compareClear: '비교 닫기',
    compareViewLabel: '2팀 비교',
    compareViewTitle: '핵심 릴리즈와 예정 신호를 나란히 봅니다.',
    compareMetricLatestVerified: '최근 verified release',
    compareMetricLatestAlbumSong: '최신 album vs latest song',
    compareMetricUpcoming: '예정 comeback signal',
    compareMetricYearCount: '최근 1년 release count',
    compareNoRelease: 'verified release 없음',
    compareNoAlbum: 'album 없음',
    compareNoSong: 'song 없음',
    compareNoUpcoming: '예정 신호 없음',
    timelineLabel: '소스 타임라인',
    timelineTitle: '컴백 근거가 쌓인 순서',
    timelineIntro: '예정 신호와 검증된 발매를 같은 타임라인에서 봅니다.',
    timelineEmptyTitle: '타임라인 근거 없음',
    timelineEmpty: '예정 신호나 검증된 발매 출처가 아직 충분하지 않습니다.',
    annualTimelineLabel: '연간 릴리즈 타임라인',
    annualTimelineTitle: '연도별 verified release 흐름',
    annualTimelineIntro: 'verified release를 연도 기준으로 묶고, 현재 연도의 예정 컴백은 보조 marker로 덧붙입니다.',
    annualTimelineEmptyTitle: '연간 릴리즈 타임라인 없음',
    annualTimelineEmpty: '표시할 verified release 히스토리가 아직 충분하지 않습니다.',
    annualTimelineReleaseMarker: '릴리즈',
    annualTimelineScheduledMarker: '예정 마커',
    changeLogLabel: '변경 로그',
    changeLogTitle: '최근 일정/상태 변동',
    changeLogIntro: '스냅샷 비교로 감지한 최근 변경입니다.',
    changeLogEmptyTitle: '최근 변동 없음',
    changeLogEmpty: '기록된 일정/상태 변경이 아직 없습니다.',
    pagesPanelLabel: '팀 페이지',
    pagesPanelTitle: '추적 팀 열기',
    noTeamMatch: '이 검색어와 일치하는 추적 팀이 없습니다.',
    albumDetail: '앨범 상세',
    close: '닫기',
    team: '팀',
    releaseKind: '발매 종류',
    releaseDate: '발매일',
    stream: '스트림',
    trackPreview: '트랙리스트',
    trackPreviewHint: '실제 canonical track 데이터가 있을 때만 트랙리스트를 표시합니다.',
    trackDataIncompleteTitle: '트랙 메타데이터 미완료',
    trackDataIncomplete: '이 릴리즈에는 신뢰 가능한 canonical tracklist가 아직 연결되지 않았습니다. placeholder 트랙은 표시하지 않습니다.',
    releaseNotes: '릴리즈 메모',
    releaseEnrichment: '보조 메타데이터',
    releaseEnrichmentHint: 'v1은 수동 seed 기반 크레딧, 차트, 메모를 연결합니다.',
    releaseEnrichmentEmpty: '이 릴리즈에 연결된 보조 메타데이터가 아직 없습니다.',
    lyricsCredits: '작사',
    compositionCredits: '작곡',
    arrangementCredits: '편곡',
    chartHighlights: '차트',
    metadataNotes: '메타데이터 노트',
    officialMv: '공식 MV',
    officialMvHint: '보조 영상 콘텐츠입니다. 앱 안 직접 재생 기능이 아니라 공식 YouTube MV를 임베드합니다.',
    officialMvLinkOnly: '임베드가 준비되지 않으면 YouTube 링크만 노출합니다.',
    officialMvUnavailable: '신뢰 가능한 공식 YouTube MV target이 아직 없어 임베드를 표시하지 않습니다.',
    releaseDetailBackendLoading:
      '백엔드 release-detail 응답을 불러오는 중입니다.',
    releaseDetailBackendActive: '이 상세 페이지는 backend release-detail 응답을 우선 사용 중입니다.',
    releaseDetailBridgeActive: '이 상세 페이지는 read bridge snapshot으로 표시 중입니다.',
    releaseDetailBackendUnavailable:
      '백엔드 release-detail 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    releaseDetailBackendTimeout:
      '백엔드 release-detail 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
    releaseDetailBackendNotFound:
      '백엔드에 이 릴리즈의 detail payload가 아직 없습니다.',
    releaseDetailBackendFallback:
      '이 상세 페이지는 backend 응답을 불러오지 못해 표시가 제한됩니다.',
    watchOnYouTube: 'YouTube에서 보기',
    placeholderCover: '릴리즈 아트워크',
    drawerCopy:
      '릴리즈 상세는 전용 페이지로 열려 팀 페이지, 캘린더, 대시보드 어느 진입점에서도 같은 경로를 사용합니다.',
    appleMusicNext: 'Apple Music 다음 이슈',
    spotifyNext: 'Spotify 다음 이슈',
    latestNow: '현재 가장 최근 검증 발매',
  },
  en: {
    action: 'Team page',
    back: 'Back to dashboard',
    pinAction: 'Add to My Teams',
    unpinAction: 'Remove from My Teams',
    pinnedLabel: 'My Team',
    pinLimitReached: 'You can save up to 20 teams.',
    panelLabel: 'Team page',
    intro:
      'See comeback signals first, then move into the latest release and album detail without leaving the same view.',
    agencyHint: 'Agency hint',
    latestReleaseDate: 'Latest release date',
    comebackStatus: 'Comeback status',
    tier: 'Tier',
    representativeImage: 'Team mark source',
    generatedMark: 'Monogram fallback',
    badgeSourceLink: 'Badge source',
    footnote:
      'Use an official badge/avatar first, then fall back to a representative image or monogram only when no sourced asset exists.',
    backendLoading: 'Loading the backend /v1/entities response now.',
    backendActive: 'This team page is currently using the backend /v1/entities response.',
    bridgeActive: 'This team page is currently being rendered from the read-bridge snapshot.',
    backendFallback: 'This team page is degraded because the backend response is unavailable.',
    backendUnavailable: 'The backend team-detail response is unavailable right now. Please try again shortly.',
    backendTimeout: 'The backend team-detail request timed out. Please try again shortly.',
    backendNotFound: 'The backend does not have a detail payload for this team yet.',
    backendLoadingBody: 'Loading the team detail from the backend now.',
    bridgeActiveBody: 'This team detail is currently being rendered from the read-bridge snapshot.',
    backendFallbackBody: 'This team detail is degraded because the backend response is unavailable.',
    backendUnavailableBody: 'The team detail cannot be shown right now because the backend response is unavailable.',
    backendNotFoundBody: 'This team does not have a backend detail payload yet, so the detail screen cannot be rendered.',
    upcomingLabel: 'Upcoming comeback',
    upcomingTitle: 'Scheduled signals first',
    upcomingEmptyTitle: 'No comeback signal yet',
    upcomingEmpty: 'No scheduled or rumor signals have been captured for this team yet.',
    latestLabel: 'Latest release',
    latestEmptyTitle: 'No verified latest release',
    verifiedRelease: 'Verified release',
    watchlistFallback: 'Watchlist fallback',
    releaseSourcePending: 'Release source pending',
    recentAlbumsLabel: 'Recent albums',
    recentAlbumsTitle: 'Album cards open a dedicated detail page.',
    recentAlbumsEmptyTitle: 'No album card yet',
    recentAlbumsEmpty: 'No verified album or EP is available for this team yet.',
    openAlbumDetail: 'Open album detail page',
    releaseDetail: 'Release detail',
    releasePageBack: 'Back',
    quickJumpLabel: 'Quick jump',
    quickJumpTitle: 'Other tracked teams',
    noOtherTeams: 'No other filtered teams available.',
    noSignal: 'No signal',
    relatedActsLabel: 'Related acts',
    relatedActsTitle: 'Jump into adjacent acts',
    relatedActsEmpty: 'There is not enough related-act data to recommend another team yet.',
    relatedActsReasonAgency: 'Same agency',
    relatedActsReasonType: 'Same type',
    relatedActsReasonRadarTag: 'Same radar tag',
    relatedActsReasonManual: 'Manual pick',
    compareAction: 'Compare',
    compareHelperLabel: '2-team compare',
    compareHelperTitle: 'Compare with',
    compareHelperHint: 'Pick one other team to open the query-based compare view.',
    compareSelectLabel: 'Team to compare',
    compareSelectPlaceholder: 'Select a team',
    compareClear: 'Close compare',
    compareViewLabel: '2-team compare',
    compareViewTitle: 'See key release and upcoming signal blocks side by side.',
    compareMetricLatestVerified: 'Latest verified release',
    compareMetricLatestAlbumSong: 'Latest album vs latest song',
    compareMetricUpcoming: 'Upcoming comeback signal',
    compareMetricYearCount: 'Recent 1-year release count',
    compareNoRelease: 'No verified release',
    compareNoAlbum: 'No album yet',
    compareNoSong: 'No song yet',
    compareNoUpcoming: 'No upcoming signal',
    timelineLabel: 'Source timeline',
    timelineTitle: 'How the comeback evidence built up',
    timelineIntro: 'Scheduled signals and verified releases share one evidence trail.',
    timelineEmptyTitle: 'No timeline evidence yet',
    timelineEmpty: 'There is not enough scheduled or verified source evidence for this team yet.',
    annualTimelineLabel: 'Annual release timeline',
    annualTimelineTitle: 'Verified release flow by year',
    annualTimelineIntro: 'Group verified releases by year and add the current-year scheduled comeback as an optional marker.',
    annualTimelineEmptyTitle: 'No annual release timeline yet',
    annualTimelineEmpty: 'There is not enough verified release history to show a yearly timeline yet.',
    annualTimelineReleaseMarker: 'Release',
    annualTimelineScheduledMarker: 'Scheduled marker',
    changeLogLabel: 'Change log',
    changeLogTitle: 'Recent schedule and state changes',
    changeLogIntro: 'Detected from snapshot-to-snapshot comparisons.',
    changeLogEmptyTitle: 'No recent changes',
    changeLogEmpty: 'No schedule or state change has been recorded for this team yet.',
    pagesPanelLabel: 'Team pages',
    pagesPanelTitle: 'Open a tracked team',
    noTeamMatch: 'No tracked team matches this search.',
    albumDetail: 'Album detail',
    close: 'Close',
    team: 'Team',
    releaseKind: 'Release kind',
    releaseDate: 'Release date',
    stream: 'Stream',
    trackPreview: 'Tracklist',
    trackPreviewHint: 'Show the tracklist only when canonical track data exists.',
    trackDataIncompleteTitle: 'Track metadata incomplete',
    trackDataIncomplete: 'No reliable canonical tracklist is attached to this release yet, so this page does not fabricate placeholder tracks.',
    releaseNotes: 'Release notes',
    releaseEnrichment: 'Release enrichment',
    releaseEnrichmentHint: 'v1 connects manual seed credits, charts, and notes.',
    releaseEnrichmentEmpty: 'No seeded enrichment is attached to this release yet.',
    lyricsCredits: 'Lyrics',
    compositionCredits: 'Composition',
    arrangementCredits: 'Arrangement',
    chartHighlights: 'Charts',
    metadataNotes: 'Metadata notes',
    officialMv: 'Official MV',
    officialMvHint: 'This is supporting video content, not in-app audio playback. It embeds the official YouTube MV only when metadata is explicit.',
    officialMvLinkOnly: 'If embedding is unavailable, the page falls back to a YouTube link only.',
    officialMvUnavailable: 'No reliable official YouTube MV target is attached yet, so this page does not render an embed.',
    releaseDetailBackendLoading:
      'Loading the backend release-detail response now.',
    releaseDetailBackendActive: 'This detail page is currently using the backend release-detail response.',
    releaseDetailBridgeActive: 'This detail page is currently being rendered from the read-bridge snapshot.',
    releaseDetailBackendUnavailable:
      'The backend release-detail response is unavailable right now. Please try again shortly.',
    releaseDetailBackendTimeout:
      'The backend release-detail request timed out. Please try again shortly.',
    releaseDetailBackendNotFound:
      'The backend does not have a detail payload for this release yet.',
    releaseDetailBackendFallback:
      'This detail page is degraded because the backend response is unavailable.',
    watchOnYouTube: 'Watch on YouTube',
    placeholderCover: 'Release artwork',
    drawerCopy:
      'Release detail now uses a dedicated page route so the same path works from team pages, the calendar, and dashboard entries.',
    appleMusicNext: 'Apple Music next',
    spotifyNext: 'Spotify next',
    latestNow: 'Latest verified release right now',
  },
} as const

function getSurfaceStatusLabels(language: Language) {
  const copy = TRANSLATIONS[language]
  return {
    sourceLabel: copy.surfaceSourceLabel,
    reasonLabel: copy.surfaceReasonLabel,
    traceLabel: copy.surfaceTraceLabel,
    sourceStateLabels: copy.surfaceSourceModeLabels,
    fallbackReasonLabels: copy.surfaceFallbackReasonLabels,
  }
}

function getSurfaceStatusTone(source: SurfaceStatusSource, errorCode: string | null) {
  if (source === 'backend_unavailable' || errorCode) {
    return 'degraded'
  }

  if (source === 'api') {
    return 'api'
  }

  return 'json'
}

function SurfaceRuntimeStatus({
  language,
  source,
  errorCode,
  traceId,
  message,
  className,
}: {
  language: Language
  source: SurfaceStatusSource
  errorCode: string | null
  traceId?: string | null
  message: string
  className?: string
}) {
  const labels = getSurfaceStatusLabels(language)
  const reasonKey = errorCode ? getSurfaceFallbackReasonKey(errorCode) : null
  const tone = getSurfaceStatusTone(source, errorCode)

  return (
    <div className={['surface-runtime-status', `surface-runtime-status-${tone}`, className].filter(Boolean).join(' ')}>
      <p className="surface-runtime-status-message">{message}</p>
      <div className="surface-runtime-status-meta">
        <span className="surface-runtime-chip">
          <strong>{labels.sourceLabel}</strong>
          <span>{labels.sourceStateLabels[source]}</span>
        </span>
        {reasonKey ? (
          <span className="surface-runtime-chip surface-runtime-chip-warn">
            <strong>{labels.reasonLabel}</strong>
            <span>{labels.fallbackReasonLabels[reasonKey]}</span>
          </span>
        ) : null}
        {traceId ? (
          <span className="surface-runtime-chip surface-runtime-chip-trace">
            <strong>{labels.traceLabel}</strong>
            <code>{traceId}</code>
          </span>
        ) : null}
      </div>
    </div>
  )
}

const UPCOMING_MONTH_FORMATTERS: Record<Language, Intl.DateTimeFormat> = {
  ko: new Intl.DateTimeFormat(TRANSLATIONS.ko.locale, {
    year: 'numeric',
    month: 'long',
  }),
  en: new Intl.DateTimeFormat(TRANSLATIONS.en.locale, {
    year: 'numeric',
    month: 'long',
  }),
}

const releaseKindOptions = ['all', 'single', 'album', 'ep'] as const
const actTypeOptions = ['all', 'group', 'solo', 'unit'] as const
const dashboardStatusOptions = ['all', 'verified', 'confirmed', 'scheduled', 'rumor'] as const
const unitGroups = new Set(['ARTMS', 'NCT DREAM', 'NCT WISH', 'VIVIZ'])
const RELEASE_ARTWORK_PLACEHOLDER_URL = '/release-placeholder.svg'
const AGENCY_UNKNOWN_FILTER = 'agency_unknown'
const APP_BASE_URL = ((import.meta.env.BASE_URL ?? '/').trim() || '/').replace(/\/?$/, '/')
const BACKEND_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
const BACKEND_TARGET_ENV = normalizeBackendTargetEnvironment(import.meta.env.VITE_BACKEND_TARGET_ENV)
const PAGES_READ_BRIDGE_BASE_URL = `${APP_BASE_URL.replace(/\/$/, '')}/__bridge/v1`
const BACKEND_TARGET_DIAGNOSTICS_PATH = `${APP_BASE_URL.replace(/\/$/, '')}/__bridge/v1/meta/backend-target.json`
const ACTIVE_WEB_BACKEND_TARGET = BACKEND_API_BASE_URL || PAGES_READ_BRIDGE_BASE_URL
const ACTIVE_WEB_BACKEND_TARGET_MODE: 'api' | 'bridge' = BACKEND_API_BASE_URL ? 'api' : 'bridge'
const ACTIVE_WEB_BACKEND_TARGET_CLASSIFICATION = classifyBackendTarget(BACKEND_API_BASE_URL)
const ACTIVE_WEB_BACKEND_TARGET_ENVIRONMENT: BackendTargetEnvironment =
  BACKEND_TARGET_ENV || (BACKEND_API_BASE_URL ? ACTIVE_WEB_BACKEND_TARGET_CLASSIFICATION : 'bridge')
const BRIDGE_TARGET_REFRESH_TIMEOUT_MS = 3_000
const BRIDGE_TARGET_REFRESH_INTERVAL_MS = 60_000
const BRIDGE_TARGET_GENERATION_STORAGE_KEY = 'idol-song-app.bridge-generated-at'
const releaseDetailApiIdCache = new Map<string, string>()
const releaseDetailApiSnapshotCache = new Map<string, ReleaseDetailApiSnapshot>()
const searchSurfaceApiSnapshotCache = new Map<string, SearchSurfaceSnapshot>()
const entityDetailApiSnapshotCache = new Map<string, TeamProfile>()
const calendarMonthApiSnapshotCache = new Map<string, CalendarMonthApiSnapshot>()
const radarApiSnapshotCache = new Map<string, RadarApiSnapshot>()
const CURRENT_KST_ISO = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const artistProfiles: ArtistProfileRow[] = []
const teamBadgeAssets: TeamBadgeAssetRow[] = []
const releaseArtworkCatalog: ReleaseArtworkRow[] = []
const releaseDetailsCatalog: ReleaseDetailRow[] = []
const releaseHistoryCatalog: ReleaseHistorySeedRow[] = []
const releaseCatalog: ReleaseRow[] = []
const relatedActOverrides: RelatedActsOverrideRow[] = []
const releases: VerifiedRelease[] = []
const unresolved: UnresolvedRow[] = []
const watchlist: WatchlistRow[] = []
const upcomingCandidates: UpcomingCandidateRow[] = []
const dedupedUpcomingCandidates: UpcomingCandidateRow[] = []
const releaseChangeLog: ReleaseChangeLogRow[] = []
const youtubeChannelAllowlists: YouTubeChannelAllowlistRow[] = []
const teamBadgeAssetByGroup = new Map<string, TeamBadgeAssetRow>()
const releaseCatalogByGroup = new Map<string, ReleaseRow>()
const artistProfileByGroup = new Map<string, ArtistProfileRow>()
const artistProfileBySlug = new Map<string, ArtistProfileRow>()
const youtubeChannelAllowlistByGroup = new Map<string, YouTubeChannelAllowlistRow>()
const releaseGroups = new Map<string, VerifiedRelease[]>()
const verifiedReleaseHistory = [] as VerifiedRelease[]
const verifiedReleaseHistoryByGroup = new Map<string, VerifiedRelease[]>()
const watchlistByGroup = new Map<string, WatchlistRow>()
const relatedActOverrideMap = new Map<string, string[]>()
const rawUpcomingByGroup = new Map<string, UpcomingCandidateRow[]>()
const upcomingByGroup = new Map<string, UpcomingCandidateRow[]>()
const releaseChangeLogByGroup = new Map<string, ReleaseChangeLogRow[]>()
const latestReleaseChangeByGroup = new Map<string, ReleaseChangeLogRow | null>()
const searchIndexByGroup = new Map<string, SearchIndex>()
const teamProfiles: TeamProfile[] = []
const teamProfileMap = new Map<string, TeamProfile>()
const relatedActsByGroup = new Map<string, RelatedActRecommendation[]>()

// Transitional placeholders kept only until the backend-native file split lands.
void [
  teamBadgeAssets,
  releaseArtworkCatalog,
  releaseHistoryCatalog,
  relatedActOverrides,
  unresolved,
  dedupedUpcomingCandidates,
  releaseChangeLog,
  youtubeChannelAllowlists,
  artistProfileBySlug,
  verifiedReleaseHistory,
  searchIndexByGroup,
  relatedActsByGroup,
]

type BackendTargetDiagnosticsResponse = {
  data?: {
    generated_at?: string | null
    runtime_mode?: string | null
    effective_target?: string | null
  }
  error?: {
    code?: string | null
  }
}

function clearSurfaceApiSnapshotCaches() {
  releaseDetailApiIdCache.clear()
  releaseDetailApiSnapshotCache.clear()
  searchSurfaceApiSnapshotCache.clear()
  entityDetailApiSnapshotCache.clear()
  calendarMonthApiSnapshotCache.clear()
  radarApiSnapshotCache.clear()
}

function readStoredBridgeGeneration() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.sessionStorage.getItem(BRIDGE_TARGET_GENERATION_STORAGE_KEY)
    return readNonEmptyString(value)
  } catch {
    return null
  }
}

function storeBridgeGeneration(value: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(BRIDGE_TARGET_GENERATION_STORAGE_KEY, value)
  } catch {
    // Ignore storage failures and keep runtime refresh best-effort.
  }
}

async function fetchBridgeTargetDiagnostics(
  signal: AbortSignal,
): Promise<{
  generatedAt: string | null
  runtimeMode: string | null
  effectiveTarget: string | null
  errorCode: string | null
  traceId: string | null
}> {
  const cacheBust = `ts=${Date.now().toString(36)}`
  const result = await fetchJsonWithTimeout<BackendTargetDiagnosticsResponse>(
    `${BACKEND_TARGET_DIAGNOSTICS_PATH}${BACKEND_TARGET_DIAGNOSTICS_PATH.includes('?') ? '&' : '?'}${cacheBust}`,
    {
      headers: {
        Accept: 'application/json',
      },
      requestIdPrefix: 'web-bridge-target',
      signal,
      timeoutMs: BRIDGE_TARGET_REFRESH_TIMEOUT_MS,
    },
  )

  if (!result.ok || !result.body?.data) {
    return {
      generatedAt: null,
      runtimeMode: null,
      effectiveTarget: null,
      errorCode: result.body?.error?.code ?? `bridge_target_${result.status}`,
      traceId: result.responseRequestId ?? result.requestId,
    }
  }

  return {
    generatedAt: readNonEmptyString(result.body.data.generated_at),
    runtimeMode: readNonEmptyString(result.body.data.runtime_mode),
    effectiveTarget: readNonEmptyString(result.body.data.effective_target),
    errorCode: null,
    traceId: result.responseRequestId ?? result.requestId,
  }
}

function useRuntimeDeploymentRefresh() {
  const initialGeneration = readStoredBridgeGeneration()
  const generationRef = useRef<string | null>(initialGeneration)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    let cancelled = false

    const syncGeneration = async (reloadOnChange: boolean) => {
      const controller = new AbortController()
      try {
        const { generatedAt, runtimeMode, effectiveTarget } = await fetchBridgeTargetDiagnostics(controller.signal)
        if (cancelled || !generatedAt) {
          return
        }

        const previousGeneration = generationRef.current
        generationRef.current = generatedAt
        storeBridgeGeneration(generatedAt)

        const shouldReload = shouldReloadForRuntimeRefresh({
          previousGeneration,
          nextGeneration: generatedAt,
          currentRuntimeMode: ACTIVE_WEB_BACKEND_TARGET_MODE,
          currentEffectiveTarget: ACTIVE_WEB_BACKEND_TARGET,
          diagnosticsRuntimeMode: runtimeMode,
          diagnosticsEffectiveTarget: effectiveTarget,
        })

        if (!shouldReload) {
          return
        }

        clearSurfaceApiSnapshotCaches()
        if (reloadOnChange) {
          window.location.reload()
        }
      } catch {
        // Ignore bridge refresh failures and keep current runtime alive.
      }
    }

    void syncGeneration(false)

    const handleFocus = () => {
      void syncGeneration(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncGeneration(true)
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncGeneration(true)
      }
    }, BRIDGE_TARGET_REFRESH_INTERVAL_MS)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}

function App() {
  useRuntimeDeploymentRefresh()
  const latestMonthKey = CURRENT_KST_ISO.slice(0, 7)
  const [selectedMonthKey, setSelectedMonthKey] = useState(latestMonthKey)
  const [selectedDayIso, setSelectedDayIso] = useState('')
  const [search, setSearch] = useState('')
  const [selectedReleaseKind, setSelectedReleaseKind] = useState<(typeof releaseKindOptions)[number]>('all')
  const [selectedActType, setSelectedActType] = useState<(typeof actTypeOptions)[number]>('all')
  const [selectedDashboardStatus, setSelectedDashboardStatus] = useState<(typeof dashboardStatusOptions)[number]>('all')
  const [selectedAgency, setSelectedAgency] = useState<string>('all')
  const [myTeams, setMyTeams] = useState<string[]>(readInitialMyTeams)
  const [selectedMyTeamsOnly, setSelectedMyTeamsOnly] = useState(false)
  const [language, setLanguage] = useState<Language>(readInitialLanguage)
  const [selectedEntitySlug, setSelectedEntitySlug] = useState<string | null>(readSelectedEntitySlugFromLocation)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(readSelectedGroupFromLocation)
  const [selectedCompareGroup, setSelectedCompareGroup] = useState<string | null>(readSelectedCompareGroupFromLocation)
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(readSelectedReleaseKeyFromLocation)
  const [selectedReleaseRouteSelection, setSelectedReleaseRouteSelection] = useState<ReleaseRouteSelection | null>(
    readSelectedReleaseRouteSelectionFromLocation,
  )
  const [showBackendTargetInspection, setShowBackendTargetInspection] = useState(readBackendTargetInspectionFromLocation)
  const [selectedDayInteractionTick, setSelectedDayInteractionTick] = useState(0)
  const [desktopUpcomingPanelHeight, setDesktopUpcomingPanelHeight] = useState<number | null>(null)
  const calendarPanelRef = useRef<HTMLElement | null>(null)
  const selectedDayPanelRef = useRef<HTMLElement | null>(null)
  const activeCompareGroup =
    selectedEntitySlug && selectedCompareGroup && selectedCompareGroup !== selectedEntitySlug
      ? selectedCompareGroup
      : null
  const selectedReleaseRoute =
    selectedReleaseRouteSelection ? buildRouteSelectedRelease(selectedGroup, selectedReleaseRouteSelection) : null

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(MY_TEAMS_STORAGE_KEY, JSON.stringify(myTeams))
  }, [myTeams])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (selectedReleaseRoute) {
        document.title = `${selectedReleaseRoute.title} | ${selectedReleaseRoute.group} | Idol Song App`
        return
      }

      document.title = selectedGroup
        ? activeCompareGroup
          ? `${selectedGroup} vs ${humanizeRouteSlug(activeCompareGroup)} | Idol Song App`
          : `${selectedGroup} | Idol Song App`
        : 'Idol Song App'
    }
  }, [activeCompareGroup, selectedGroup, selectedReleaseRoute])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handlePopState = () => {
      setSelectedEntitySlug(readSelectedEntitySlugFromLocation())
      setSelectedGroup(readSelectedGroupFromLocation())
      setSelectedCompareGroup(readSelectedCompareGroupFromLocation())
      setSelectedAlbumKey(readSelectedReleaseKeyFromLocation())
      setSelectedReleaseRouteSelection(readSelectedReleaseRouteSelectionFromLocation())
      setShowBackendTargetInspection(readBackendTargetInspectionFromLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextPath = selectedReleaseRoute
      ? getReleasePath(selectedReleaseRoute, selectedEntitySlug)
      : selectedGroup
        ? getArtistPath(selectedGroup, activeCompareGroup)
        : selectedEntitySlug
          ? getArtistPathBySlug(selectedEntitySlug, activeCompareGroup)
          : getHomePath()
    const currentLocation = `${window.location.pathname}${window.location.search}`
    if (currentLocation !== nextPath) {
      window.history.pushState(
        {
          entitySlug: selectedEntitySlug,
          group: selectedGroup,
          compare: activeCompareGroup,
          releaseKey: selectedAlbumKey,
        },
        '',
        nextPath,
      )
    }
  }, [activeCompareGroup, selectedAlbumKey, selectedEntitySlug, selectedGroup, selectedReleaseRoute])

  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]
  const backendTargetCopy =
    language === 'ko'
      ? {
          label: 'backend target 진단',
          title: '현재 Pages 런타임 타깃',
          mode: '런타임 모드',
          environment: '선언된 타깃 환경',
          classification: '판별된 타깃 환경',
          configuredApiBase: '설정된 API base',
          effectiveTarget: '실제 사용 타깃',
          diagnosticsPath: '메타데이터 경로',
          openJson: 'JSON 열기',
        }
      : {
          label: 'Backend target diagnostics',
          title: 'Current Pages runtime target',
          mode: 'Runtime mode',
          environment: 'Declared target environment',
          classification: 'Detected target environment',
          configuredApiBase: 'Configured API base',
          effectiveTarget: 'Effective target',
          diagnosticsPath: 'Metadata path',
          openJson: 'Open JSON',
        }
  const backendTargetSnapshot = showBackendTargetInspection
    ? {
        mode: ACTIVE_WEB_BACKEND_TARGET_MODE,
        environment: ACTIVE_WEB_BACKEND_TARGET_ENVIRONMENT,
        classification: ACTIVE_WEB_BACKEND_TARGET_CLASSIFICATION,
        configuredApiBase: BACKEND_API_BASE_URL || copy.none,
        effectiveTarget: ACTIVE_WEB_BACKEND_TARGET,
        diagnosticsPath: BACKEND_TARGET_DIAGNOSTICS_PATH,
      }
    : null
  const monthFormatter = new Intl.DateTimeFormat(copy.locale, {
    month: 'long',
    year: 'numeric',
  })
  const shortDateFormatter = new Intl.DateTimeFormat(copy.locale, {
    month: 'short',
    day: 'numeric',
  })
  const timelineDateFormatter = new Intl.DateTimeFormat(copy.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const displayDateFormatter = new Intl.DateTimeFormat(copy.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const deferredSearch = useDeferredValue(search)
  const hasSearchQuery = deferredSearch.trim().length > 0
  const weekdayFormatter = new Intl.DateTimeFormat(copy.locale, {
    weekday: 'short',
  })
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const reference = new Date(Date.UTC(2026, 0, 4 + index))
    return weekdayFormatter.format(reference)
  })
  const searchNeedle = createSearchNeedle(search)
  const myTeamsSet = new Set(myTeams)
  const myTeamsCountLabel = formatMyTeamsCount(myTeams.length, MY_TEAMS_LIMIT, language)
  const myTeamsHelperText = myTeams.length > 0 ? copy.myTeamsOnlyHint : copy.myTeamsEmpty
  const radarResource = useRadarSurfaceResource()
  const filteredRadarApiSnapshot = radarResource.snapshot
    ? filterRadarApiSnapshot(radarResource.snapshot, {
        searchNeedle,
        selectedAgency,
        myTeamsSet,
        selectedMyTeamsOnly,
      })
    : null
  const activeRadarSnapshot = filteredRadarApiSnapshot ?? {
    longGapEntries: [],
    rookieEntries: [],
  }
  const visibleLongGapRadar = activeRadarSnapshot.longGapEntries
  const visibleRookieRadar = activeRadarSnapshot.rookieEntries
  const searchSurfaceResource = useSearchSurfaceResource({
    search: deferredSearch,
  })
  const visibleSearchTeams = hasSearchQuery ? searchSurfaceResource.entities : []
  const visibleSearchReleases = hasSearchQuery ? searchSurfaceResource.releases : []
  const visibleSearchUpcoming = hasSearchQuery ? searchSurfaceResource.upcoming : []
  const searchSurfaceStatus =
    search.trim().length > 0
      ? {
          source: searchSurfaceResource.source,
          errorCode: searchSurfaceResource.loading ? null : searchSurfaceResource.errorCode,
          traceId: searchSurfaceResource.traceId,
          message: searchSurfaceResource.loading
            ? copy.searchBackendLoading
            : searchSurfaceResource.source === 'api'
              ? copy.searchBackendActive
              : searchSurfaceResource.source === 'json'
                ? copy.searchBridgeActive
                : searchSurfaceResource.errorCode === 'timeout'
                  ? copy.searchBackendTimeout
                  : copy.searchBackendFallback,
        }
      : null
  const todayIso = CURRENT_KST_ISO
  const todayMonthKey = todayIso.slice(0, 7)
  const visibleMonthKeys = buildCalendarNavigationMonthKeys(todayMonthKey, selectedMonthKey)
  const effectiveMonthKey = visibleMonthKeys.includes(selectedMonthKey)
    ? selectedMonthKey
    : visibleMonthKeys.at(-1) ?? selectedMonthKey
  const selectedMonthDate = monthKeyToDate(effectiveMonthKey)
  const monthDays = buildCalendarDays(selectedMonthDate)
  const calendarMonthResource = useCalendarMonthResource({
    monthKey: effectiveMonthKey,
  })
  const filteredCalendarMonthApiSnapshot = calendarMonthResource.snapshot
    ? filterCalendarMonthApiSnapshot(calendarMonthResource.snapshot, {
        searchNeedle,
        selectedReleaseKind,
        selectedActType,
        selectedDashboardStatus,
        selectedAgency,
        myTeamsSet,
        selectedMyTeamsOnly,
      })
    : null
  const activeCalendarMonthSnapshot = filteredCalendarMonthApiSnapshot ?? {
    verifiedRows: [],
    scheduledRows: [],
    monthOnlyRows: [],
  }
  const visibleMonthVerifiedRows = [...activeCalendarMonthSnapshot.verifiedRows].sort(compareMonthlyDashboardVerified)
  const visibleMonthScheduledRows = [...activeCalendarMonthSnapshot.scheduledRows].sort(compareMonthlyDashboardUpcoming)
  const visibleMonthMonthOnlyRows = [...activeCalendarMonthSnapshot.monthOnlyRows].sort(compareUpcomingSignals)
  const agencyFilterOptions = [
    'all',
    ...buildRuntimeAgencyFilterOptions({
      verifiedRows: visibleMonthVerifiedRows,
      scheduledRows: visibleMonthScheduledRows,
      monthOnlyRows: visibleMonthMonthOnlyRows,
      searchEntities: visibleSearchTeams,
      searchReleases: visibleSearchReleases,
      searchUpcoming: visibleSearchUpcoming,
      longGapEntries: visibleLongGapRadar,
      rookieEntries: visibleRookieRadar,
    }),
  ]
  const defaultSearchUpcoming = [...visibleMonthScheduledRows, ...visibleMonthMonthOnlyRows].sort(compareUpcomingSignals)
  const defaultSearchReleases = visibleMonthVerifiedRows.slice(0, 10)
  const defaultSearchTeams = buildTeamDirectoryEntries(visibleMonthVerifiedRows, defaultSearchUpcoming)
  const dashboardUpcomingCount = hasSearchQuery ? visibleSearchUpcoming.length : defaultSearchUpcoming.length
  const releasesByDate = groupByDate(visibleMonthVerifiedRows)
  const upcomingByDate = groupUpcomingByDate(visibleMonthScheduledRows)
  const monthScheduledCount = visibleMonthScheduledRows.length + visibleMonthMonthOnlyRows.length
  const dashboardFilterSummary = buildMonthlyDashboardFilterSummary(
    {
      search,
      selectedReleaseKind,
      selectedActType,
      selectedDashboardStatus,
      selectedAgency,
      selectedMyTeamsOnly,
    },
    language,
  )
  const monthAgencySections = buildAgencyMonthSections(visibleMonthVerifiedRows, visibleMonthScheduledRows)
  const monthActiveDayIsos = Array.from(
    new Set([
      ...visibleMonthVerifiedRows.map((item) => item.isoDate),
      ...visibleMonthScheduledRows.map((item) => item.isoDate),
    ]),
  ).sort()
  const weeklyDigestReferenceDate = new Date(`${todayIso}T00:00:00`)
  const weeklyDigestWindowStart = getDateDaysBefore(weeklyDigestReferenceDate, 6)
  const weeklyDigestRows =
    buildWeeklyDigestRows(
      visibleMonthVerifiedRows.filter((item) => {
        const time = item.dateValue.getTime()
        return time >= weeklyDigestWindowStart.getTime() && time <= weeklyDigestReferenceDate.getTime()
      }),
      WEEKLY_DIGEST_MAX_ITEMS,
    )
  const visibleDayIsos = new Set(monthDays.map((day) => day.iso))
  const isSelectedDayVisible = visibleDayIsos.has(selectedDayIso)
  const hasNoMonthMatches =
    visibleMonthVerifiedRows.length === 0 &&
    visibleMonthScheduledRows.length === 0 &&
    visibleMonthMonthOnlyRows.length === 0

  const effectiveSelectedDayIso =
    isSelectedDayVisible
      ? selectedDayIso
      : monthActiveDayIsos[0] ?? monthDays.find((day) => day.inMonth)?.iso ?? ''

  const selectedDayReleases = effectiveSelectedDayIso
    ? releasesByDate.get(effectiveSelectedDayIso) ?? []
    : []
  const selectedDayUpcomingSignals = effectiveSelectedDayIso
    ? upcomingByDate.get(effectiveSelectedDayIso) ?? []
    : []

  const latestRelease = visibleMonthVerifiedRows.at(-1)
  const earliestRelease = visibleMonthVerifiedRows[0]
  const monthIndex = visibleMonthKeys.indexOf(effectiveMonthKey)
  const normalizedSearchQuery = deferredSearch.trim()
  const searchSummaryCounts = {
    teams: visibleSearchTeams.length,
    releases: visibleSearchReleases.length,
    upcoming: visibleSearchUpcoming.length,
  }
  const primarySearchEntity = visibleSearchTeams[0] ?? null
  const primarySearchRelease = visibleSearchReleases[0] ?? null
  const primarySearchUpcoming = visibleSearchUpcoming[0] ?? null
  const hasSearchMatches =
    searchSummaryCounts.teams > 0 || searchSummaryCounts.releases > 0 || searchSummaryCounts.upcoming > 0
  const selectedDayLabel = effectiveSelectedDayIso
    ? formatDisplayDate(effectiveSelectedDayIso, displayDateFormatter)
    : copy.noReleaseSelected
  const monthlyContextTitle =
    language === 'ko'
      ? `${selectedMonthDate.getFullYear()}년 ${selectedMonthDate.getMonth() + 1}월 컴백 캘린더`
      : `${monthFormatter.format(selectedMonthDate)} comeback calendar`
  const contextHeaderLabel = hasSearchQuery ? copy.searchResultsLabel : copy.monthlyContextLabel
  const contextHeaderTitle =
    hasSearchQuery && normalizedSearchQuery
      ? language === 'ko'
        ? `"${normalizedSearchQuery}" 검색 결과`
        : `Results for "${normalizedSearchQuery}"`
      : monthlyContextTitle
  const nearestMonthlySignal = visibleMonthScheduledRows[0] ?? null
  const todayJumpTarget: CalendarQuickJumpTarget = {
    isoDate: todayIso,
    monthKey: todayMonthKey,
    source: 'today',
  }
  const nearestUpcomingJumpSignal = visibleMonthScheduledRows.find((item) => item.isoDate >= todayIso) ?? null
  const currentMonthFallbackIso = pickClosestIsoDate(monthActiveDayIsos, todayIso)
  const latestVerifiedFallbackIso = visibleMonthVerifiedRows.at(-1)?.isoDate ?? ''
  const nearestCalendarJumpTarget: CalendarQuickJumpTarget | null =
    nearestUpcomingJumpSignal
      ? {
          isoDate: nearestUpcomingJumpSignal.isoDate,
          monthKey: getMonthKey(nearestUpcomingJumpSignal.dateValue),
          source: 'upcoming',
        }
      : currentMonthFallbackIso
        ? {
            isoDate: currentMonthFallbackIso,
            monthKey: currentMonthFallbackIso.slice(0, 7),
            source: 'current_month',
          }
        : latestVerifiedFallbackIso
          ? {
              isoDate: latestVerifiedFallbackIso,
              monthKey: latestVerifiedFallbackIso.slice(0, 7),
              source: 'verified',
            }
          : null
  const todayJumpLabel = formatDisplayDate(todayJumpTarget.isoDate, displayDateFormatter)
  const nearestJumpLabel = nearestCalendarJumpTarget
    ? formatDisplayDate(nearestCalendarJumpTarget.isoDate, displayDateFormatter)
    : copy.calendarQuickJumpUnavailable
  const nearestJumpSourceLabel = nearestCalendarJumpTarget
    ? copy.calendarQuickJumpSourceLabels[nearestCalendarJumpTarget.source]
    : copy.calendarQuickJumpUnavailable
  const monthlyHighlightEmptyCopy =
    visibleMonthMonthOnlyRows.length > 0 ? copy.monthlyHighlightUndatedOnly : copy.monthlyHighlightEmpty
  const calendarSurfaceStatus = {
    source: calendarMonthResource.source,
    errorCode: calendarMonthResource.loading ? null : calendarMonthResource.errorCode,
    traceId: calendarMonthResource.traceId,
    message: calendarMonthResource.loading
      ? copy.calendarBackendLoading
      : calendarMonthResource.source === 'api'
        ? copy.calendarBackendActive
        : calendarMonthResource.source === 'json'
          ? copy.calendarJsonActive
          : calendarMonthResource.errorCode === 'timeout'
            ? copy.calendarBackendTimeout
            : copy.calendarBackendFallback,
  }
  const radarSurfaceStatus = {
    source: radarResource.source,
    errorCode: radarResource.loading ? null : radarResource.errorCode,
    traceId: radarResource.traceId,
    message: radarResource.loading
      ? copy.radarBackendLoading
      : radarResource.source === 'api'
        ? copy.radarBackendActive
        : radarResource.source === 'json'
          ? copy.radarJsonActive
          : radarResource.errorCode === 'timeout'
            ? copy.radarBackendTimeout
            : copy.radarBackendFallback,
  }
  const selectedTeamShellDisplayName = selectedEntitySlug
    ? selectedGroup ?? humanizeRouteSlug(selectedEntitySlug)
    : null
  const selectedTeamResource = useEntityDetailResource({
    group: selectedGroup,
    entitySlug: selectedEntitySlug,
  })
  const selectedTeam = selectedTeamResource.team
  const selectedTeamPageGroup = selectedTeam?.group ?? selectedGroup ?? selectedTeamShellDisplayName ?? null
  const compareTeamResource = useEntityDetailResource({
    group: null,
    entitySlug: activeCompareGroup,
  })
  const compareTeam = compareTeamResource.team
  const selectedTeamIsPinned = selectedTeamPageGroup ? myTeamsSet.has(selectedTeamPageGroup) : false
  const myTeamsLimitReached = myTeams.length >= MY_TEAMS_LIMIT
  const compareTeamOptions: TeamCompareOption[] = selectedTeam?.compareOptions ?? []
  const selectedTeamCompareSnapshot = selectedTeam ? buildEntityDetailCompareSnapshot(selectedTeam) : null
  const compareTeamSnapshot = compareTeam ? buildEntityDetailCompareSnapshot(compareTeam) : null
  const selectedTeamSourceStatus = {
    source: selectedTeamResource.source,
    errorCode: selectedTeamResource.loading ? null : selectedTeamResource.errorCode,
    traceId: selectedTeamResource.traceId,
    message: selectedTeamResource.loading
      ? teamCopy.backendLoading
      : selectedTeamResource.source === 'json'
        ? teamCopy.bridgeActive
        : selectedTeamResource.source === 'api'
          ? teamCopy.backendActive
          : selectedTeamResource.errorCode === 'timeout'
            ? teamCopy.backendTimeout
            : selectedTeamResource.errorCode === 'not_found'
              ? teamCopy.backendNotFound
              : teamCopy.backendUnavailable,
  }
  const selectedAlbum = selectedReleaseRoute
  const selectedTeamLatestRecord =
    selectedTeam?.latestRelease &&
    selectedTeam.latestRelease.verified &&
    selectedTeam.latestRelease.stream !== 'watchlist'
      ? buildVerifiedReleaseFromTeamLatestRelease(selectedTeam.group, selectedTeam.latestRelease)
      : null
  const selectedTeamLatestHandoffs =
    selectedTeam?.latestRelease ? selectedTeam.latestRelease.musicHandoffs : undefined
  const selectedTeamLatestMvUrl = selectedTeam?.latestRelease?.youtubeMvUrl ?? ''
  const relatedActs: RelatedActRecommendation[] = selectedTeam?.relatedActs ?? []
  const dashboardSectionNavigatorItems: DashboardSectionNavigatorItem[] = [
    {
      id: DASHBOARD_SECTION_NAV_IDS[0],
      label: copy.sectionNavigatorWeekly,
      shortLabel: copy.sectionNavigatorWeekly,
    },
    {
      id: DASHBOARD_SECTION_NAV_IDS[1],
      label: copy.sectionNavigatorCalendar,
      shortLabel: copy.sectionNavigatorCalendar,
    },
    {
      id: DASHBOARD_SECTION_NAV_IDS[2],
      label: copy.sectionNavigatorDashboard,
      shortLabel: copy.sectionNavigatorDashboard,
    },
    {
      id: DASHBOARD_SECTION_NAV_IDS[3],
      label: copy.sectionNavigatorAgency,
      shortLabel: copy.sectionNavigatorAgency,
    },
    {
      id: DASHBOARD_SECTION_NAV_IDS[4],
      label: copy.sectionNavigatorUpcoming,
      shortLabel: copy.sectionNavigatorUpcoming,
    },
    {
      id: DASHBOARD_SECTION_NAV_IDS[5],
      label: copy.sectionNavigatorRadar,
      shortLabel: copy.sectionNavigatorRadar,
    },
    {
      id: DASHBOARD_SECTION_NAV_IDS[6],
      label: copy.sectionNavigatorFeed,
      shortLabel: copy.sectionNavigatorFeed,
    },
  ]
  const [activeDashboardSectionId, setActiveDashboardSectionId] = useState<string>(DASHBOARD_SECTION_NAV_IDS[1])
  const [isSectionNavigatorExpanded, setIsSectionNavigatorExpanded] = useState(false)

  useEffect(() => {
    if (!selectedDayInteractionTick || !selectedDayPanelRef.current || !effectiveSelectedDayIso) {
      return undefined
    }

    const panelNode = selectedDayPanelRef.current
    const panelRect = panelNode.getBoundingClientRect()
    const viewportTopOffset = 24
    const shouldScrollToPanel =
      panelRect.top < viewportTopOffset || panelRect.top > window.innerHeight * 0.72

    if (shouldScrollToPanel) {
      const nextTop = Math.max(0, window.scrollY + panelRect.top - viewportTopOffset)
      window.scrollTo({
        top: nextTop,
        behavior: 'smooth',
      })
    }

    panelNode.classList.remove('selected-day-panel-highlight')
    void panelNode.offsetWidth
    panelNode.classList.add('selected-day-panel-highlight')

    const timeoutId = window.setTimeout(() => {
      panelNode.classList.remove('selected-day-panel-highlight')
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
      panelNode.classList.remove('selected-day-panel-highlight')
    }
  }, [selectedDayInteractionTick, effectiveSelectedDayIso])

  useEffect(() => {
    if (typeof window === 'undefined' || selectedGroup || selectedAlbumKey) {
      return undefined
    }

    const sectionNodes = DASHBOARD_SECTION_NAV_IDS
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node))

    if (!sectionNodes.length) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

        if (visibleEntries[0]) {
          setActiveDashboardSectionId(visibleEntries[0].target.id)
        }
      },
      {
        rootMargin: '-18% 0px -55% 0px',
        threshold: [0.1, 0.35, 0.6],
      },
    )

    sectionNodes.forEach((node) => observer.observe(node))

    return () => {
      observer.disconnect()
    }
  }, [selectedAlbumKey, selectedGroup])

  useEffect(() => {
    if (typeof window === 'undefined' || selectedGroup) {
      return undefined
    }

    const calendarNode = calendarPanelRef.current
    if (!calendarNode) {
      return undefined
    }

    let frameId = 0
    const syncUpcomingPanelHeight = () => {
      cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        if (window.innerWidth <= 1180) {
          setDesktopUpcomingPanelHeight(null)
          return
        }

        const nextHeight = Math.ceil(calendarNode.getBoundingClientRect().height)
        setDesktopUpcomingPanelHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
      })
    }

    syncUpcomingPanelHeight()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncUpcomingPanelHeight()) : null
    resizeObserver?.observe(calendarNode)
    window.addEventListener('resize', syncUpcomingPanelHeight)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncUpcomingPanelHeight)
    }
  }, [selectedGroup])

  function openTeamPage(group: string, entitySlug?: string | null) {
    setSelectedEntitySlug(entitySlug ?? slugifyGroup(group))
    setSelectedGroup(group)
    setSelectedCompareGroup(null)
    setSelectedAlbumKey(null)
    setSelectedReleaseRouteSelection(null)
  }

function openTeamPageBySlug(entitySlug: string) {
  setSelectedEntitySlug(entitySlug)
  setSelectedGroup(null)
  setSelectedCompareGroup(null)
  setSelectedAlbumKey(null)
  setSelectedReleaseRouteSelection(null)
}

function buildSearchReleasePreview({
  displayName,
  entitySlug,
  releaseId,
  releaseTitle,
  releaseDate,
  stream,
  releaseKind,
  releaseFormat,
  actType = 'group',
}: {
  displayName: string
  entitySlug: string
  releaseId: string | null
  releaseTitle: string
  releaseDate: string
  stream: 'song' | 'album'
  releaseKind: ReleaseFact['release_kind']
  releaseFormat: ReleaseFormat | ''
  actType?: ActType
}): VerifiedRelease {
  return {
    group: displayName,
    displayName,
    entitySlug,
    title: releaseTitle,
    date: releaseDate,
    source: 'backend-search',
    release_kind: releaseKind,
    release_format:
      releaseFormat || (releaseKind === 'album' ? 'album' : releaseKind === 'ep' ? 'ep' : 'single'),
    context_tags: [],
    artist_name_mb: displayName,
    artist_mbid: '',
    artist_source: 'backend-search',
    actType,
    stream,
    dateValue: new Date(`${releaseDate}T00:00:00`),
    isoDate: releaseDate,
    release_id: releaseId ?? undefined,
  }
}

function openReleaseDetail(release: VerifiedRelease) {
  const entitySlug = release.entitySlug ?? slugifyGroup(release.group)
  setSelectedEntitySlug(entitySlug)
  setSelectedGroup(release.group)
  setSelectedCompareGroup(null)
    setSelectedAlbumKey(getAlbumKey(release))
    setSelectedReleaseRouteSelection({
      entitySlug,
      releaseSlug: release.release_id ?? (slugifyPathSegment(release.title) || 'release'),
      releaseDate: release.date,
      releaseStream: release.stream,
      releaseId: release.release_id ?? null,
    })
}

function openSearchReleaseDetail(release: SearchSurfaceReleaseResult) {
  openReleaseDetail(
    buildSearchReleasePreview({
      displayName: release.displayName,
      entitySlug: release.entitySlug,
      releaseId: release.releaseId,
      releaseTitle: release.releaseTitle,
      releaseDate: release.releaseDate,
      stream: release.stream,
      releaseKind: release.releaseKind,
      releaseFormat: release.releaseFormat,
    }),
  )
}

function openEntityLatestReleaseDetail(entity: SearchSurfaceEntityResult) {
  if (!entity.latestRelease) {
    return
  }

  openReleaseDetail(
    buildSearchReleasePreview({
      displayName: entity.displayName,
      entitySlug: entity.entitySlug,
      releaseId: entity.latestRelease.releaseId,
      releaseTitle: entity.latestRelease.title,
      releaseDate: entity.latestRelease.date,
      stream: entity.latestRelease.stream,
      releaseKind: entity.latestRelease.releaseKind,
      releaseFormat:
        entity.latestRelease.releaseKind === 'album'
          ? 'album'
          : entity.latestRelease.releaseKind === 'ep'
            ? 'ep'
            : 'single',
      actType: entity.entityType === 'solo' || entity.entityType === 'unit' ? entity.entityType : 'group',
    }),
  )
}

function closeReleaseDetail() {
  if (typeof window !== 'undefined' && window.history.state?.releaseKey) {
    window.history.back()
    return
  }

    setSelectedAlbumKey(null)
    setSelectedReleaseRouteSelection(null)
  }

  function closeTeamPage() {
    setSelectedEntitySlug(null)
    setSelectedGroup(null)
    setSelectedCompareGroup(null)
    setSelectedAlbumKey(null)
    setSelectedReleaseRouteSelection(null)
  }

  function toggleMyTeam(group: string) {
    if (myTeamsSet.has(group)) {
      const nextMyTeams = myTeams.filter((item) => item !== group)
      setMyTeams(nextMyTeams)
      if (nextMyTeams.length === 0) {
        setSelectedMyTeamsOnly(false)
      }
      return
    }

    if (myTeams.length >= MY_TEAMS_LIMIT) {
      return
    }

    setMyTeams([...myTeams, group])
  }

  function handleSelectDay(dayIso: string) {
    setSelectedDayIso(dayIso)
    setSelectedDayInteractionTick((tick) => tick + 1)
  }

  function handleQuickJump(target: CalendarQuickJumpTarget | null) {
    if (!target) {
      return
    }

    setSelectedMonthKey(target.monthKey)
    setSelectedDayIso(target.isoDate)
    setSelectedDayInteractionTick((tick) => tick + 1)
  }

  function handleJumpToDashboardSection(sectionId: string) {
    if (typeof window === 'undefined') {
      return
    }

    const sectionNode = document.getElementById(sectionId)
    if (!sectionNode) {
      return
    }

    setActiveDashboardSectionId(sectionId)
    setIsSectionNavigatorExpanded(false)
    sectionNode.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="shell">
      <header className="panel context-header">
        <div className="context-header-top">
          <div className="context-header-copy">
            <p className="panel-label">{contextHeaderLabel}</p>
            <h1>{contextHeaderTitle}</h1>
            <div className="context-summary-grid">
              {hasSearchQuery ? (
                <>
                  <article className="context-summary-card">
                    <span>{copy.searchSummaryLabels.teams}</span>
                    <strong>{searchSummaryCounts.teams}</strong>
                  </article>
                  <article className="context-summary-card">
                    <span>{copy.searchSummaryLabels.releases}</span>
                    <strong>{searchSummaryCounts.releases}</strong>
                  </article>
                  <article className="context-summary-card">
                    <span>{copy.searchSummaryLabels.upcoming}</span>
                    <strong>{searchSummaryCounts.upcoming}</strong>
                  </article>
                </>
              ) : (
                <>
                  <article className="context-summary-card">
                    <span>{copy.monthlySummaryLabels.verified}</span>
                    <strong>{visibleMonthVerifiedRows.length}</strong>
                  </article>
                  <article className="context-summary-card">
                    <span>{copy.monthlySummaryLabels.scheduled}</span>
                    <strong>{monthScheduledCount}</strong>
                  </article>
                  <article className="context-summary-card">
                    <span>{copy.monthlySummaryLabels.nearest}</span>
                    <strong>
                      {nearestMonthlySignal
                        ? formatUpcomingTimingLabel(nearestMonthlySignal, language, displayDateFormatter, copy.none)
                        : copy.monthlyNearestEmpty}
                    </strong>
                    <p className="context-summary-meta">
                      {nearestMonthlySignal ? getTeamDisplayName(nearestMonthlySignal.group) : copy.none}
                    </p>
                  </article>
                </>
              )}
            </div>
          </div>

            <div className="context-header-controls">
              <div className="context-header-search-row">
                <label className="search-field">
                  <span>{copy.searchLabel}</span>
                  <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                />
              </label>
              <div className="language-switch" role="group" aria-label={copy.languageLabel}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={['language-button', option === language ? 'language-button-active' : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setLanguage(option)}
                  >
                    {copy.languageNames[option]}
                  </button>
                  ))}
                </div>
              </div>
              {searchSurfaceStatus ? (
                <SurfaceRuntimeStatus
                  language={language}
                  source={searchSurfaceStatus.source}
                  errorCode={searchSurfaceStatus.errorCode}
                  traceId={searchSurfaceStatus.traceId}
                  message={searchSurfaceStatus.message}
                  className="context-runtime-status"
                />
              ) : null}

              <article className="context-highlight-card">
                <div className="context-highlight-head">
                  <div>
                    <p className="panel-label">
                      {hasSearchQuery ? copy.searchResultsSpotlightLabel : copy.monthlyHighlightLabel}
                    </p>
                    <h2>
                      {hasSearchQuery
                        ? hasSearchMatches
                          ? primarySearchEntity?.displayName ??
                            primarySearchRelease?.releaseTitle ??
                            primarySearchUpcoming?.headline ??
                            copy.searchResultsEmptyTitle
                          : copy.searchResultsEmptyTitle
                        : nearestMonthlySignal?.headline ?? copy.monthlyNearestEmpty}
                    </h2>
                  </div>
                  {hasSearchQuery ? null : nearestMonthlySignal ? (
                    <div className="signal-tags">
                      <UpcomingCountdownBadge item={nearestMonthlySignal} formatter={shortDateFormatter} />
                      <span className={`signal-badge signal-badge-date-${nearestMonthlySignal.date_status}`}>
                        {formatDateStatus(nearestMonthlySignal.date_status, language)}
                      </span>
                    </div>
                  ) : null}
                </div>
                {hasSearchQuery ? (
                  hasSearchMatches ? (
                    <div className="context-search-results">
                      {primarySearchEntity ? (
                        <article className="context-search-result-card">
                          <div className="context-search-result-head">
                            <div className="context-search-result-copy">
                              <span className="team-directory-kicker">{copy.searchResultsEntityLabel}</span>
                              <h3>{primarySearchEntity.displayName}</h3>
                              <p className="context-search-result-meta">
                                {describeSearchEntityResult(
                                  primarySearchEntity,
                                  language,
                                  displayDateFormatter,
                                  teamCopy.noSignal,
                                )}
                              </p>
                              <p className="context-search-result-meta">
                                {primarySearchEntity.agencyName || primarySearchEntity.canonicalName}
                                {primarySearchEntity.matchedAlias
                                  ? ` · ${copy.searchResultsMatchedAliasLabel} ${primarySearchEntity.matchedAlias}`
                                  : ''}
                              </p>
                            </div>
                            <div className="signal-tags">
                              <span className="signal-badge">{primarySearchEntity.entityType}</span>
                            </div>
                          </div>
                          <div className="action-stack">
                            <div className="action-row">
                              <ActionButton variant="primary" onClick={() => openTeamPageBySlug(primarySearchEntity.entitySlug)}>
                                {teamCopy.action}
                              </ActionButton>
                              {primarySearchEntity.latestRelease ? (
                                <ActionButton variant="secondary" onClick={() => openEntityLatestReleaseDetail(primarySearchEntity)}>
                                  {getReleaseDetailActionLabel(primarySearchEntity.latestRelease.releaseKind, language)}
                                </ActionButton>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ) : null}

                      {primarySearchRelease ? (
                        <article className="context-search-result-card">
                          <div className="context-search-result-head">
                            <div className="context-search-result-copy">
                              <span className="team-directory-kicker">{copy.searchResultsReleaseLabel}</span>
                              <h3>{primarySearchRelease.releaseTitle}</h3>
                              <p className="context-search-result-meta">
                                {primarySearchRelease.displayName} ·{' '}
                                {describeSearchReleaseResult(primarySearchRelease, language)} ·{' '}
                                {formatOptionalDate(primarySearchRelease.releaseDate, displayDateFormatter, copy.none)}
                              </p>
                            </div>
                          </div>
                          <div className="action-stack">
                            <div className="action-row">
                              <ActionButton variant="primary" onClick={() => openSearchReleaseDetail(primarySearchRelease)}>
                                {getReleaseDetailActionLabel(primarySearchRelease.releaseKind, language)}
                              </ActionButton>
                              <ActionButton variant="secondary" onClick={() => openTeamPageBySlug(primarySearchRelease.entitySlug)}>
                                {teamCopy.action}
                              </ActionButton>
                            </div>
                          </div>
                        </article>
                      ) : null}

                      {primarySearchUpcoming ? (
                        <article className="context-search-result-card">
                          <div className="context-search-result-head">
                            <div className="context-search-result-copy">
                              <span className="team-directory-kicker">{copy.searchResultsUpcomingLabel}</span>
                              <h3>{primarySearchUpcoming.headline}</h3>
                              <p className="context-search-result-meta">
                                {primarySearchUpcoming.displayName} ·{' '}
                                {formatUpcomingTimingLabel(
                                  primarySearchUpcoming,
                                  language,
                                  displayDateFormatter,
                                  copy.none,
                                )}{' '}
                                · {formatSourceDomain(primarySearchUpcoming.source_domain, language)}
                              </p>
                              {primarySearchUpcoming.evidence_summary ? (
                                <p className="context-search-result-meta">{primarySearchUpcoming.evidence_summary}</p>
                              ) : null}
                            </div>
                            <div className="signal-tags">
                              <span className={`signal-badge signal-badge-date-${primarySearchUpcoming.date_status}`}>
                                {formatDateStatus(primarySearchUpcoming.date_status, language)}
                              </span>
                            </div>
                          </div>
                          <div className="action-stack">
                            <div className="action-row">
                              <ActionButton variant="primary" onClick={() => openTeamPageBySlug(primarySearchUpcoming.entitySlug)}>
                                {teamCopy.action}
                              </ActionButton>
                            </div>
                            <div className="meta-links">
                              {primarySearchUpcoming.source_url ? (
                                <a href={primarySearchUpcoming.source_url} target="_blank" rel="noreferrer" className="meta-link">
                                  {copy.sourceLink}
                                </a>
                              ) : (
                                <span className="signal-link-muted">{copy.noSourceLink}</span>
                              )}
                            </div>
                          </div>
                        </article>
                      ) : null}
                    </div>
                  ) : (
                    <div className="context-highlight-empty">
                      <strong>{copy.searchResultsEmptyTitle}</strong>
                      <p className="empty-copy">{copy.searchResultsEmptyBody}</p>
                    </div>
                  )
                ) : nearestMonthlySignal ? (
                  <div className="context-highlight-body">
                    <div>
                      <TeamIdentity group={nearestMonthlySignal.group} variant="list" />
                      <p className="signal-meta">
                        {formatUpcomingTimingLabel(nearestMonthlySignal, language, displayDateFormatter, copy.none)} ·{' '}
                        {formatSourceType(nearestMonthlySignal.source_type, language)} ·{' '}
                        {nearestMonthlySignal.source_domain || copy.sourceTypeLabels.pending}
                      </p>
                      {formatUpcomingEvidenceMeta(nearestMonthlySignal, language) ? (
                        <p className="signal-meta">{formatUpcomingEvidenceMeta(nearestMonthlySignal, language)}</p>
                      ) : null}
                    </div>
                    <div className="context-highlight-actions">
                      <button type="button" className="inline-button" onClick={() => openTeamPage(nearestMonthlySignal.group)}>
                        {teamCopy.action}
                      </button>
                      {nearestMonthlySignal.source_url ? (
                        <a href={nearestMonthlySignal.source_url} target="_blank" rel="noreferrer">
                          {copy.open}
                        </a>
                      ) : (
                        <span className="signal-link-muted">{copy.noSourceLink}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="empty-copy">{monthlyHighlightEmptyCopy}</p>
                )}
              </article>
            </div>
          </div>

        <div className="context-filter-stack">
          <div className="context-filter-grid context-filter-grid-primary">
            <FilterGroup
              label={copy.filterLabels.releaseKind}
              options={releaseKindOptions}
              selected={selectedReleaseKind}
              language={language}
              onSelect={(value) => setSelectedReleaseKind(value)}
            />
            <FilterGroup
              label={copy.filterLabels.actType}
              options={actTypeOptions}
              selected={selectedActType}
              language={language}
              onSelect={(value) => setSelectedActType(value)}
            />
            <FilterGroup
              label={copy.filterLabels.status}
              options={dashboardStatusOptions}
              selected={selectedDashboardStatus}
              language={language}
              onSelect={(value) => setSelectedDashboardStatus(value)}
            />
          </div>

          <AgencyFilterGroup
            label={copy.filterLabels.agency}
            options={agencyFilterOptions}
            selected={selectedAgency}
            language={language}
            onSelect={setSelectedAgency}
          />

          <MyTeamsFilterGroup
            label={copy.filterLabels.myTeams}
            summary={myTeamsCountLabel}
            toggleLabel={copy.myTeamsOnlyToggle}
            helperText={myTeamsHelperText}
            selected={selectedMyTeamsOnly}
            disabled={myTeams.length === 0}
            onToggle={() => setSelectedMyTeamsOnly((value) => !value)}
          />
        </div>
      </header>

      {backendTargetSnapshot ? (
        <section className="panel backend-target-inspection" aria-label={backendTargetCopy.title}>
          <div className="backend-target-inspection-head">
            <div>
              <p className="panel-label">{backendTargetCopy.label}</p>
              <h2>{backendTargetCopy.title}</h2>
            </div>
            <a href={backendTargetSnapshot.diagnosticsPath} target="_blank" rel="noreferrer">
              {backendTargetCopy.openJson}
            </a>
          </div>
          <div className="backend-target-inspection-grid">
            <article className="backend-target-inspection-card">
              <span>{backendTargetCopy.mode}</span>
              <strong>{backendTargetSnapshot.mode}</strong>
            </article>
            <article className="backend-target-inspection-card">
              <span>{backendTargetCopy.environment}</span>
              <strong>{backendTargetSnapshot.environment}</strong>
            </article>
            <article className="backend-target-inspection-card">
              <span>{backendTargetCopy.classification}</span>
              <strong>{backendTargetSnapshot.classification}</strong>
            </article>
            <article className="backend-target-inspection-card">
              <span>{backendTargetCopy.configuredApiBase}</span>
              <code>{backendTargetSnapshot.configuredApiBase}</code>
            </article>
            <article className="backend-target-inspection-card">
              <span>{backendTargetCopy.effectiveTarget}</span>
              <code>{backendTargetSnapshot.effectiveTarget}</code>
            </article>
            <article className="backend-target-inspection-card">
              <span>{backendTargetCopy.diagnosticsPath}</span>
              <code>{backendTargetSnapshot.diagnosticsPath}</code>
            </article>
          </div>
        </section>
      ) : null}

      {selectedAlbum && selectedEntitySlug ? (
        <ReleaseDetailPage
          album={selectedAlbum}
          group={selectedAlbum.group}
          entitySlug={selectedEntitySlug}
          language={language}
          displayDateFormatter={displayDateFormatter}
          onBack={closeReleaseDetail}
          onOpenTeamPage={openTeamPage}
        />
      ) : selectedEntitySlug && selectedTeamShellDisplayName && !selectedTeam ? (
        <main className="team-page">
          <section className="panel team-page-hero">
            <div className="team-page-head">
              <div className="team-page-head-actions">
                <button type="button" className="ghost-button" onClick={closeTeamPage}>
                  {teamCopy.back}
                </button>
              </div>
              <div className="team-page-head-meta">
                {selectedTeamIsPinned ? <span className="team-focus-badge">{teamCopy.pinnedLabel}</span> : null}
              </div>
            </div>
            <SurfaceRuntimeStatus
              language={language}
              source={selectedTeamSourceStatus.source}
              errorCode={selectedTeamSourceStatus.errorCode}
              traceId={selectedTeamSourceStatus.traceId}
              message={selectedTeamSourceStatus.message}
              className="team-runtime-status"
            />

            <div className="team-page-summary">
              <div className="team-title-wrap">
                <div className="team-avatar" aria-hidden="true">
                  {getTeamMonogram(selectedTeamShellDisplayName)}
                </div>
                <div>
                  <p className="panel-label">{teamCopy.panelLabel}</p>
                  <h2>{selectedTeamShellDisplayName}</h2>
                  <p className="hero-text team-summary-copy">
                    {selectedTeamResource.loading
                      ? teamCopy.backendLoadingBody
                      : selectedTeamResource.source === 'json'
                        ? teamCopy.bridgeActiveBody
                        : selectedTeamResource.errorCode === 'not_found'
                          ? teamCopy.backendNotFoundBody
                          : selectedTeamResource.errorCode
                            ? teamCopy.backendUnavailableBody
                            : teamCopy.intro}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : selectedTeam ? (
        <main className="team-page">
          <section className="panel team-page-hero">
            <div className="team-page-head">
              <div className="team-page-head-actions">
                <button type="button" className="ghost-button" onClick={closeTeamPage}>
                  {teamCopy.back}
                </button>
                <button
                  type="button"
                  className={`ghost-button ghost-button-subtle ${selectedTeamIsPinned ? 'my-team-button-active' : ''}`}
                  onClick={() => toggleMyTeam(selectedTeam.group)}
                  disabled={myTeamsLimitReached && !selectedTeamIsPinned}
                >
                  {selectedTeamIsPinned ? teamCopy.unpinAction : teamCopy.pinAction}
                </button>
              </div>
              <div className="team-page-head-meta">
                {selectedTeamIsPinned ? <span className="team-focus-badge">{teamCopy.pinnedLabel}</span> : null}
                <span className={`signal-badge signal-badge-${selectedTeam.trackingStatus}`}>
                  {formatTrackingStatus(selectedTeam.trackingStatus, language)}
                </span>
              </div>
            </div>
            {myTeamsLimitReached && !selectedTeamIsPinned ? (
              <p className="team-focus-note">{teamCopy.pinLimitReached}</p>
            ) : null}
            <SurfaceRuntimeStatus
              language={language}
              source={selectedTeamSourceStatus.source}
              errorCode={selectedTeamSourceStatus.errorCode}
              traceId={selectedTeamSourceStatus.traceId}
              message={selectedTeamSourceStatus.message}
              className="team-runtime-status"
            />

            <div className="team-page-summary">
              <div className="team-title-wrap">
                <div className="team-avatar" aria-hidden="true">
                  {selectedTeam.badgeImageUrl || selectedTeam.representativeImageUrl ? (
                    <img
                      className="team-avatar-image"
                      src={selectedTeam.badgeImageUrl ?? selectedTeam.representativeImageUrl ?? ''}
                      alt=""
                    />
                  ) : (
                    getTeamMonogram(selectedTeam.group)
                  )}
                </div>
                <div>
                  <p className="panel-label">{teamCopy.panelLabel}</p>
                  <h2>{selectedTeam.displayName}</h2>
                  <p className="hero-text team-summary-copy">{teamCopy.intro}</p>
                </div>
              </div>

              <div className="team-facts-grid">
                <TeamFact label={teamCopy.agencyHint} value={selectedTeam.agency || copy.none} />
                <TeamFact
                  label={teamCopy.latestReleaseDate}
                  value={
                    selectedTeam.latestRelease
                      ? formatOptionalDate(selectedTeam.latestRelease.date, displayDateFormatter, copy.none)
                      : copy.none
                  }
                />
                <TeamFact
                  label={teamCopy.comebackStatus}
                  value={
                    selectedTeam.nextUpcomingSignal
                      ? describeUpcomingSignal(selectedTeam.nextUpcomingSignal, language, displayDateFormatter, copy.none)
                      : teamCopy.noSignal
                  }
                />
                <TeamFact label={teamCopy.tier} value={selectedTeam.tier} />
                <TeamFact
                  label={teamCopy.representativeImage}
                  value={selectedTeam.badgeSourceLabel ?? selectedTeam.representativeImageSource ?? teamCopy.generatedMark}
                />
              </div>
            </div>

            <div className="team-links-row meta-links">
              {selectedTeam.badgeSourceUrl && selectedTeam.badgeSourceUrl !== selectedTeam.youtubeUrl ? (
                <a href={selectedTeam.badgeSourceUrl} target="_blank" rel="noreferrer" className="meta-link">
                  {teamCopy.badgeSourceLink}
                </a>
              ) : null}
              {selectedTeam.xUrl ? (
                <a href={selectedTeam.xUrl} target="_blank" rel="noreferrer" className="meta-link">
                  X
                </a>
              ) : null}
              {selectedTeam.instagramUrl ? (
                <a href={selectedTeam.instagramUrl} target="_blank" rel="noreferrer" className="meta-link">
                  Instagram
                </a>
              ) : null}
              {selectedTeam.hasOfficialYouTubeUrl && selectedTeam.youtubeUrl ? (
                <a href={selectedTeam.youtubeUrl} target="_blank" rel="noreferrer" className="meta-link">
                  YouTube
                </a>
              ) : null}
              {selectedTeam.artistSource ? (
                <a href={selectedTeam.artistSource} target="_blank" rel="noreferrer" className="meta-link">
                  {copy.artistSource}
                </a>
              ) : null}
            </div>
            <p className="team-footnote">{teamCopy.footnote}</p>
            {(() => {
              const teamStatusDisclosure = buildTeamCanonicalStatusDisclosure(selectedTeam, language)
              if (!teamStatusDisclosure) {
                return null
              }

              return (
                <div className="tracklist-incomplete status-disclosure team-status-disclosure">
                  <strong>{teamStatusDisclosure.title}</strong>
                  {teamStatusDisclosure.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )
            })()}
          </section>

          <CompareTeamView
            primaryTeam={selectedTeam}
            secondaryTeam={compareTeam}
            primarySnapshot={selectedTeamCompareSnapshot}
            secondarySnapshot={compareTeamSnapshot}
            compareOptions={compareTeamOptions}
            selectedCompareGroup={activeCompareGroup}
            language={language}
            displayDateFormatter={displayDateFormatter}
            onSelectCompareGroup={setSelectedCompareGroup}
            onOpenTeamPage={openTeamPage}
            onOpenReleaseDetail={openReleaseDetail}
            onClearCompare={() => setSelectedCompareGroup(null)}
          />

          <div className="team-page-body">
            <div className="team-section-stack">
              <section className="panel">
                <p className="panel-label">{teamCopy.upcomingLabel}</p>
                <h2>{selectedTeam.nextUpcomingSignal ? teamCopy.upcomingTitle : teamCopy.upcomingEmptyTitle}</h2>
                <div className="feed-list">
                  {selectedTeam.upcomingSignals.length ? (
                    selectedTeam.upcomingSignals.slice(0, 3).map((item) => (
                      <article key={`${item.group}-${item.scheduled_date}-${item.headline}`} className="signal-row">
                        <div>
                          <div className="signal-head">
                            <TeamIdentity group={item.group} variant="list" />
                            <div className="signal-tags">
                              <UpcomingCountdownBadge item={item} formatter={shortDateFormatter} />
                              <span className={`signal-badge signal-badge-${item.tracking_status}`}>
                                {formatTrackingStatus(item.tracking_status, language)}
                              </span>
                              <span className={`signal-badge signal-badge-date-${item.date_status}`}>
                                {formatDateStatus(item.date_status, language)}
                              </span>
                              <span
                                className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}
                              >
                                {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                              </span>
                              <SourceBadge sourceType={item.source_type} language={language} />
                              <ReleaseChangeBadge group={item.group} language={language} />
                              <ReleaseClassificationBadges
                                releaseFormat={item.release_format}
                                contextTags={item.context_tags}
                                language={language}
                              />
                            </div>
                          </div>
                          <h3>{item.headline}</h3>
                          <p className="signal-meta">
                            {formatSourceDomain(item.source_domain, language)} ·{' '}
                            {formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}
                          </p>
                          {formatUpcomingEvidenceMeta(item, language) ? (
                            <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                          ) : null}
                          {item.evidence_summary ? (
                            <p className="signal-evidence">{item.evidence_summary}</p>
                          ) : null}
                        </div>
                        <div className="signal-date-wrap">
                          <time>{formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}</time>
                          {item.source_url ? (
                            <a href={item.source_url} target="_blank" rel="noreferrer">
                              {copy.open}
                            </a>
                          ) : (
                            <span className="signal-link-muted">{copy.noSourceLink}</span>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty-copy">{teamCopy.upcomingEmpty}</p>
                  )}
                </div>

                <div className="team-subsection">
                  <div className="team-subsection-head">
                    <p className="panel-label">{teamCopy.changeLogLabel}</p>
                    <h3>{selectedTeam.changeLog.length ? teamCopy.changeLogTitle : teamCopy.changeLogEmptyTitle}</h3>
                    <p className="team-subsection-copy">{teamCopy.changeLogIntro}</p>
                  </div>
                  {selectedTeam.changeLog.length ? (
                    <ReleaseChangeLogList
                      changes={selectedTeam.changeLog.slice(0, 3)}
                      language={language}
                      formatter={timelineDateFormatter}
                    />
                  ) : (
                    <p className="empty-copy">{teamCopy.changeLogEmpty}</p>
                  )}
                </div>

                <div className="team-subsection">
                  <div className="team-subsection-head">
                    <p className="panel-label">{teamCopy.timelineLabel}</p>
                    <h3>{selectedTeam.sourceTimeline.length ? teamCopy.timelineTitle : teamCopy.timelineEmptyTitle}</h3>
                    <p className="team-subsection-copy">{teamCopy.timelineIntro}</p>
                  </div>
                  {selectedTeam.sourceTimeline.length ? (
                    <ol className="source-timeline">
                      {selectedTeam.sourceTimeline.map((item, index) => (
                        <li
                          key={`${item.group}-${item.event_type}-${item.occurred_at}-${item.headline}`}
                          className="source-timeline-item"
                        >
                          <div className="source-timeline-rail" aria-hidden="true">
                            <span className={`source-timeline-dot source-timeline-dot-${item.event_type}`} />
                            {index < selectedTeam.sourceTimeline.length - 1 ? (
                              <span className="source-timeline-line" />
                            ) : null}
                          </div>
                          <article className="source-timeline-card">
                            <div className="source-timeline-head">
                              <div>
                                <p className="source-timeline-date">
                                  {formatSourceTimelineDate(item.occurred_at, timelineDateFormatter, copy.none)}
                                </p>
                                <h3>{item.headline}</h3>
                              </div>
                              <div className="signal-tags">
                                <span className={`signal-badge signal-badge-event-${item.event_type}`}>
                                  {formatTimelineEventType(item.event_type, language)}
                                </span>
                                <SourceBadge sourceType={item.source_type} language={language} />
                              </div>
                            </div>
                            <p className="signal-meta">{formatSourceDomain(item.source_domain, language)}</p>
                            {item.summary ? <p className="signal-evidence">{item.summary}</p> : null}
                            <div className="detail-links detail-links-stack">
                              {item.source_url ? (
                                <a href={item.source_url} target="_blank" rel="noreferrer">
                                  {copy.sourceLink}
                                </a>
                              ) : (
                                <span className="signal-link-muted">{copy.noSourceLink}</span>
                              )}
                            </div>
                          </article>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="empty-copy">{teamCopy.timelineEmpty}</p>
                  )}
                </div>
              </section>

              <section className="panel">
                <p className="panel-label">{teamCopy.latestLabel}</p>
                <h2>{selectedTeam.latestRelease?.title ?? teamCopy.latestEmptyTitle}</h2>
                {selectedTeam.latestRelease ? (
                  <article className="detail-card detail-card-feature">
                    <ReleaseArtworkFigure
                      artwork={
                        selectedTeamLatestRecord?.artwork ??
                        buildPlaceholderReleaseArtwork(
                          selectedTeam.group,
                          selectedTeam.latestRelease.title,
                          selectedTeam.latestRelease.date,
                          selectedTeam.latestRelease.stream,
                          selectedTeam.latestRelease.releaseKind,
                        )
                      }
                      alt={`${selectedTeam.displayName} ${selectedTeam.latestRelease.title} cover artwork`}
                      variant="feature"
                    />
                    <div className="detail-card-feature-body">
                      <div className="signal-head">
                        <TeamIdentity group={selectedTeam.group} variant="list" />
                        <div className="signal-tags">
                          <span className="signal-badge">
                            {selectedTeam.latestRelease.streamLabel} ·{' '}
                            {formatReleaseFormat(selectedTeam.latestRelease.releaseFormat, language) ||
                              selectedTeam.latestRelease.releaseKind}
                          </span>
                          <ReleaseClassificationBadges
                            releaseFormat=""
                            contextTags={selectedTeam.latestRelease.contextTags}
                            language={language}
                          />
                        </div>
                      </div>
                      <h3>{selectedTeam.latestRelease.title}</h3>
                      <p className="signal-meta">
                        {selectedTeam.latestRelease.verified ? teamCopy.verifiedRelease : teamCopy.watchlistFallback} ·{' '}
                        {formatOptionalDate(selectedTeam.latestRelease.date, displayDateFormatter, copy.none)}
                      </p>
                      <div className="action-stack">
                        {selectedTeamLatestRecord ? (
                          <div className="action-row">
                            <ActionButton variant="primary" onClick={() => openReleaseDetail(selectedTeamLatestRecord)}>
                              {getReleaseDetailActionLabel(selectedTeamLatestRecord.release_kind, language)}
                            </ActionButton>
                          </div>
                        ) : null}
                        <MusicHandoffRow
                          group={selectedTeam.group}
                          title={selectedTeam.latestRelease.title}
                          canonicalUrls={selectedTeamLatestHandoffs}
                          mvUrl={selectedTeamLatestMvUrl}
                          language={language}
                          showHint
                        />
                        <div className="meta-links">
                          {selectedTeam.latestRelease.source ? (
                            <a href={selectedTeam.latestRelease.source} target="_blank" rel="noreferrer" className="meta-link">
                              {copy.releaseSource}
                            </a>
                          ) : (
                            <span className="signal-link-muted">{teamCopy.releaseSourcePending}</span>
                          )}
                          {selectedTeam.latestRelease.artistSource ? (
                            <a
                              href={selectedTeam.latestRelease.artistSource}
                              target="_blank"
                              rel="noreferrer"
                              className="meta-link"
                            >
                              {copy.artistSource}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ) : (
                  <p className="empty-copy">{teamCopy.latestEmptyTitle}</p>
                )}
              </section>

              <AnnualReleaseTimeline
                sections={selectedTeam.annualReleaseTimeline}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenReleaseDetail={openReleaseDetail}
              />

              <section className="panel">
                <p className="panel-label">{teamCopy.recentAlbumsLabel}</p>
                <h2>{selectedTeam.recentAlbums.length ? teamCopy.recentAlbumsTitle : teamCopy.recentAlbumsEmptyTitle}</h2>
                {selectedTeam.recentAlbums.length ? (
                  <div className="album-grid">
                    {selectedTeam.recentAlbums.map((item) => {
                      const artwork =
                        item.artwork ??
                        buildPlaceholderReleaseArtwork(item.group, item.title, item.date, item.stream, item.release_kind)

                      return (
                        <article key={getAlbumKey(item)} className="album-card-shell">
                          <button
                            type="button"
                            className="album-card"
                            onClick={() => openReleaseDetail(item)}
                          >
                            <ReleaseArtworkFigure
                              artwork={artwork}
                              alt={`${selectedTeam.displayName} ${item.title} cover artwork`}
                              variant="card"
                            />
                            <div className="album-card-copy">
                              <span className="album-card-kicker">{item.release_kind}</span>
                              <strong>{item.title}</strong>
                              <span>{formatOptionalDate(item.date, displayDateFormatter, copy.none)}</span>
                              <span className="album-card-meta">{teamCopy.openAlbumDetail}</span>
                            </div>
                          </button>
                          <MusicHandoffRow
                            group={selectedTeam.group}
                            title={item.title}
                            canonicalUrls={item.music_handoffs}
                            mvUrl={item.youtube_mv_url ?? ''}
                            language={language}
                            compact
                          />
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="empty-copy">{teamCopy.recentAlbumsEmpty}</p>
                )}
              </section>
            </div>

            <aside className="sidebar team-aside">
              <section className="panel">
                <p className="panel-label">{teamCopy.relatedActsLabel}</p>
                <h2>{teamCopy.relatedActsTitle}</h2>
                <div className="team-directory related-acts-list">
                  {relatedActs.length ? (
                    relatedActs.map((item) => {
                      return (
                        <article key={item.entitySlug ?? item.group} className="related-acts-card">
                          <div className="related-acts-head">
                            <TeamIdentity group={item.group} variant="list" />
                            <span className={`signal-badge signal-badge-related-${item.reason.kind}`}>
                              {formatRelatedActReasonLabel(item.reason, language)}
                            </span>
                          </div>
                          <p className="related-acts-reason">{formatRelatedActReasonDetail(item.reason, language)}</p>
                          <div className="action-row">
                            <ActionButton
                              variant="primary"
                              onClick={() => openTeamPage(item.group, item.entitySlug)}
                            >
                              {teamCopy.action}
                            </ActionButton>
                            {item.entitySlug ? (
                              <ActionButton variant="secondary" onClick={() => setSelectedCompareGroup(item.entitySlug)}>
                                {teamCopy.compareAction}
                              </ActionButton>
                            ) : null}
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <p className="empty-copy">{teamCopy.relatedActsEmpty}</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </main>
      ) : (
        <main className="layout">
          <div className="layout-main-column">
            <WeeklyMustListenDigest
              sectionId="dashboard-weekly-digest"
              rows={weeklyDigestRows}
              windowStartDate={weeklyDigestWindowStart}
              windowEndDate={weeklyDigestReferenceDate}
              language={language}
              displayDateFormatter={displayDateFormatter}
              onOpenReleaseDetail={openReleaseDetail}
            />

            <div id="dashboard-calendar" className="calendar-drilldown-stack scroll-anchor-section">
              <section ref={calendarPanelRef} className="panel panel-calendar">
                <div className="panel-top">
                  <div className="calendar-panel-head">
                    <p className="panel-label">{copy.monthlyGrid}</p>
                    <h2>{monthFormatter.format(selectedMonthDate)}</h2>
                  </div>
                  <div className="calendar-top-actions">
                    <div className="calendar-quick-jumps" role="group" aria-label={copy.calendarQuickJumpLabel}>
                      <button
                        type="button"
                        className={[
                          'ghost-button',
                          'ghost-button-subtle',
                          'calendar-jump-button',
                          effectiveMonthKey === todayJumpTarget.monthKey && effectiveSelectedDayIso === todayJumpTarget.isoDate
                            ? 'calendar-jump-button-active'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => handleQuickJump(todayJumpTarget)}
                        aria-label={`${copy.calendarQuickJumpToday} · ${todayJumpLabel}`}
                      >
                        <span>{copy.calendarQuickJumpToday}</span>
                        <strong>{todayJumpLabel}</strong>
                        <small>{copy.calendarQuickJumpSourceLabels.today}</small>
                      </button>
                      <button
                        type="button"
                        className={[
                          'ghost-button',
                          'ghost-button-subtle',
                          'calendar-jump-button',
                          nearestCalendarJumpTarget &&
                          effectiveMonthKey === nearestCalendarJumpTarget.monthKey &&
                          effectiveSelectedDayIso === nearestCalendarJumpTarget.isoDate
                            ? 'calendar-jump-button-active'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => handleQuickJump(nearestCalendarJumpTarget)}
                        disabled={!nearestCalendarJumpTarget}
                        aria-label={`${copy.calendarQuickJumpNearest} · ${nearestJumpLabel}`}
                      >
                        <span>{copy.calendarQuickJumpNearest}</span>
                        <strong>{nearestJumpLabel}</strong>
                        <small>{nearestJumpSourceLabel}</small>
                      </button>
                    </div>
                    <div className="calendar-controls">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setSelectedMonthKey(visibleMonthKeys[Math.max(monthIndex - 1, 0)] ?? effectiveMonthKey)
                        }
                        disabled={monthIndex <= 0}
                      >
                        {copy.prev}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setSelectedMonthKey(
                            visibleMonthKeys[Math.min(monthIndex + 1, visibleMonthKeys.length - 1)] ??
                              effectiveMonthKey,
                          )
                        }
                        disabled={monthIndex === -1 || monthIndex >= visibleMonthKeys.length - 1}
                      >
                        {copy.next}
                      </button>
                    </div>
                  </div>
                </div>

                {hasNoMonthMatches ? (
                  <div className="empty-state">
                    {copy.noFilteredMatches}
                  </div>
                ) : null}

                <SurfaceRuntimeStatus
                  language={language}
                  source={calendarSurfaceStatus.source}
                  errorCode={calendarSurfaceStatus.errorCode}
                  traceId={calendarSurfaceStatus.traceId}
                  message={calendarSurfaceStatus.message}
                  className="calendar-runtime-status"
                />

                <div className="calendar">
                  <div className="calendar-weekdays">
                    {weekdays.map((weekday) => (
                      <div key={weekday} className="weekday">
                        {weekday}
                      </div>
                    ))}
                  </div>

                  <div className="calendar-grid">
                    {monthDays.map((day) => {
                      const dayReleases = releasesByDate.get(day.iso) ?? []
                      const dayUpcomingSignals = upcomingByDate.get(day.iso) ?? []
                      const hasCalendarItems = dayReleases.length > 0 || dayUpcomingSignals.length > 0
                      const isSelected = day.iso === effectiveSelectedDayIso

                      return (
                        <button
                          type="button"
                          key={day.iso}
                          aria-pressed={isSelected}
                          className={[
                            'calendar-cell',
                            day.inMonth ? '' : 'calendar-cell-muted',
                            hasCalendarItems ? 'calendar-cell-active' : '',
                            isSelected ? 'calendar-cell-selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => handleSelectDay(day.iso)}
                        >
                          <span className="calendar-day-number">{day.date.getDate()}</span>
                          <div className="calendar-day-content">
                            {dayReleases.slice(0, 2).map((item) => (
                              <span key={`${item.group}-${item.stream}-${item.title}`} className="release-chip">
                                <TeamIdentity group={item.group} variant="chip" />
                              </span>
                            ))}
                            {dayUpcomingSignals
                              .slice(0, Math.max(0, 2 - dayReleases.length))
                              .map((item) => (
                                <span
                                  key={`${item.group}-${item.scheduled_date}-${item.headline}`}
                                  className={`release-chip release-chip-upcoming-${item.date_status}`}
                                >
                                  <TeamIdentity group={item.group} variant="chip" />
                                </span>
                              ))}
                            {dayReleases.length + dayUpcomingSignals.length > 2 ? (
                              <span className="release-chip release-chip-more">
                                +{dayReleases.length + dayUpcomingSignals.length - 2}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>

              <SelectedDayPanel
                className="selected-day-panel-context"
                panelRef={selectedDayPanelRef}
                dateLabel={selectedDayLabel}
                releases={selectedDayReleases}
                upcomingSignals={selectedDayUpcomingSignals}
                language={language}
                shortDateFormatter={shortDateFormatter}
                onOpenTeamPage={openTeamPage}
                onOpenReleaseDetail={openReleaseDetail}
              />
            </div>

            <MonthlyReleaseDashboard
              sectionId="dashboard-monthly-view"
              monthLabel={monthFormatter.format(selectedMonthDate)}
              verifiedRows={visibleMonthVerifiedRows}
              scheduledRows={visibleMonthScheduledRows}
              monthOnlyRows={visibleMonthMonthOnlyRows}
              activeFilters={dashboardFilterSummary}
              language={language}
              displayDateFormatter={displayDateFormatter}
              onOpenTeamPage={openTeamPage}
              onOpenReleaseDetail={openReleaseDetail}
            />

            <AgencyCalendarView
              sectionId="dashboard-agency-view"
              sections={monthAgencySections}
              language={language}
              displayDateFormatter={displayDateFormatter}
              onOpenTeamPage={openTeamPage}
              onOpenReleaseDetail={openReleaseDetail}
            />

          </div>

          <aside className="sidebar">
            <section
              id="dashboard-upcoming-scan"
              className="panel sidebar-upcoming-panel scroll-anchor-section"
              style={desktopUpcomingPanelHeight ? { height: `${desktopUpcomingPanelHeight}px` } : undefined}
            >
              <div className="sidebar-upcoming-panel-head">
                <div>
                  <p className="panel-label">{copy.upcomingScan}</p>
                  <h2>{copy.upcomingTitle}</h2>
                </div>
                <span className="sidebar-panel-count">{dashboardUpcomingCount}</span>
              </div>
              <div className="sidebar-upcoming-panel-body">
                {dashboardUpcomingCount ? (
                  hasSearchQuery ? (
                    <div className="feed-list">
                      {visibleSearchUpcoming.map((item) => (
                        <article key={item.upcomingSignalId} className="signal-row signal-row-compact">
                          <div>
                            <div className="signal-head">
                              <span className="team-directory-kicker">{item.displayName}</span>
                              <div className="signal-tags">
                                <span className={`signal-badge signal-badge-date-${item.date_status || 'rumor'}`}>
                                  {formatDateStatus(item.date_status, language)}
                                </span>
                                <span
                                  className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}
                                >
                                  {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                                </span>
                                <SourceBadge sourceType={item.source_type} language={language} />
                                {item.release_format ? (
                                  <span className="signal-badge">
                                    {formatReleaseFormat(item.release_format, language)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <h3>{item.headline}</h3>
                            <p className="signal-meta">
                              {formatSourceDomain(item.source_domain, language)} ·{' '}
                              {formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}
                            </p>
                            {item.evidence_summary ? <p className="signal-evidence">{item.evidence_summary}</p> : null}
                            <div className="action-stack">
                              <div className="action-row">
                                <ActionButton variant="primary" onClick={() => openTeamPageBySlug(item.entitySlug)}>
                                  {teamCopy.action}
                                </ActionButton>
                              </div>
                              <div className="meta-links">
                                {item.source_url ? (
                                  <a href={item.source_url} target="_blank" rel="noreferrer" className="meta-link">
                                    {copy.sourceLink}
                                  </a>
                                ) : (
                                  <span className="signal-link-muted">{copy.noSourceLink}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="signal-date-wrap">
                            <time>{formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}</time>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="feed-list">
                      {defaultSearchUpcoming.map((item) => (
                        <article key={`${item.group}-${item.scheduled_date}-${item.headline}`} className="signal-row signal-row-compact">
                          <div>
                            <div className="signal-head">
                              <TeamIdentity group={item.group} variant="list" />
                              <div className="signal-tags">
                                <UpcomingCountdownBadge item={item} formatter={shortDateFormatter} />
                                <span className={`signal-badge signal-badge-${item.tracking_status}`}>
                                  {formatTrackingStatus(item.tracking_status, language)}
                                </span>
                                <span className={`signal-badge signal-badge-date-${item.date_status || 'rumor'}`}>
                                  {formatDateStatus(item.date_status, language)}
                                </span>
                                <span
                                  className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}
                                >
                                  {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                                </span>
                                <SourceBadge sourceType={item.source_type} language={language} />
                                <ReleaseChangeBadge group={item.group} language={language} />
                                <ReleaseClassificationBadges
                                  releaseFormat={item.release_format}
                                  contextTags={item.context_tags}
                                  language={language}
                                />
                              </div>
                            </div>
                            <h3>{item.headline}</h3>
                            <p className="signal-meta">
                              {formatSourceDomain(item.source_domain, language)} ·{' '}
                              {formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}
                            </p>
                            {formatUpcomingEvidenceMeta(item, language) ? (
                              <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                            ) : null}
                            {item.evidence_summary ? (
                              <p className="signal-evidence">{item.evidence_summary}</p>
                            ) : null}
                            <div className="action-stack">
                              <div className="action-row">
                                <ActionButton variant="primary" onClick={() => openTeamPage(item.group, item.entitySlug)}>
                                  {teamCopy.action}
                                </ActionButton>
                              </div>
                              <div className="meta-links">
                                {item.source_url ? (
                                  <a href={item.source_url} target="_blank" rel="noreferrer" className="meta-link">
                                    {copy.sourceLink}
                                  </a>
                                ) : (
                                  <span className="signal-link-muted">{copy.noSourceLink}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="signal-date-wrap">
                            <time>{formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}</time>
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="empty-copy">{copy.noUpcomingCandidates}</p>
                )}
              </div>
            </section>

            <div id="dashboard-radar" className="sidebar-radar-stack scroll-anchor-section">
              <SurfaceRuntimeStatus
                language={language}
                source={radarSurfaceStatus.source}
                errorCode={radarSurfaceStatus.errorCode}
                traceId={radarSurfaceStatus.traceId}
                message={radarSurfaceStatus.message}
                className="radar-runtime-status"
              />
              <section className="panel">
                <p className="panel-label">{copy.longGapRadar}</p>
                <h2>{copy.longGapRadarTitle}</h2>
                <LongGapRadarList
                  entries={visibleLongGapRadar}
                  language={language}
                  displayDateFormatter={displayDateFormatter}
                  onOpenTeamPage={openTeamPage}
                />
              </section>

              <section className="panel">
                <p className="panel-label">{copy.rookieRadar}</p>
                <h2>{copy.rookieRadarTitle}</h2>
                <RookieRadarList
                  entries={visibleRookieRadar}
                  language={language}
                  displayDateFormatter={displayDateFormatter}
                  onOpenTeamPage={openTeamPage}
                />
              </section>
            </div>

            <section id="dashboard-recent-feed" className="panel scroll-anchor-section">
              <p className="panel-label">{copy.recentFeed}</p>
              <h2>{copy.newestReleasesFirst}</h2>
              <div className="feed-list">
                {hasSearchQuery
                  ? visibleSearchReleases.map((item) => (
                      <article key={item.releaseId} className="feed-row">
                        <div>
                          <div className="signal-head">
                            <span className="team-directory-kicker">{item.displayName}</span>
                            <span className="signal-badge">{describeSearchReleaseResult(item, language)}</span>
                          </div>
                          <h3>{item.releaseTitle}</h3>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="inline-button"
                              onClick={() => openTeamPageBySlug(item.entitySlug)}
                            >
                              {teamCopy.action}
                            </button>
                          </div>
                        </div>
                        <time>{formatOptionalDate(item.releaseDate, shortDateFormatter, copy.none)}</time>
                      </article>
                    ))
                  : defaultSearchReleases.map((item) => (
                      <article key={`${item.group}-${item.stream}-${item.title}`} className="feed-row">
                        <div>
                          <div className="signal-head">
                            <TeamIdentity group={item.group} variant="list" />
                            <span className="signal-badge">{describeRelease(item, language)}</span>
                          </div>
                          <h3>{item.title}</h3>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="inline-button"
                              onClick={() => openTeamPage(item.group, item.entitySlug)}
                            >
                              {teamCopy.action}
                            </button>
                          </div>
                          <MusicHandoffRow
                            group={item.group}
                            title={item.title}
                            canonicalUrls={item.music_handoffs}
                            language={language}
                            compact
                          />
                        </div>
                        <time>{shortDateFormatter.format(item.dateValue)}</time>
                      </article>
                    ))}
              </div>
            </section>

            <section className="panel">
              <p className="panel-label">{teamCopy.pagesPanelLabel}</p>
              <h2>{teamCopy.pagesPanelTitle}</h2>
              <div className="team-directory">
                {(hasSearchQuery ? visibleSearchTeams.length : defaultSearchTeams.length) ? (
                  hasSearchQuery ? (
                    visibleSearchTeams.map((team) => (
                      <button
                        type="button"
                        key={team.entitySlug}
                        className="team-directory-button"
                        onClick={() => openTeamPageBySlug(team.entitySlug)}
                      >
                        <span>{team.displayName}</span>
                        <strong>{describeSearchEntityResult(team, language, displayDateFormatter, teamCopy.noSignal)}</strong>
                      </button>
                    ))
                  ) : (
                    defaultSearchTeams.map((team) => (
                      <button
                        type="button"
                        key={`${team.group}-${team.entitySlug ?? team.displayName}`}
                        className="team-directory-button"
                        onClick={() => openTeamPage(team.group, team.entitySlug)}
                      >
                        <span>{team.displayName}</span>
                        <strong>
                          {team.nextUpcomingSignal
                            ? describeUpcomingSignal(team.nextUpcomingSignal, language, displayDateFormatter, copy.none)
                            : teamCopy.noSignal}
                        </strong>
                      </button>
                    ))
                  )
                ) : (
                  <p className="empty-copy">{teamCopy.noTeamMatch}</p>
                )}
              </div>
            </section>

            <section className="panel">
              <p className="panel-label">{copy.dataState}</p>
              <h2>{copy.pipelineNotes}</h2>
              <div className="meta-grid">
                <MetaItem
                  label={copy.latestVerified}
                  value={
                    latestRelease
                      ? `${latestRelease.group} · ${formatDisplayDate(latestRelease.date, displayDateFormatter)}`
                      : copy.none
                  }
                />
                <MetaItem
                  label={copy.earliestInRange}
                  value={
                    earliestRelease
                      ? `${earliestRelease.group} · ${formatDisplayDate(earliestRelease.date, displayDateFormatter)}`
                      : copy.none
                  }
                />
                <MetaItem
                  label={copy.openQuestions}
                  value={copy.none}
                />
              </div>
            </section>
        </aside>
      </main>
      )}

      {!selectedTeam && !selectedAlbum ? (
        <FloatingSectionNavigator
          items={dashboardSectionNavigatorItems}
          activeSectionId={activeDashboardSectionId}
          expanded={isSectionNavigatorExpanded}
          language={language}
          onToggle={() => setIsSectionNavigatorExpanded((current) => !current)}
          onSelectSection={handleJumpToDashboardSection}
        />
      ) : null}

      {!selectedTeam && latestRelease ? (
        <footer className="inline-note">
          {teamCopy.latestNow}: {latestRelease.group} · {latestRelease.title}
        </footer>
      ) : null}
    </div>
  )
}

function ReleaseDetailPage({
  album,
  group,
  entitySlug,
  language,
  displayDateFormatter,
  onBack,
  onOpenTeamPage,
}: {
  album: VerifiedRelease
  group: string
  entitySlug: string
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onBack: () => void
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
}) {
  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]
  const displayName = getTeamDisplayName(group)
  const releaseDetailResource = useReleaseDetailResource({ album, group, entitySlug })
  const releaseDetailSnapshot = releaseDetailResource.snapshot
  const artwork =
    releaseDetailSnapshot?.artwork ?? buildPlaceholderReleaseArtwork(group, album.title, album.date, album.stream, album.release_kind)
  const releaseDetail = releaseDetailSnapshot?.detail ?? null
  const releaseEnrichment = releaseDetail
    ? buildFallbackReleaseEnrichment(group, album.title, album.date, album.stream, album.release_kind)
    : null
  const releaseDisplayTitle = releaseDetail?.isFallback ? album.title : releaseDetail?.release_title ?? album.title
  const hasCanonicalTracks = releaseDetail ? releaseDetail.tracks.length > 0 : false
  const canonicalHandoffs = buildReleaseDetailHandoffs(releaseDetail)
  const mv = releaseDetail ? getReleaseDetailMvUrls(releaseDetail) : { canonicalUrl: '', embedUrl: '' }
  const primaryTitleTrack = releaseDetail ? getPrimaryTitleTrackTitle(releaseDetail) || album.title : album.title
  const mvSearchUrl = mv.canonicalUrl ? '' : buildYouTubeMvSearchUrl(`${group} ${primaryTitleTrack}`.trim())
  const releaseStatusDisclosure = releaseDetail ? buildReleaseCanonicalStatusDisclosure(releaseDetail, language) : null
  const releaseDetailSourceStatus = {
    source: releaseDetailResource.source,
    errorCode: releaseDetailResource.loading ? null : releaseDetailResource.errorCode,
    traceId: releaseDetailResource.traceId,
    message: releaseDetailResource.loading
      ? teamCopy.releaseDetailBackendLoading
      : releaseDetailResource.source === 'json'
        ? teamCopy.releaseDetailBridgeActive
        : releaseDetailResource.source === 'api'
          ? teamCopy.releaseDetailBackendActive
          : releaseDetailResource.errorCode === 'timeout'
            ? teamCopy.releaseDetailBackendTimeout
            : releaseDetailResource.errorCode === 'not_found' || releaseDetailResource.errorCode === 'lookup_404'
              ? teamCopy.releaseDetailBackendNotFound
              : teamCopy.releaseDetailBackendUnavailable,
  }

  return (
    <main className="release-detail-page">
      <section className="panel release-detail-shell">
        <div className="release-detail-head">
          <div>
            <p className="panel-label">{album.release_kind === 'single' ? teamCopy.releaseDetail : teamCopy.albumDetail}</p>
            <h2>{releaseDisplayTitle}</h2>
            <p className="hero-text drawer-copy">
              {displayName} · {formatOptionalDate(album.date, displayDateFormatter, copy.none)}
            </p>
          </div>
          <div className="release-detail-head-actions">
            <button type="button" className="ghost-button" onClick={onBack}>
              {teamCopy.releasePageBack}
            </button>
            <ActionButton variant="secondary" onClick={() => onOpenTeamPage(group)}>
              {teamCopy.action}
            </ActionButton>
          </div>
        </div>

        <SurfaceRuntimeStatus
          language={language}
          source={releaseDetailSourceStatus.source}
          errorCode={releaseDetailSourceStatus.errorCode}
          traceId={releaseDetailSourceStatus.traceId}
          message={releaseDetailSourceStatus.message}
          className="release-runtime-status"
        />

        <div className="album-drawer-cover release-detail-cover">
          <ReleaseArtworkFigure
            artwork={artwork}
            alt={`${displayName} ${album.title} cover artwork`}
            variant="feature"
          />
          <div>
            <p className="panel-label">{teamCopy.placeholderCover}</p>
            <h3>{displayName}</h3>
            <p className="signal-meta">
              {formatReleaseFormat(album.release_format, language)} ·{' '}
              {formatOptionalDate(album.date, displayDateFormatter, copy.none)}
            </p>
            {album.context_tags.length ? (
              <div className="classification-row">
                <ReleaseClassificationBadges
                  releaseFormat=""
                  contextTags={album.context_tags}
                  language={language}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="meta-grid">
          <MetaItem label={teamCopy.team} value={displayName} />
          <MetaItem label={teamCopy.releaseKind} value={formatReleaseFormat(album.release_format, language)} />
          <MetaItem
            label={teamCopy.releaseDate}
            value={formatOptionalDate(album.date, displayDateFormatter, copy.none)}
          />
          <MetaItem label={teamCopy.stream} value={copy.streamLabels[album.stream]} />
        </div>

        <section className="track-preview">
          <p className="panel-label">{teamCopy.trackPreview}</p>
          {releaseDetail && hasCanonicalTracks ? (
            <>
              <div className="track-list">
                {releaseDetail.tracks.map((track) => (
                  <div key={`${album.title}-${track.title}-${track.order}`} className="track-row">
                    <div className="track-row-main">
                      <span>{`${track.order}`.padStart(2, '0')}</span>
                      <div className="track-row-title-group">
                        <strong>{track.title}</strong>
                        {track.is_title_track ? (
                          <span className="title-track-badge">{`★ ${copy.contextTagLabels.title_track}`}</span>
                        ) : null}
                      </div>
                    </div>
                    <MusicHandoffRow group={group} title={track.title} language={language} compact includeMv={false} />
                  </div>
                ))}
              </div>
              <p className="hero-text drawer-copy">{teamCopy.trackPreviewHint}</p>
            </>
          ) : releaseDetail ? (
            <div className="tracklist-incomplete">
              <strong>{teamCopy.trackDataIncompleteTitle}</strong>
              <p>{teamCopy.trackDataIncomplete}</p>
            </div>
          ) : (
            <div className="tracklist-incomplete">
              <strong>{teamCopy.backendUnavailable}</strong>
              <p>{teamCopy.releaseDetailBackendUnavailable}</p>
            </div>
          )}
        </section>

        {releaseStatusDisclosure ? (
          <section className="track-preview">
            <p className="panel-label">{releaseStatusDisclosure.title}</p>
            <div className="tracklist-incomplete status-disclosure">
              {releaseStatusDisclosure.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        ) : null}

        {releaseDetail?.notes ? (
          <section className="track-preview">
            <p className="panel-label">{teamCopy.releaseNotes}</p>
            <p className="hero-text drawer-copy">{releaseDetail.notes}</p>
          </section>
        ) : null}

        <section className="official-mv-section">
          <p className="panel-label">{teamCopy.officialMv}</p>
          <p className="hero-text drawer-copy">{teamCopy.officialMvHint}</p>
          {mv.canonicalUrl && mv.embedUrl ? (
            <>
              <div className="official-mv-frame-shell">
                <iframe
                  className="official-mv-frame"
                  src={mv.embedUrl}
                  title={`${displayName} ${album.title} official MV`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="meta-links">
                <a href={mv.canonicalUrl} target="_blank" rel="noreferrer" className="meta-link">
                  {teamCopy.watchOnYouTube}
                </a>
              </div>
            </>
          ) : (
            <div className="official-mv-empty">
              <p className="hero-text drawer-copy">{teamCopy.officialMvUnavailable}</p>
              {mvSearchUrl ? (
                <div className="meta-links">
                  <a href={mvSearchUrl} target="_blank" rel="noreferrer" className="meta-link">
                    {teamCopy.watchOnYouTube}
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {releaseEnrichment ? (
          <ReleaseEnrichmentSection
            enrichment={releaseEnrichment}
            language={language}
            displayDateFormatter={displayDateFormatter}
          />
        ) : null}

        <p className="hero-text drawer-copy">{teamCopy.drawerCopy}</p>
        <div className="action-stack">
          <MusicHandoffRow
            group={group}
            title={album.title}
            canonicalUrls={canonicalHandoffs}
            mvUrl={mv.canonicalUrl}
            mvSearchTitle={primaryTitleTrack}
            language={language}
            showHint
          />
          <div className="meta-links">
            <a href={album.source} target="_blank" rel="noreferrer" className="meta-link">
              {copy.releaseSource}
            </a>
            <a href={album.artist_source} target="_blank" rel="noreferrer" className="meta-link">
              {copy.artistSource}
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

function ActionButton({
  children,
  variant,
  onClick,
}: {
  children: ReactNode
  variant: 'primary' | 'secondary'
  onClick: () => void
}) {
  return (
    <button type="button" className={`action-button action-button-${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}

function ServiceMark({ service }: { service: ServiceActionId }) {
  if (service === 'spotify') {
    return (
      <svg viewBox="0 0 24 24" className="service-mark-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 10.2c3.4-1.1 6.5-.9 9.4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 13c2.6-.7 5-.5 7.1.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9 15.6c1.8-.4 3.5-.3 5 .3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (service === 'youtube_music') {
    return (
      <svg viewBox="0 0 24 24" className="service-mark-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.7 9.4v5.2l4.4-2.6-4.4-2.6Z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="service-mark-icon" aria-hidden="true">
      <rect x="4" y="6.3" width="16" height="11.4" rx="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.3 9.5v5l4.6-2.5-4.6-2.5Z" fill="currentColor" />
    </svg>
  )
}

function MusicHandoffRow({
  group,
  title,
  canonicalUrls,
  language,
  compact = false,
  showHint = false,
  mvUrl = '',
  mvSearchTitle = '',
  includeMv = true,
  allowMvSearchFallback = true,
}: {
  group: string
  title: string
  canonicalUrls?: MusicHandoffUrls
  language: Language
  compact?: boolean
  showHint?: boolean
  mvUrl?: string
  mvSearchTitle?: string
  includeMv?: boolean
  allowMvSearchFallback?: boolean
}) {
  const copy = TRANSLATIONS[language]
  const links = buildServiceActionLinks({
    group,
    title,
    canonicalUrls,
    mvUrl,
    includeMv,
    allowMvSearchFallback,
    searchTitles: mvSearchTitle
      ? {
          youtube_mv: mvSearchTitle,
        }
      : undefined,
  })

  return (
    <>
      <div className={`handoff-row ${compact ? 'handoff-row-compact' : ''}`}>
        {links.map((link) => (
          <a
            key={`${group}-${title}-${link.service}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => handleMusicHandoffClick(event, link)}
            className={`handoff-link handoff-link-${link.service}`}
            aria-label={`${copy.musicServices[link.service]} · ${copy.handoffModeLabels[link.mode]}`}
            title={`${copy.musicServices[link.service]} · ${copy.handoffModeLabels[link.mode]}`}
          >
            <span className={`service-mark service-mark-${link.service}`} aria-hidden="true">
              <ServiceMark service={link.service} />
            </span>
            <span className="handoff-link-label">{copy.musicServices[link.service]}</span>
          </a>
        ))}
      </div>
      {showHint ? <p className="handoff-note">{copy.handoffHint}</p> : null}
    </>
  )
}

function ReleaseEnrichmentSection({
  enrichment,
  language,
  displayDateFormatter,
}: {
  enrichment: ResolvedReleaseEnrichment
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
}) {
  const teamCopy = TEAM_COPY[language]
  const creditBlocks = [
    {
      label: teamCopy.lyricsCredits,
      values: enrichment.credits.lyrics,
    },
    {
      label: teamCopy.compositionCredits,
      values: enrichment.credits.composition,
    },
    {
      label: teamCopy.arrangementCredits,
      values: enrichment.credits.arrangement,
    },
  ].filter((block) => block.values.length)
  const hasContent = creditBlocks.length || enrichment.charts.length || enrichment.notes

  return (
    <section className="release-enrichment">
      <p className="panel-label">{teamCopy.releaseEnrichment}</p>
      <p className="hero-text drawer-copy">{teamCopy.releaseEnrichmentHint}</p>
      {enrichment.isFallback || !hasContent ? (
        <p className="hero-text drawer-copy">{teamCopy.releaseEnrichmentEmpty}</p>
      ) : (
        <div className="release-enrichment-grid">
          {creditBlocks.map((block) => (
            <section key={block.label} className="release-enrichment-block">
              <h4>{block.label}</h4>
              <ul className="release-enrichment-list">
                {block.values.map((value) => (
                  <li key={`${block.label}-${value}`}>{value}</li>
                ))}
              </ul>
            </section>
          ))}

          {enrichment.charts.length ? (
            <section className="release-enrichment-block">
              <h4>{teamCopy.chartHighlights}</h4>
              <ul className="release-enrichment-list release-enrichment-chart-list">
                {enrichment.charts.map((chart) => (
                  <li
                    key={`${chart.source}-${chart.label}-${chart.peak}-${chart.dated_at}`}
                    className="release-enrichment-chart-item"
                  >
                    <strong>{`${chart.label} · ${chart.peak}`}</strong>
                    <span>
                      {chart.source} · {formatOptionalDate(chart.dated_at, displayDateFormatter, chart.dated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {enrichment.notes ? (
            <section className="release-enrichment-block">
              <h4>{teamCopy.metadataNotes}</h4>
              <p className="hero-text drawer-copy">{enrichment.notes}</p>
            </section>
          ) : null}
        </div>
      )}
    </section>
  )
}

function TeamFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="team-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TeamIdentity({
  group,
  variant,
}: {
  group: string
  variant: 'chip' | 'list'
}) {
  const identityImageUrl = getTeamBadgeImageUrl(group) ?? getTeamRepresentativeImageUrl(group)
  const badgeStyle = getTeamBadgeStyle(group)
  const displayName = getTeamDisplayName(group)
  const label = variant === 'chip' ? getCompactTeamLabel(displayName) : displayName

  return (
    <span
      className={`team-identity team-identity-${variant}`}
      title={displayName}
      aria-label={displayName}
    >
      <span className="team-badge" style={badgeStyle} aria-hidden="true">
        {identityImageUrl ? (
          <img className="team-badge-image" src={identityImageUrl} alt="" />
        ) : (
          <span className="team-badge-fallback">{getTeamMonogram(group)}</span>
        )}
      </span>
      <span className="team-label">{label}</span>
    </span>
  )
}

function SourceBadge({
  sourceType,
  language,
}: {
  sourceType: string
  language: Language
}) {
  const normalizedSourceType = normalizeSourceType(sourceType)
  const label = formatSourceType(normalizedSourceType, language)

  return (
    <span className={`source-badge source-badge-${normalizedSourceType}`} title={label} aria-label={label}>
      <span className="source-badge-icon" aria-hidden="true">
        <SourceTypeIcon sourceType={normalizedSourceType} />
      </span>
      <span className="source-badge-label">{label}</span>
    </span>
  )
}

function SourceTypeIcon({ sourceType }: { sourceType: SourceBadgeType }) {
  switch (sourceType) {
    case 'agency_notice':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11v2" />
          <path d="M6 10h4l7-4v12l-7-4H6z" />
          <path d="M10 15.5 11.8 20" />
        </svg>
      )
    case 'weverse_notice':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 6.5h9a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H11l-4 3v-3H5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z" />
          <path d="M8 10.5h6" />
          <path d="M8 13.5h4" />
        </svg>
      )
    case 'news_rss':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 6h14v12H5z" />
          <path d="M8 10h8" />
          <path d="M8 13h5" />
          <path d="M8 16h8" />
        </svg>
      )
    case 'database':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="7" rx="6.5" ry="2.5" />
          <path d="M5.5 7v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V7" />
          <path d="M5.5 12v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
        </svg>
      )
    case 'pending':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M9.6 9.2a2.6 2.6 0 1 1 4.5 1.7c-.7.7-1.4 1.1-1.7 1.8" />
          <path d="M12 16.8h.01" />
        </svg>
      )
  }
}

function ReleaseArtworkFigure({
  artwork,
  alt,
  variant,
}: {
  artwork: ResolvedReleaseArtwork
  alt: string
  variant: 'feature' | 'card' | 'drawer'
}) {
  return (
    <div
      className={[
        'release-artwork',
        `release-artwork-${variant}`,
        artwork.isPlaceholder ? 'release-artwork-placeholder' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img
        className="release-artwork-image"
        src={variant === 'drawer' ? artwork.cover_image_url : artwork.thumbnail_image_url}
        alt={alt}
        loading={variant === 'drawer' ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  )
}

function UpcomingCountdownBadge({
  item,
  formatter,
}: {
  item: UpcomingCandidateRow
  formatter: Intl.DateTimeFormat
}) {
  const countdownState = getUpcomingCountdownState(item)
  if (!countdownState) {
    return null
  }

  return (
    <span className={`signal-badge signal-badge-countdown signal-badge-countdown-${countdownState}`}>
      {formatUpcomingCountdownLabel(countdownState, item.scheduled_date, formatter)}
    </span>
  )
}

function ReleaseChangeBadge({
  group,
  language,
}: {
  group: string
  language: Language
}) {
  const latestChange = latestReleaseChangeByGroup.get(group)
  if (!latestChange) {
    return null
  }

  return (
    <span className={`signal-badge signal-badge-change signal-badge-change-${latestChange.change_type}`}>
      {formatReleaseChangeType(latestChange.change_type, language)}
    </span>
  )
}

function ReleaseChangeLogList({
  changes,
  language,
  formatter,
}: {
  changes: ReleaseChangeLogRow[]
  language: Language
  formatter: Intl.DateTimeFormat
}) {
  const copy = TRANSLATIONS[language]

  return (
    <div className="change-log-list">
      {changes.map((change) => (
        <article key={change.key} className="change-log-item">
          <div className="change-log-head">
            <div>
              <p className="change-log-date">
                {formatSourceTimelineDate(change.occurred_at, formatter, copy.none)}
              </p>
              <h4>{formatReleaseChangeType(change.change_type, language)}</h4>
            </div>
            <span className={`signal-badge signal-badge-change signal-badge-change-${change.change_type}`}>
              {change.snapshot.previous_ref} {'->'} {change.snapshot.next_ref}
            </span>
          </div>
          <p className="signal-meta">{change.source_domain || copy.sourceTypeLabels.pending}</p>
          <p className="change-log-summary">{change.summary}</p>
          <div className="detail-links detail-links-stack">
            {change.source_url ? (
              <a href={change.source_url} target="_blank" rel="noreferrer">
                {copy.sourceLink}
              </a>
            ) : (
              <span className="signal-link-muted">{copy.noSourceLink}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function LongGapRadarList({
  entries,
  language,
  displayDateFormatter,
  onOpenTeamPage,
}: {
  entries: LongGapRadarEntry[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
}) {
  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]

  if (!entries.length) {
    return <p className="empty-copy">{copy.longGapRadarEmpty}</p>
  }

  return (
    <div className="detail-list">
      {entries.map((entry) => (
        <article
          key={entry.group}
          className={[
            'detail-card',
            'detail-card-long-gap',
            entry.hasUpcomingSignal ? 'detail-card-long-gap-signal' : 'detail-card-long-gap-idle',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="signal-head">
            <TeamIdentity group={entry.group} variant="list" />
            <div className="signal-tags">
              <span className={`signal-badge signal-badge-watch-reason-${entry.watchReason}`}>
                {formatWatchReason(entry.watchReason, language)}
              </span>
              <span
                className={`signal-badge signal-badge-long-gap-${
                  entry.hasUpcomingSignal ? 'signal' : 'idle'
                }`}
              >
                {entry.hasUpcomingSignal ? copy.longGapSignalPresent : copy.longGapSignalMissing}
              </span>
            </div>
          </div>
          <h3>{entry.latestRelease.title}</h3>
          <p className="signal-meta">
            {copy.longGapLastRelease} · {formatOptionalDate(entry.latestRelease.date, displayDateFormatter, copy.none)} ·{' '}
            {entry.latestRelease.verified ? teamCopy.verifiedRelease : teamCopy.watchlistFallback} ·{' '}
            {copy.longGapElapsed} {formatGapDuration(entry.gapDays, language)}
          </p>
          {entry.latestSignal ? (
            <div className="long-gap-signal">
              <p className="long-gap-signal-label">{copy.longGapLatestSignal}</p>
              <div className="signal-tags">
                <span className={`signal-badge signal-badge-date-${entry.latestSignal.date_status}`}>
                  {formatDateStatus(entry.latestSignal.date_status, language)}
                </span>
                <span
                  className={`signal-badge signal-badge-confidence-${getConfidenceTone(entry.latestSignal.confidence)}`}
                >
                  {formatConfidenceTone(getConfidenceTone(entry.latestSignal.confidence), language)}
                </span>
                <ReleaseClassificationBadges
                  releaseFormat={entry.latestSignal.release_format}
                  contextTags={entry.latestSignal.context_tags}
                  language={language}
                />
              </div>
              <p className="long-gap-signal-headline">{entry.latestSignal.headline}</p>
              <p className="signal-meta">
                {formatSourceType(entry.latestSignal.source_type, language)} ·{' '}
                {entry.latestSignal.source_domain || copy.sourceTypeLabels.pending} ·{' '}
                {formatUpcomingTimingLabel(entry.latestSignal, language, displayDateFormatter, copy.none)}
              </p>
              {entry.latestSignal.evidence_summary ? (
                <p className="signal-evidence">{entry.latestSignal.evidence_summary}</p>
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">{copy.longGapLatestSignalEmpty}</p>
          )}
          <div className="detail-links">
            <button type="button" className="inline-button" onClick={() => onOpenTeamPage(entry.group, entry.entitySlug)}>
              {teamCopy.action}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function RookieRadarList({
  entries,
  language,
  displayDateFormatter,
  onOpenTeamPage,
}: {
  entries: RookieRadarEntry[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
}) {
  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]

  if (!entries.length) {
    return <p className="empty-copy">{copy.rookieRadarEmpty}</p>
  }

  return (
    <div className="detail-list">
      {entries.map((entry) => (
        <article
          key={entry.group}
          className={[
            'detail-card',
            'detail-card-rookie',
            entry.hasUpcomingSignal ? 'detail-card-rookie-signal' : 'detail-card-rookie-idle',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="signal-head">
            <TeamIdentity group={entry.group} variant="list" />
            <div className="signal-tags">
              <span className="signal-badge signal-badge-rookie">{copy.rookieBadge}</span>
              <span
                className={`signal-badge signal-badge-rookie-${
                  entry.hasUpcomingSignal ? 'signal' : 'idle'
                }`}
              >
                {entry.hasUpcomingSignal ? copy.rookieSignalPresent : copy.rookieSignalMissing}
              </span>
            </div>
          </div>

          <div className="meta-grid rookie-fact-grid">
            <MetaItem
              label={copy.rookieDebutYear}
              value={entry.debutYear ? String(entry.debutYear) : copy.none}
            />
            <MetaItem
              label={copy.rookieLatestRelease}
              value={
                entry.latestRelease
                  ? `${entry.latestRelease.title} · ${formatOptionalDate(
                      entry.latestRelease.date,
                      displayDateFormatter,
                      copy.none,
                    )}`
                  : teamCopy.latestEmptyTitle
              }
            />
          </div>

          <p className="signal-meta">
            {entry.latestRelease
              ? entry.latestRelease.verified
                ? teamCopy.verifiedRelease
                : teamCopy.watchlistFallback
              : teamCopy.latestEmptyTitle}
          </p>

          {entry.latestSignal ? (
            <div className="rookie-signal">
              <p className="rookie-signal-label">{copy.rookieLatestSignal}</p>
              <div className="signal-tags">
                <span className={`signal-badge signal-badge-date-${entry.latestSignal.date_status}`}>
                  {formatDateStatus(entry.latestSignal.date_status, language)}
                </span>
                <span
                  className={`signal-badge signal-badge-confidence-${getConfidenceTone(entry.latestSignal.confidence)}`}
                >
                  {formatConfidenceTone(getConfidenceTone(entry.latestSignal.confidence), language)}
                </span>
                <ReleaseClassificationBadges
                  releaseFormat={entry.latestSignal.release_format}
                  contextTags={entry.latestSignal.context_tags}
                  language={language}
                />
              </div>
              <p className="rookie-signal-headline">{entry.latestSignal.headline}</p>
              <p className="signal-meta">
                {formatSourceType(entry.latestSignal.source_type, language)} ·{' '}
                {entry.latestSignal.source_domain || copy.sourceTypeLabels.pending} ·{' '}
                {formatUpcomingTimingLabel(entry.latestSignal, language, displayDateFormatter, copy.none)}
              </p>
              {entry.latestSignal.evidence_summary ? (
                <p className="signal-evidence">{entry.latestSignal.evidence_summary}</p>
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">{copy.rookieLatestSignalEmpty}</p>
          )}

          <div className="detail-links">
            <button type="button" className="inline-button" onClick={() => onOpenTeamPage(entry.group, entry.entitySlug)}>
              {teamCopy.action}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function WeeklyMustListenDigest({
  sectionId,
  rows,
  windowStartDate,
  windowEndDate,
  language,
  displayDateFormatter,
  onOpenReleaseDetail,
}: {
  sectionId?: string
  rows: VerifiedRelease[]
  windowStartDate: Date | null
  windowEndDate: Date | null
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const copy = TRANSLATIONS[language]
  const windowLabel =
    windowStartDate && windowEndDate
      ? `${displayDateFormatter.format(windowStartDate)} - ${displayDateFormatter.format(windowEndDate)}`
      : copy.none

  return (
    <section id={sectionId} className="panel weekly-digest scroll-anchor-section">
      <div className="monthly-dashboard-head">
        <div>
          <p className="panel-label">{copy.weeklyDigest}</p>
          <h2>{copy.weeklyDigestTitle}</h2>
        </div>
        <span className="sidebar-panel-count">{rows.length}</span>
      </div>

      <div className="weekly-digest-meta">
        <div className="meta-item">
          <span>{copy.weeklyDigestWindow}</span>
          <strong>{windowLabel}</strong>
        </div>
        <div className="meta-item">
          <span>{copy.weeklyDigestCards}</span>
          <strong>
            {rows.length} / {WEEKLY_DIGEST_MAX_ITEMS}
          </strong>
        </div>
      </div>

      {rows.length ? (
        <div className="weekly-digest-grid">
          {rows.map((item) => (
            <article key={`weekly-digest-${getAlbumKey(item)}`} className="detail-card weekly-digest-card">
              <div className="signal-head">
                <TeamIdentity group={item.group} variant="list" />
                <div className="signal-tags">
                  <ReleaseClassificationBadges
                    releaseFormat={item.release_format}
                    contextTags={item.context_tags}
                    language={language}
                  />
                </div>
              </div>
              <h3>{item.title}</h3>
              <p className="signal-meta">{formatOptionalDate(item.date, displayDateFormatter, copy.none)}</p>
              <div className="action-stack">
                <div className="action-row">
                  <ActionButton variant="primary" onClick={() => onOpenReleaseDetail(item)}>
                    {getReleaseDetailActionLabel(item.release_kind, language)}
                  </ActionButton>
                </div>
                <DashboardServiceActions release={item} language={language} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{copy.weeklyDigestEmpty}</p>
      )}
    </section>
  )
}

function AnnualReleaseTimeline({
  sections,
  language,
  displayDateFormatter,
  onOpenReleaseDetail,
}: {
  sections: AnnualReleaseTimelineSection[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const teamCopy = TEAM_COPY[language]
  const copy = TRANSLATIONS[language]

  return (
    <section className="panel annual-release-timeline">
      <div className="team-subsection-head">
        <p className="panel-label">{teamCopy.annualTimelineLabel}</p>
        <h2>{sections.length ? teamCopy.annualTimelineTitle : teamCopy.annualTimelineEmptyTitle}</h2>
        <p className="team-subsection-copy">{teamCopy.annualTimelineIntro}</p>
      </div>

      {sections.length ? (
        <div className="annual-release-year-stack">
          {sections.map((section) => (
            <section key={section.year} className="annual-release-year-section">
              <div className="annual-release-year-head">
                <h3>{section.year}</h3>
                <span className="selected-day-panel-count">{section.items.length}</span>
              </div>
              <ol className="annual-release-list">
                {section.items.map((item, index) => (
                  <li
                    key={`${item.kind}-${item.occurredAt}-${item.kind === 'release' ? getAlbumKey(item.release) : item.signal.headline}`}
                    className="annual-release-item"
                  >
                    <div className="annual-release-rail" aria-hidden="true">
                      <span
                        className={`annual-release-dot annual-release-dot-${item.kind === 'release' ? 'release' : 'scheduled'}`}
                      />
                      {index < section.items.length - 1 ? <span className="annual-release-line" /> : null}
                    </div>
                    {item.kind === 'release' ? (
                      <article className="annual-release-card">
                        <div className="annual-release-card-head">
                          <div className="signal-tags">
                            <span className="signal-badge signal-badge-annual-release">
                              {teamCopy.annualTimelineReleaseMarker}
                            </span>
                            <ReleaseClassificationBadges
                              releaseFormat={item.release.release_format}
                              contextTags={item.release.context_tags}
                              language={language}
                            />
                          </div>
                          <p className="source-timeline-date">
                            {formatOptionalDate(item.release.date, displayDateFormatter, copy.none)}
                          </p>
                        </div>
                        <h3>{item.release.title}</h3>
                        <p className="signal-meta">
                          {formatReleaseFormat(item.release.release_format, language) || item.release.release_kind}
                        </p>
                        <div className="action-stack">
                          <div className="action-row">
                            <ActionButton variant="primary" onClick={() => onOpenReleaseDetail(item.release)}>
                              {getReleaseDetailActionLabel(item.release.release_kind, language)}
                            </ActionButton>
                          </div>
                          <DashboardServiceActions release={item.release} language={language} />
                        </div>
                      </article>
                    ) : (
                      <article className="annual-release-card annual-release-card-scheduled">
                        <div className="annual-release-card-head">
                          <div className="signal-tags">
                            <span className="signal-badge signal-badge-annual-scheduled">
                              {teamCopy.annualTimelineScheduledMarker}
                            </span>
                            <span className={`signal-badge signal-badge-date-${item.signal.date_status}`}>
                              {formatDateStatus(item.signal.date_status, language)}
                            </span>
                          </div>
                          <p className="source-timeline-date">
                            {formatUpcomingTimingLabel(item.signal, language, displayDateFormatter, copy.none)}
                          </p>
                        </div>
                        <h3>{item.signal.headline}</h3>
                        <p className="signal-meta">
                          {formatSourceType(item.signal.source_type, language)} ·{' '}
                          {item.signal.source_domain || copy.sourceTypeLabels.pending}
                        </p>
                        <div className="meta-links">
                          {item.signal.source_url ? (
                            <a href={item.signal.source_url} target="_blank" rel="noreferrer" className="meta-link">
                              {copy.sourceLink}
                            </a>
                          ) : (
                            <span className="signal-link-muted">{copy.noSourceLink}</span>
                          )}
                        </div>
                      </article>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{teamCopy.annualTimelineEmpty}</p>
      )}
    </section>
  )
}

function CompareTeamView({
  primaryTeam,
  secondaryTeam,
  primarySnapshot,
  secondarySnapshot,
  compareOptions,
  selectedCompareGroup,
  language,
  displayDateFormatter,
  onSelectCompareGroup,
  onOpenTeamPage,
  onOpenReleaseDetail,
  onClearCompare,
}: {
  primaryTeam: TeamProfile
  secondaryTeam: TeamProfile | null
  primarySnapshot: TeamCompareSnapshot | null
  secondarySnapshot: TeamCompareSnapshot | null
  compareOptions: TeamCompareOption[]
  selectedCompareGroup: string | null
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onSelectCompareGroup: (group: string | null) => void
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
  onOpenReleaseDetail: (release: VerifiedRelease) => void
  onClearCompare: () => void
}) {
  const teamCopy = TEAM_COPY[language]

  return (
    <section className="panel compare-view">
      <div className="compare-view-head">
        <div>
          <p className="panel-label">{teamCopy.compareHelperLabel}</p>
          <h2>{teamCopy.compareViewTitle}</h2>
        </div>
        {secondaryTeam ? (
          <ActionButton variant="secondary" onClick={onClearCompare}>
            {teamCopy.compareClear}
          </ActionButton>
        ) : null}
      </div>

      <div className="compare-helper">
        <label className="compare-select-field">
          <span>{teamCopy.compareSelectLabel}</span>
          <select value={selectedCompareGroup ?? ''} onChange={(event) => onSelectCompareGroup(event.target.value || null)}>
            <option value="">{teamCopy.compareSelectPlaceholder}</option>
            {compareOptions.map((team) => (
              <option key={team.entitySlug} value={team.entitySlug}>
                {team.displayName}
              </option>
            ))}
          </select>
        </label>
        <p className="hero-text compare-helper-copy">{teamCopy.compareHelperHint}</p>
      </div>

      {secondaryTeam && primarySnapshot && secondarySnapshot ? (
        <>
          <div className="compare-summary-grid">
            <article className="compare-summary-card">
              <TeamIdentity group={primaryTeam.group} variant="list" />
              <div className="action-row">
                <ActionButton variant="secondary" onClick={() => onOpenTeamPage(primaryTeam.group, primaryTeam.slug)}>
                  {teamCopy.action}
                </ActionButton>
              </div>
            </article>
            <article className="compare-summary-card">
              <TeamIdentity group={secondaryTeam.group} variant="list" />
              <div className="action-row">
                <ActionButton
                  variant="secondary"
                  onClick={() => onOpenTeamPage(secondaryTeam.group, secondaryTeam.slug)}
                >
                  {teamCopy.action}
                </ActionButton>
              </div>
            </article>
          </div>

          <div className="compare-metric-stack">
            <CompareMetricRow label={teamCopy.compareMetricLatestVerified}>
              <CompareReleaseCard
                release={primarySnapshot.latestVerifiedRelease}
                emptyLabel={teamCopy.compareNoRelease}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenReleaseDetail={onOpenReleaseDetail}
              />
              <CompareReleaseCard
                release={secondarySnapshot.latestVerifiedRelease}
                emptyLabel={teamCopy.compareNoRelease}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenReleaseDetail={onOpenReleaseDetail}
              />
            </CompareMetricRow>

            <CompareMetricRow label={teamCopy.compareMetricLatestAlbumSong}>
              <CompareAlbumSongCard
                snapshot={primarySnapshot}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenReleaseDetail={onOpenReleaseDetail}
              />
              <CompareAlbumSongCard
                snapshot={secondarySnapshot}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenReleaseDetail={onOpenReleaseDetail}
              />
            </CompareMetricRow>

            <CompareMetricRow label={teamCopy.compareMetricUpcoming}>
              <CompareUpcomingCard
                signal={primarySnapshot.nextUpcomingSignal}
                language={language}
                displayDateFormatter={displayDateFormatter}
              />
              <CompareUpcomingCard
                signal={secondarySnapshot.nextUpcomingSignal}
                language={language}
                displayDateFormatter={displayDateFormatter}
              />
            </CompareMetricRow>

            <CompareMetricRow label={teamCopy.compareMetricYearCount}>
              <CompareCountCard count={primarySnapshot.recentYearReleaseCount} />
              <CompareCountCard count={secondarySnapshot.recentYearReleaseCount} />
            </CompareMetricRow>
          </div>
        </>
      ) : null}
    </section>
  )
}

function CompareMetricRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section className="compare-metric-row">
      <p className="compare-metric-label">{label}</p>
      <div className="compare-metric-grid">{children}</div>
    </section>
  )
}

function CompareReleaseCard({
  release,
  emptyLabel,
  language,
  displayDateFormatter,
  onOpenReleaseDetail,
}: {
  release: VerifiedRelease | null
  emptyLabel: string
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  if (!release) {
    return <p className="empty-copy compare-card-empty">{emptyLabel}</p>
  }

  return (
    <article className="compare-card">
      <div className="signal-tags">
        <ReleaseClassificationBadges
          releaseFormat={release.release_format}
          contextTags={release.context_tags}
          language={language}
        />
      </div>
      <h3>{release.title}</h3>
      <p className="signal-meta">{formatOptionalDate(release.date, displayDateFormatter, TRANSLATIONS[language].none)}</p>
      <div className="action-row">
        <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(release)}>
          {getReleaseDetailActionLabel(release.release_kind, language)}
        </ActionButton>
      </div>
    </article>
  )
}

function CompareAlbumSongCard({
  snapshot,
  language,
  displayDateFormatter,
  onOpenReleaseDetail,
}: {
  snapshot: TeamCompareSnapshot
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const teamCopy = TEAM_COPY[language]

  return (
    <article className="compare-card compare-card-double">
      <div className="compare-subcard">
        <span className="panel-label">{TRANSLATIONS[language].streamLabels.album}</span>
        {snapshot.latestAlbum ? (
          <>
            <h3>{snapshot.latestAlbum.title}</h3>
            <p className="signal-meta">
              {formatOptionalDate(snapshot.latestAlbum.date, displayDateFormatter, TRANSLATIONS[language].none)}
            </p>
            <div className="action-row">
              <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(snapshot.latestAlbum as VerifiedRelease)}>
                {getReleaseDetailActionLabel(snapshot.latestAlbum.release_kind, language)}
              </ActionButton>
            </div>
          </>
        ) : (
          <p className="empty-copy compare-card-empty">{teamCopy.compareNoAlbum}</p>
        )}
      </div>
      <div className="compare-subcard">
        <span className="panel-label">{TRANSLATIONS[language].streamLabels.song}</span>
        {snapshot.latestSong ? (
          <>
            <h3>{snapshot.latestSong.title}</h3>
            <p className="signal-meta">
              {formatOptionalDate(snapshot.latestSong.date, displayDateFormatter, TRANSLATIONS[language].none)}
            </p>
            <div className="action-row">
              <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(snapshot.latestSong as VerifiedRelease)}>
                {getReleaseDetailActionLabel(snapshot.latestSong.release_kind, language)}
              </ActionButton>
            </div>
          </>
        ) : (
          <p className="empty-copy compare-card-empty">{teamCopy.compareNoSong}</p>
        )}
      </div>
    </article>
  )
}

function CompareUpcomingCard({
  signal,
  language,
  displayDateFormatter,
}: {
  signal: UpcomingCandidateRow | null
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
}) {
  const teamCopy = TEAM_COPY[language]
  const copy = TRANSLATIONS[language]

  if (!signal) {
    return <p className="empty-copy compare-card-empty">{teamCopy.compareNoUpcoming}</p>
  }

  return (
    <article className="compare-card">
      <div className="signal-tags">
        <span className={`signal-badge signal-badge-date-${signal.date_status}`}>
          {formatDateStatus(signal.date_status, language)}
        </span>
        <SourceBadge sourceType={signal.source_type} language={language} />
      </div>
      <h3>{signal.headline}</h3>
      <p className="signal-meta">
        {formatUpcomingTimingLabel(signal, language, displayDateFormatter, copy.none)} ·{' '}
        {signal.source_domain || copy.sourceTypeLabels.pending}
      </p>
    </article>
  )
}

function CompareCountCard({ count }: { count: number }) {
  return (
    <article className="compare-card compare-count-card">
      <strong>{count}</strong>
    </article>
  )
}

function DashboardScheduledBucket({
  title,
  rows,
  language,
  displayDateFormatter,
  onOpenTeamPage,
}: {
  title: string
  rows: UpcomingCandidateRow[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
}) {
  const copy = TRANSLATIONS[language]

  return (
    <section className="dashboard-subsection">
      <div className="selected-day-panel-head dashboard-subsection-head">
        <h4>{title}</h4>
        <span className="selected-day-panel-count">{rows.length}</span>
      </div>
      <div className="dashboard-table-shell">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>{copy.dashboardTeam}</th>
              <th>{copy.dashboardScheduledTitle}</th>
              <th>{copy.dashboardStatus}</th>
              <th>{copy.dashboardFormat}</th>
              <th>{copy.dashboardDate}</th>
              <th>{copy.dashboardConfidence}</th>
              <th>{copy.dashboardSource}</th>
              <th>{copy.dashboardActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={getUpcomingDashboardRowKey(item)}>
                <td>
                  <TeamIdentity group={item.group} variant="list" />
                </td>
                <td>
                  <strong>{item.headline}</strong>
                  {formatUpcomingEvidenceMeta(item, language) ? (
                    <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                  ) : null}
                </td>
                <td>
                  <span className={`signal-badge signal-badge-date-${item.date_status}`}>
                    {formatDateStatus(item.date_status, language)}
                  </span>
                </td>
                <td>{formatReleaseFormat(item.release_format, language) || copy.none}</td>
                <td>{formatScheduledDashboardTimingLabel(item, language, displayDateFormatter, copy.none)}</td>
                <td>
                  <span className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}>
                    {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                  </span>
                </td>
                <td>
                  {item.source_url ? (
                    <a href={item.source_url} target="_blank" rel="noreferrer" className="dashboard-source-link">
                      {item.source_domain || copy.sourceLink}
                    </a>
                  ) : (
                    <span className="signal-link-muted">{copy.noSourceLink}</span>
                  )}
                </td>
                <td>
                  <div className="dashboard-table-actions">
                    <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                      {TEAM_COPY[language].action}
                    </ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dashboard-mobile-list">
        {rows.map((item) => (
          <article
            key={`mobile-${getUpcomingDashboardRowKey(item)}`}
            className={`detail-card dashboard-mobile-card detail-card-signal detail-card-signal-${item.date_status}`}
          >
            <div className="signal-head">
              <TeamIdentity group={item.group} variant="list" />
              <div className="signal-tags">
                <span className={`signal-badge signal-badge-date-${item.date_status}`}>
                  {formatDateStatus(item.date_status, language)}
                </span>
                <span className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}>
                  {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                </span>
              </div>
            </div>
            <h3>{item.headline}</h3>
            <p className="signal-meta">
              {formatReleaseFormat(item.release_format, language) || copy.none} ·{' '}
              {formatScheduledDashboardTimingLabel(item, language, displayDateFormatter, copy.none)}
            </p>
            <p className="signal-meta">
              {formatSourceType(item.source_type, language)} · {item.source_domain || copy.sourceTypeLabels.pending}
            </p>
            {formatUpcomingEvidenceMeta(item, language) ? (
              <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
            ) : null}
            <div className="action-stack">
              <div className="action-row">
                <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                  {TEAM_COPY[language].action}
                </ActionButton>
              </div>
              <div className="meta-links">
                {item.source_url ? (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="meta-link">
                    {copy.sourceLink}
                  </a>
                ) : (
                  <span className="signal-link-muted">{copy.noSourceLink}</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MonthlyReleaseDashboard({
  sectionId,
  monthLabel,
  verifiedRows,
  scheduledRows,
  monthOnlyRows,
  activeFilters,
  language,
  displayDateFormatter,
  onOpenTeamPage,
  onOpenReleaseDetail,
}: {
  sectionId?: string
  monthLabel: string
  verifiedRows: VerifiedRelease[]
  scheduledRows: DatedUpcomingSignal[]
  monthOnlyRows: UpcomingCandidateRow[]
  activeFilters: string[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const copy = TRANSLATIONS[language]
  const [verifiedSortKey, setVerifiedSortKey] = useState<VerifiedDashboardSortKey>('date')
  const [verifiedSortDirection, setVerifiedSortDirection] = useState<DashboardSortDirection>('asc')
  const [scheduledSortKey, setScheduledSortKey] = useState<ScheduledDashboardSortKey>('date')
  const [scheduledSortDirection, setScheduledSortDirection] = useState<DashboardSortDirection>('asc')
  const verifiedSortOptions: Array<{ key: VerifiedDashboardSortKey; label: string }> = [
    { key: 'date', label: copy.dashboardDate },
    { key: 'team', label: copy.dashboardTeam },
  ]
  const scheduledSortOptions: Array<{ key: ScheduledDashboardSortKey; label: string }> = [
    { key: 'date', label: copy.dashboardDate },
    { key: 'team', label: copy.dashboardTeam },
    { key: 'status', label: copy.dashboardStatus },
    { key: 'confidence', label: copy.dashboardConfidence },
  ]
  const sortedVerifiedRows = sortVerifiedDashboardRows(verifiedRows, verifiedSortKey, verifiedSortDirection)
  const sortedScheduledRows = sortScheduledDashboardRows(scheduledRows, scheduledSortKey, scheduledSortDirection)
  const sortedMonthOnlyRows = sortScheduledDashboardRows(monthOnlyRows, scheduledSortKey, scheduledSortDirection)
  const totalScheduledRows = sortedScheduledRows.length + sortedMonthOnlyRows.length

  function handleVerifiedSortChange(key: VerifiedDashboardSortKey) {
    if (verifiedSortKey === key) {
      setVerifiedSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setVerifiedSortKey(key)
    setVerifiedSortDirection(getVerifiedDashboardDefaultSortDirection())
  }

  function handleScheduledSortChange(key: ScheduledDashboardSortKey) {
    if (scheduledSortKey === key) {
      setScheduledSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setScheduledSortKey(key)
    setScheduledSortDirection(getScheduledDashboardDefaultSortDirection(key))
  }

  return (
    <section id={sectionId} className="panel monthly-dashboard scroll-anchor-section">
      <div className="monthly-dashboard-head">
        <div>
          <p className="panel-label">{copy.monthlyDashboard}</p>
          <h2>{copy.monthlyDashboardTitle}</h2>
        </div>
        <div className="meta-item monthly-dashboard-month">
          <span>{copy.monthlyDashboardMonth}</span>
          <strong>{monthLabel}</strong>
        </div>
      </div>

      <div className="monthly-dashboard-toolbar">
        <div className="dashboard-filter-summary">
          <span className="dashboard-toolbar-label">{copy.monthlyDashboardFilters}</span>
          <div className="dashboard-toolbar-chip-row">
            {activeFilters.length ? (
              activeFilters.map((item) => (
                <span key={item} className="filter-chip dashboard-filter-pill">
                  {item}
                </span>
              ))
            ) : (
              <span className="filter-chip dashboard-filter-pill dashboard-filter-pill-muted">
                {copy.monthlyDashboardFiltersDefault}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="monthly-dashboard-stack">
        <section className="monthly-dashboard-section">
          <div className="selected-day-panel-head">
            <h3>{copy.monthlyDashboardVerifiedTitle}</h3>
            <span className="selected-day-panel-count">{sortedVerifiedRows.length}</span>
          </div>
          <div className="dashboard-section-toolbar">
            <span className="dashboard-toolbar-label">{copy.monthlyDashboardSort}</span>
            <div className="dashboard-sort-chip-row">
              {verifiedSortOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={`filter-chip dashboard-sort-button ${
                    verifiedSortKey === option.key ? 'filter-chip-active dashboard-sort-button-active' : ''
                  }`}
                  onClick={() => handleVerifiedSortChange(option.key)}
                >
                  <span>{option.label}</span>
                  {verifiedSortKey === option.key ? (
                    <span className="dashboard-sort-indicator" aria-hidden="true">
                      {formatDashboardSortIndicator(verifiedSortDirection)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {sortedVerifiedRows.length ? (
            <>
              <div className="dashboard-table-shell">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>{copy.dashboardTeam}</th>
                      <th>{copy.dashboardRelease}</th>
                      <th>{copy.dashboardLeadTrack}</th>
                      <th>{copy.dashboardFormat}</th>
                      <th>{copy.dashboardDate}</th>
                      <th>{copy.dashboardListen}</th>
                      <th>{copy.dashboardActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVerifiedRows.map((item) => (
                      <tr key={getAlbumKey(item)}>
                        <td>
                          <TeamIdentity group={item.group} variant="list" />
                        </td>
                        <td>
                          <strong>{item.title}</strong>
                        </td>
                        <td>{getVerifiedReleaseLeadTrack(item, language)}</td>
                        <td>{formatReleaseFormat(item.release_format, language) || item.release_kind}</td>
                        <td>{formatOptionalDate(item.date, displayDateFormatter, copy.none)}</td>
                        <td>
                          <DashboardServiceActions release={item} language={language} />
                        </td>
                        <td>
                          <div className="dashboard-table-actions">
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                              {TEAM_COPY[language].action}
                            </ActionButton>
                            <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(item)}>
                              {getReleaseDetailActionLabel(item.release_kind, language)}
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dashboard-mobile-list">
                {sortedVerifiedRows.map((item) => (
                  <article key={`mobile-${getAlbumKey(item)}`} className="detail-card dashboard-mobile-card">
                    <div className="signal-head">
                      <TeamIdentity group={item.group} variant="list" />
                      <span className="signal-badge">
                        {formatReleaseFormat(item.release_format, language) || item.release_kind}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p className="signal-meta">
                      {copy.dashboardLeadTrack} · {getVerifiedReleaseLeadTrack(item, language)}
                    </p>
                    <p className="signal-meta">
                      {formatOptionalDate(item.date, displayDateFormatter, copy.none)}
                    </p>
                    <div className="action-stack">
                      <div className="action-row">
                        <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                          {TEAM_COPY[language].action}
                        </ActionButton>
                        <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(item)}>
                          {getReleaseDetailActionLabel(item.release_kind, language)}
                        </ActionButton>
                      </div>
                      <div className="dashboard-mobile-actions">
                        <DashboardServiceActions release={item} language={language} />
                      </div>
                      <div className="meta-links">
                        <a href={item.source} target="_blank" rel="noreferrer" className="meta-link">
                          {copy.releaseSource}
                        </a>
                        <a href={item.artist_source} target="_blank" rel="noreferrer" className="meta-link">
                          {copy.artistSource}
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-copy">{copy.monthlyDashboardVerifiedEmpty}</p>
          )}
        </section>

        <section className="monthly-dashboard-section">
          <div className="selected-day-panel-head">
            <h3>{copy.monthlyDashboardScheduledTitle}</h3>
            <span className="selected-day-panel-count">{totalScheduledRows}</span>
          </div>
          <div className="dashboard-section-toolbar">
            <span className="dashboard-toolbar-label">{copy.monthlyDashboardSort}</span>
            <div className="dashboard-sort-chip-row">
              {scheduledSortOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={`filter-chip dashboard-sort-button ${
                    scheduledSortKey === option.key ? 'filter-chip-active dashboard-sort-button-active' : ''
                  }`}
                  onClick={() => handleScheduledSortChange(option.key)}
                >
                  <span>{option.label}</span>
                  {scheduledSortKey === option.key ? (
                    <span className="dashboard-sort-indicator" aria-hidden="true">
                      {formatDashboardSortIndicator(scheduledSortDirection)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {totalScheduledRows ? (
            <div className="dashboard-subsection-stack">
              {sortedScheduledRows.length ? (
                <DashboardScheduledBucket
                  title={copy.monthlyDashboardScheduledExactTitle}
                  rows={sortedScheduledRows}
                  language={language}
                  displayDateFormatter={displayDateFormatter}
                  onOpenTeamPage={onOpenTeamPage}
                />
              ) : null}
              {sortedMonthOnlyRows.length ? (
                <DashboardScheduledBucket
                  title={copy.monthlyDashboardScheduledMonthOnlyTitle}
                  rows={sortedMonthOnlyRows}
                  language={language}
                  displayDateFormatter={displayDateFormatter}
                  onOpenTeamPage={onOpenTeamPage}
                />
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">{copy.monthlyDashboardScheduledEmpty}</p>
          )}
        </section>
      </div>
    </section>
  )
}

function AgencyCalendarView({
  sectionId,
  sections,
  language,
  displayDateFormatter,
  onOpenTeamPage,
  onOpenReleaseDetail,
}: {
  sectionId?: string
  sections: AgencyMonthSection[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const copy = TRANSLATIONS[language]

  return (
    <section id={sectionId} className="panel agency-view scroll-anchor-section">
      <div className="monthly-dashboard-head">
        <div>
          <p className="panel-label">{copy.agencyView}</p>
          <h2>{copy.agencyViewTitle}</h2>
        </div>
        <span className="sidebar-panel-count">{sections.length}</span>
      </div>

      {sections.length ? (
        <div className="agency-view-stack">
          {sections.map((section) => (
            <article key={section.agency} className="agency-view-card">
              <div className="agency-view-head">
                <div>
                  <h3>{formatFilterOption(section.agency, language)}</h3>
                  <p className="signal-meta">
                    {copy.agencyViewVerifiedCount} {section.verifiedRows.length} · {copy.agencyViewScheduledCount}{' '}
                    {section.scheduledRows.length}
                  </p>
                </div>
                <span className="selected-day-panel-count">
                  {section.verifiedRows.length + section.scheduledRows.length}
                </span>
              </div>

              <div className="agency-view-columns">
                <section className="agency-view-column">
                  <p className="panel-label">{copy.selectedDayVerified}</p>
                  {section.verifiedRows.length ? (
                    <div className="feed-list">
                      {section.verifiedRows.slice(0, 3).map((item) => (
                        <article key={`agency-verified-${getAlbumKey(item)}`} className="detail-card agency-view-item">
                          <div className="signal-head">
                            <TeamIdentity group={item.group} variant="list" />
                            <span className="signal-badge">
                              {formatReleaseFormat(item.release_format, language) || item.release_kind}
                            </span>
                          </div>
                          <h3>{item.title}</h3>
                          <p className="signal-meta">
                            {formatOptionalDate(item.date, displayDateFormatter, copy.none)}
                          </p>
                          <div className="action-row">
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                              {TEAM_COPY[language].action}
                            </ActionButton>
                            <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(item)}>
                              {getReleaseDetailActionLabel(item.release_kind, language)}
                            </ActionButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">{copy.selectedDayVerifiedEmpty}</p>
                  )}
                </section>

                <section className="agency-view-column">
                  <p className="panel-label">{copy.selectedDayScheduled}</p>
                  {section.scheduledRows.length ? (
                    <div className="feed-list">
                      {section.scheduledRows.slice(0, 3).map((item) => (
                        <article
                          key={`agency-scheduled-${item.group}-${item.scheduled_date}-${item.headline}`}
                          className="detail-card detail-card-signal agency-view-item"
                        >
                          <div className="signal-head">
                            <TeamIdentity group={item.group} variant="list" />
                            <span className={`signal-badge signal-badge-date-${item.date_status}`}>
                              {formatDateStatus(item.date_status, language)}
                            </span>
                          </div>
                          <h3>{item.headline}</h3>
                          <p className="signal-meta">
                            {formatUpcomingTimingLabel(item, language, displayDateFormatter, copy.none)}
                          </p>
                          <div className="action-row">
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                              {TEAM_COPY[language].action}
                            </ActionButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">{copy.selectedDayScheduledEmpty}</p>
                  )}
                </section>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{copy.agencyViewEmpty}</p>
      )}
    </section>
  )
}

function DashboardServiceActions({
  release,
  language,
}: {
  release: VerifiedRelease
  language: Language
}) {
  return (
    <MusicHandoffRow
      group={release.group}
      title={release.title}
      canonicalUrls={release.music_handoffs}
      mvUrl={release.youtube_mv_url ?? ''}
      language={language}
      compact
    />
  )
}

function ReleaseClassificationBadges({
  releaseFormat,
  contextTags,
  language,
}: {
  releaseFormat: ReleaseFormat | ''
  contextTags: ContextTag[]
  language: Language
}) {
  if (!releaseFormat && contextTags.length === 0) {
    return null
  }

  return (
    <>
      {releaseFormat ? (
        <span className="signal-badge signal-badge-classification-format">
          {formatReleaseFormat(releaseFormat, language)}
        </span>
      ) : null}
      {contextTags.map((contextTag) => (
        <span key={contextTag} className="signal-badge signal-badge-classification-tag">
          {formatContextTag(contextTag, language)}
        </span>
      ))}
    </>
  )
}

function DailyShareCard({
  dateLabel,
  releases,
  upcomingSignals,
  language,
}: {
  dateLabel: string
  releases: VerifiedRelease[]
  upcomingSignals: DatedUpcomingSignal[]
  language: Language
}) {
  const copy = TRANSLATIONS[language]
  const shareReleases = releases.slice(0, DAILY_SHARE_VERIFIED_LIMIT)
  const shareUpcomingSignals = upcomingSignals.slice(0, DAILY_SHARE_UPCOMING_LIMIT)
  const hiddenReleaseCount = Math.max(releases.length - shareReleases.length, 0)
  const hiddenUpcomingCount = Math.max(upcomingSignals.length - shareUpcomingSignals.length, 0)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const canCopyText = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'

  useEffect(() => {
    if (!shareFeedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setShareFeedback(null)
    }, 2400)

    return () => window.clearTimeout(timeoutId)
  }, [shareFeedback])

  const shareText = buildDailyShareText({
    dateLabel,
    releases,
    upcomingSignals,
    language,
  })

  const handleCopyText = async (text: string, successMessage: string) => {
    if (!canCopyText) {
      setShareFeedback(copy.shareCardUnavailable)
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setShareFeedback(successMessage)
    } catch {
      setShareFeedback(copy.shareCardUnavailable)
    }
  }

  const handleShare = async () => {
    if (canUseNativeShare) {
      try {
        await navigator.share({
          title: `${dateLabel} | ${copy.shareCardBrand}`,
          text: shareText,
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    await handleCopyText(shareText, copy.shareCardCopySuccess)
  }

  return (
    <section className="daily-share-shell">
      <div className="daily-share-head">
        <div>
          <p className="panel-label">{copy.shareCardLabel}</p>
          <h3>{copy.shareCardTitle}</h3>
          <p className="hero-text daily-share-copy">{copy.shareCardHint}</p>
        </div>
        <div className="daily-share-actions">
          <ActionButton variant="primary" onClick={() => void handleShare()}>
            {canUseNativeShare ? copy.shareCardShare : copy.shareCardShareFallback}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => void handleCopyText(shareText, copy.shareCardSummaryCopied)}>
            {copy.shareCardCopySummary}
          </ActionButton>
        </div>
      </div>

      {shareFeedback ? (
        <p className="daily-share-feedback" role="status" aria-live="polite">
          {shareFeedback}
        </p>
      ) : null}

      <article className="daily-share-card">
        <div className="daily-share-brand-row">
          <span>{copy.shareCardBrand}</span>
          <span>{copy.shareCardBrandServices}</span>
        </div>

        <div className="daily-share-date-row">
          <div>
            <p className="panel-label">{copy.selectedDay}</p>
            <h3>{dateLabel}</h3>
          </div>
          <div className="daily-share-counts">
            <span>
              {copy.selectedDayVerified} {releases.length}
            </span>
            <span>
              {copy.selectedDayScheduled} {upcomingSignals.length}
            </span>
          </div>
        </div>

        <div className="daily-share-grid">
          <section className="daily-share-column">
            <div className="selected-day-panel-head">
              <h4>{copy.selectedDayVerified}</h4>
              <span className="selected-day-panel-count">{shareReleases.length}</span>
            </div>
            <ul className="daily-share-list">
              {shareReleases.length ? (
                shareReleases.map((item) => (
                  <li key={`${item.group}-${item.stream}-${item.title}`} className="daily-share-item">
                    <strong>{getTeamDisplayName(item.group)}</strong>
                    <span>{item.title}</span>
                    <small>{describeRelease(item, language)}</small>
                  </li>
                ))
              ) : (
                <li className="daily-share-item daily-share-item-empty">{copy.shareCardVerifiedEmpty}</li>
              )}
            </ul>
            {hiddenReleaseCount ? (
              <p className="daily-share-overflow">{formatDailyShareOverflow(hiddenReleaseCount, language)}</p>
            ) : null}
          </section>

          <section className="daily-share-column">
            <div className="selected-day-panel-head">
              <h4>{copy.selectedDayScheduled}</h4>
              <span className="selected-day-panel-count">{shareUpcomingSignals.length}</span>
            </div>
            <ul className="daily-share-list">
              {shareUpcomingSignals.length ? (
                shareUpcomingSignals.map((item) => (
                  <li key={`${item.group}-${item.scheduled_date}-${item.headline}`} className="daily-share-item">
                    <strong>{getTeamDisplayName(item.group)}</strong>
                    <span>{item.headline}</span>
                    <small>
                      {formatDateStatus(item.date_status, language)}
                      {item.release_format ? ` · ${formatReleaseFormat(item.release_format, language)}` : ''}
                    </small>
                  </li>
                ))
              ) : (
                <li className="daily-share-item daily-share-item-empty">{copy.shareCardScheduledEmpty}</li>
              )}
            </ul>
            {hiddenUpcomingCount ? (
              <p className="daily-share-overflow">{formatDailyShareOverflow(hiddenUpcomingCount, language)}</p>
            ) : null}
          </section>
        </div>

        <p className="daily-share-footer">{copy.shareCardCaptureHint}</p>
      </article>
    </section>
  )
}

function SelectedDayPanel({
  className,
  panelRef,
  dateLabel,
  releases,
  upcomingSignals,
  language,
  shortDateFormatter,
  onOpenTeamPage,
  onOpenReleaseDetail,
}: {
  className?: string
  panelRef?: RefObject<HTMLElement | null>
  dateLabel: string
  releases: VerifiedRelease[]
  upcomingSignals: DatedUpcomingSignal[]
  language: Language
  shortDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string, entitySlug?: string | null) => void
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]

  return (
    <section ref={panelRef} className={['panel', 'selected-day-panel', className].filter(Boolean).join(' ')}>
      <p className="panel-label">{copy.selectedDay}</p>
      <h2>{dateLabel}</h2>
      <DailyShareCard dateLabel={dateLabel} releases={releases} upcomingSignals={upcomingSignals} language={language} />
      <div className="selected-day-panel-grid">
        <div className="selected-day-panel-section">
          <div className="selected-day-panel-head">
            <h3>{copy.selectedDayVerified}</h3>
            <span className="selected-day-panel-count">{releases.length}</span>
          </div>
          <div className="detail-list">
            {releases.length ? (
              releases.map((item) => (
                <article key={`${item.group}-${item.stream}-${item.title}`} className="detail-card">
                  <div>
                    <div className="signal-head">
                      <TeamIdentity group={item.group} variant="list" />
                      <span className="signal-badge">{describeRelease(item, language)}</span>
                    </div>
                    <h3>{item.title}</h3>
                  </div>
                  <div className="action-stack">
                    <div className="action-row">
                      <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                        {teamCopy.action}
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(item)}>
                        {getReleaseDetailActionLabel(item.release_kind, language)}
                      </ActionButton>
                    </div>
                    <MusicHandoffRow
                      group={item.group}
                      title={item.title}
                      canonicalUrls={item.music_handoffs}
                      mvUrl={item.youtube_mv_url ?? ''}
                      language={language}
                    />
                    <div className="meta-links">
                      <a href={item.source} target="_blank" rel="noreferrer" className="meta-link">
                        {copy.releaseSource}
                      </a>
                      <a href={item.artist_source} target="_blank" rel="noreferrer" className="meta-link">
                        {copy.artistSource}
                      </a>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-copy">{copy.selectedDayVerifiedEmpty}</p>
            )}
          </div>
        </div>

        <div className="selected-day-panel-section">
          <div className="selected-day-panel-head">
            <h3>{copy.selectedDayScheduled}</h3>
            <span className="selected-day-panel-count">{upcomingSignals.length}</span>
          </div>
          <div className="detail-list">
            {upcomingSignals.length ? (
              upcomingSignals.map((item) => (
                <article
                  key={`${item.group}-${item.scheduled_date}-${item.headline}`}
                  className={`detail-card detail-card-signal detail-card-signal-${item.date_status}`}
                >
                  <div>
                    <div className="signal-head">
                      <TeamIdentity group={item.group} variant="list" />
                      <div className="signal-tags">
                        <UpcomingCountdownBadge item={item} formatter={shortDateFormatter} />
                        <span className={`signal-badge signal-badge-date-${item.date_status}`}>
                          {formatDateStatus(item.date_status, language)}
                        </span>
                        <span
                          className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}
                        >
                          {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                        </span>
                        <SourceBadge sourceType={item.source_type} language={language} />
                        <ReleaseChangeBadge group={item.group} language={language} />
                        <ReleaseClassificationBadges
                          releaseFormat={item.release_format}
                          contextTags={item.context_tags}
                          language={language}
                        />
                      </div>
                    </div>
                    <h3>{item.headline}</h3>
                    <p className="signal-meta">{formatSourceDomain(item.source_domain, language)}</p>
                    {formatUpcomingEvidenceMeta(item, language) ? (
                      <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                    ) : null}
                    {item.evidence_summary ? (
                      <p className="signal-evidence">{item.evidence_summary}</p>
                    ) : null}
                  </div>
                  <div className="action-stack">
                    <div className="action-row">
                      <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group, item.entitySlug)}>
                        {teamCopy.action}
                      </ActionButton>
                    </div>
                    <div className="meta-links">
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer" className="meta-link">
                          {copy.sourceLink}
                        </a>
                      ) : (
                        <span className="signal-link-muted">{copy.noSourceLink}</span>
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-copy">{copy.selectedDayScheduledEmpty}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function FloatingSectionNavigator({
  items,
  activeSectionId,
  expanded,
  language,
  onToggle,
  onSelectSection,
}: {
  items: DashboardSectionNavigatorItem[]
  activeSectionId: string
  expanded: boolean
  language: Language
  onToggle: () => void
  onSelectSection: (sectionId: string) => void
}) {
  const copy = TRANSLATIONS[language]
  const activeItem = items.find((item) => item.id === activeSectionId) ?? items[0]

  return (
    <nav
      className={`section-navigator ${expanded ? 'section-navigator-expanded' : ''}`}
      aria-label={copy.sectionNavigator}
    >
      <button type="button" className="section-navigator-toggle" onClick={onToggle}>
        <span>{copy.sectionNavigatorToggle}</span>
        <strong>{activeItem.shortLabel}</strong>
      </button>
      <div className="section-navigator-panel">
        <div className="section-navigator-head">
          <span className="panel-label">{copy.sectionNavigator}</span>
          <p>{copy.sectionNavigatorHint}</p>
        </div>
        <div className="section-navigator-list">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`section-navigator-item ${item.id === activeSectionId ? 'section-navigator-item-active' : ''}`}
              onClick={() => onSelectSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  language,
  onSelect,
}: {
  label: string
  options: readonly T[]
  selected: T
  language: Language
  onSelect: (value: T) => void
}) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div className="filter-row">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={`filter-chip ${selected === option ? 'filter-chip-active' : ''}`}
            onClick={() => onSelect(option)}
          >
            {formatFilterOption(option, language)}
          </button>
        ))}
      </div>
    </div>
  )
}

function AgencyFilterGroup<T extends string>({
  label,
  options,
  selected,
  language,
  onSelect,
}: {
  label: string
  options: readonly T[]
  selected: T
  language: Language
  onSelect: (value: T) => void
}) {
  const copy = TRANSLATIONS[language]
  const [expanded, setExpanded] = useState(selected !== 'all')
  const collapsedOptions = Array.from(
    new Set([options[0], selected, ...options.filter((option) => option !== options[0]).slice(0, 4)]),
  ).filter(Boolean) as T[]
  const visibleOptions = expanded ? options : collapsedOptions

  return (
    <div className="filter-group filter-group-agency">
      <div className="filter-group-head">
        <span>{label}</span>
        <button type="button" className="inline-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? copy.agencyFilterCollapse : copy.agencyFilterExpand}
        </button>
      </div>
      <div className={`filter-row filter-row-agency ${expanded ? 'filter-row-agency-expanded' : ''}`}>
        {visibleOptions.map((option) => (
          <button
            type="button"
            key={option}
            className={`filter-chip ${selected === option ? 'filter-chip-active' : ''}`}
            onClick={() => onSelect(option)}
          >
            {formatFilterOption(option, language)}
          </button>
        ))}
      </div>
    </div>
  )
}

function MyTeamsFilterGroup({
  label,
  summary,
  toggleLabel,
  helperText,
  selected,
  disabled,
  onToggle,
}: {
  label: string
  summary: string
  toggleLabel: string
  helperText: string
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="filter-group filter-group-my-teams">
      <div className="filter-group-head">
        <span>{label}</span>
        <strong className="filter-group-meta">{summary}</strong>
      </div>
      <div className="filter-row">
        <button
          type="button"
          className={`filter-chip ${selected ? 'filter-chip-active' : ''}`}
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={selected}
        >
          {toggleLabel}
        </button>
      </div>
      <p className="filter-helper">{helperText}</p>
    </div>
  )
}

function formatSourceType(sourceType: string, language: Language) {
  return TRANSLATIONS[language].sourceTypeLabels[normalizeSourceType(sourceType)]
}

function normalizeSourceType(sourceType: string): SourceBadgeType {
  switch (sourceType) {
    case 'agency_notice':
    case 'weverse_notice':
    case 'news_rss':
    case 'database':
    case 'pending':
      return sourceType
    case 'release_catalog':
      return 'database'
    default:
      return 'pending'
  }
}

function formatSourceDomain(sourceDomain: string, language: Language) {
  return sourceDomain || TRANSLATIONS[language].sourceTypeLabels.pending
}

function formatReleaseFormat(releaseFormat: ReleaseFormat | '', language: Language) {
  if (!releaseFormat) {
    return ''
  }

  return TRANSLATIONS[language].releaseKindLabels[releaseFormat]
}

function formatContextTag(contextTag: ContextTag, language: Language) {
  return TRANSLATIONS[language].contextTagLabels[contextTag]
}

function getVerifiedReleaseLeadTrack(item: VerifiedRelease, language: Language) {
  if (item.stream === 'song') {
    return item.title
  }

  const relatedSong = (releaseGroups.get(item.group) ?? []).find(
    (candidate) => candidate.stream === 'song' && candidate.date === item.date,
  )

  return relatedSong?.title ?? TRANSLATIONS[language].none
}

function formatDateStatus(dateStatus: UpcomingCandidateRow['date_status'], language: Language) {
  return TRANSLATIONS[language].dateStatusLabels[dateStatus]
}

function getConfidenceTone(confidence: number) {
  if (confidence >= 0.8) {
    return 'high'
  }
  if (confidence >= 0.6) {
    return 'medium'
  }
  return 'low'
}

function expandReleaseRow(row: ReleaseRow): VerifiedRelease[] {
  return (['latest_song', 'latest_album'] as const)
    .flatMap((key) => {
      const release = row[key]
      if (!release) {
        return []
      }

      return [
        {
          ...release,
          group: row.group,
          artist_name_mb: row.artist_name_mb,
          artist_mbid: row.artist_mbid,
          artist_source: row.artist_source,
          actType: getActType(row.group),
          stream: key === 'latest_song' ? 'song' : 'album',
          dateValue: new Date(`${release.date}T00:00:00`),
          isoDate: release.date,
        },
      ]
    })
}

function expandUpcomingCandidate(row: UpcomingCandidateRow): DatedUpcomingSignal[] {
  if (!hasExactUpcomingDate(row)) {
    return []
  }

  return [
    {
      ...row,
      dateValue: new Date(`${row.scheduled_date}T00:00:00`),
      isoDate: row.scheduled_date,
    },
  ]
}

function describeRelease(item: VerifiedRelease, language: Language) {
  const copy = TRANSLATIONS[language]
  return `${copy.streamLabels[item.stream]} · ${formatReleaseFormat(item.release_format, language)}`
}

function buildDailyShareText({
  dateLabel,
  releases,
  upcomingSignals,
  language,
}: {
  dateLabel: string
  releases: VerifiedRelease[]
  upcomingSignals: DatedUpcomingSignal[]
  language: Language
}) {
  const copy = TRANSLATIONS[language]
  const releaseLines = releases.slice(0, DAILY_SHARE_VERIFIED_LIMIT).map((item) => {
    return `- ${getTeamDisplayName(item.group)} | ${item.title} | ${describeRelease(item, language)}`
  })
  const upcomingLines = upcomingSignals.slice(0, DAILY_SHARE_UPCOMING_LIMIT).map((item) => {
    const releaseFormat = formatReleaseFormat(item.release_format, language)
    return `- ${getTeamDisplayName(item.group)} | ${item.headline} | ${formatDateStatus(item.date_status, language)}${
      releaseFormat ? ` | ${releaseFormat}` : ''
    }`
  })

  const lines = [
    `${copy.shareCardBrand} | ${dateLabel}`,
    '',
    `${copy.selectedDayVerified} (${releases.length})`,
    ...(releaseLines.length ? releaseLines : [`- ${copy.shareCardVerifiedEmpty}`]),
    ...(releases.length > DAILY_SHARE_VERIFIED_LIMIT
      ? [formatDailyShareOverflow(releases.length - DAILY_SHARE_VERIFIED_LIMIT, language)]
      : []),
    '',
    `${copy.selectedDayScheduled} (${upcomingSignals.length})`,
    ...(upcomingLines.length ? upcomingLines : [`- ${copy.shareCardScheduledEmpty}`]),
    ...(upcomingSignals.length > DAILY_SHARE_UPCOMING_LIMIT
      ? [formatDailyShareOverflow(upcomingSignals.length - DAILY_SHARE_UPCOMING_LIMIT, language)]
      : []),
    '',
    copy.shareCardBrandServices,
  ]

  return lines.join('\n')
}

function formatDailyShareOverflow(count: number, language: Language) {
  return language === 'ko' ? `+${count}개 더` : `+${count} more`
}

function formatFilterOption(option: string, language: Language) {
  return TRANSLATIONS[language].filterOptions[option as keyof typeof TRANSLATIONS.ko.filterOptions] ?? option
}

function buildMonthlyDashboardFilterSummary(
  {
    search,
    selectedReleaseKind,
    selectedActType,
    selectedDashboardStatus,
    selectedAgency,
    selectedMyTeamsOnly,
  }: {
    search: string
    selectedReleaseKind: (typeof releaseKindOptions)[number]
    selectedActType: (typeof actTypeOptions)[number]
    selectedDashboardStatus: (typeof dashboardStatusOptions)[number]
    selectedAgency: string
    selectedMyTeamsOnly: boolean
  },
  language: Language,
) {
  const copy = TRANSLATIONS[language]
  const filters: string[] = []

  if (search.trim()) {
    filters.push(`${copy.searchShort}: ${search.trim()}`)
  }
  if (selectedReleaseKind !== 'all') {
    filters.push(`${copy.filterLabels.releaseKind}: ${formatFilterOption(selectedReleaseKind, language)}`)
  }
  if (selectedActType !== 'all') {
    filters.push(`${copy.filterLabels.actType}: ${formatFilterOption(selectedActType, language)}`)
  }
  if (selectedDashboardStatus !== 'all') {
    filters.push(`${copy.filterLabels.status}: ${formatFilterOption(selectedDashboardStatus, language)}`)
  }
  if (selectedAgency !== 'all') {
    filters.push(
      `${copy.filterLabels.agency}: ${
        selectedAgency === AGENCY_UNKNOWN_FILTER ? formatFilterOption(AGENCY_UNKNOWN_FILTER, language) : selectedAgency
      }`,
    )
  }
  if (selectedMyTeamsOnly) {
    filters.push(`${copy.filterLabels.myTeams}: ${copy.myTeamsOnlyToggle}`)
  }

  return filters
}

function buildRuntimeAgencyFilterOptions({
  verifiedRows,
  scheduledRows,
  monthOnlyRows,
  searchEntities,
  searchReleases,
  searchUpcoming,
  longGapEntries,
  rookieEntries,
}: {
  verifiedRows: VerifiedRelease[]
  scheduledRows: DatedUpcomingSignal[]
  monthOnlyRows: UpcomingCandidateRow[]
  searchEntities: SearchSurfaceEntityResult[]
  searchReleases: SearchSurfaceReleaseResult[]
  searchUpcoming: SearchSurfaceUpcomingResult[]
  longGapEntries: LongGapRadarEntry[]
  rookieEntries: RookieRadarEntry[]
}) {
  const agencies = new Set<string>()
  void searchReleases
  void searchUpcoming

  const appendAgency = (agency: string | null | undefined) => {
    agencies.add(getAgencyFilterValue(agency ?? ''))
  }

  for (const row of verifiedRows) {
    appendAgency(row.agencyName)
  }
  for (const row of scheduledRows) {
    appendAgency(row.agencyName)
  }
  for (const row of monthOnlyRows) {
    appendAgency(row.agencyName)
  }
  for (const row of searchEntities) {
    appendAgency(row.agencyName)
  }
  for (const row of longGapEntries) {
    appendAgency(row.agencyName)
  }
  for (const row of rookieEntries) {
    appendAgency(row.agencyName)
  }

  return [...agencies].sort(compareAgencyFilterOptions)
}

function compareAgencyFilterOptions(left: string, right: string) {
  if (left === AGENCY_UNKNOWN_FILTER) {
    return 1
  }
  if (right === AGENCY_UNKNOWN_FILTER) {
    return -1
  }

  return left.localeCompare(right)
}

function normalizeAgencyName(agency: string | null | undefined) {
  if (!agency) {
    return ''
  }

  const normalized = agency.trim().replace(/\s+/g, ' ')
  const canonicalMap: Record<string, string> = {
    'brand new music': 'Brand New Music',
    'c9 entertainment': 'C9 Entertainment',
    'cube entertainment': 'Cube Entertainment',
    'fnc entertainment': 'FNC Entertainment',
    glg: 'GLG',
    'hybe labels': 'HYBE Labels',
    'ist entertainment': 'IST Entertainment',
    'jellyfish entertainment': 'Jellyfish Entertainment',
    'jyp entertainment': 'JYP Entertainment',
    'kq entertainment': 'KQ Entertainment',
    modhaus: 'MODHAUS',
    rbw: 'RBW',
    's2 entertainment': 'S2 Entertainment',
    'sm entertainment': 'SM Entertainment',
    'starship entertainment': 'Starship Entertainment',
    vlast: 'VLAST',
    wakeone: 'WAKEONE',
    'wm entertainment': 'WM Entertainment',
    'woollim entertainment': 'Woollim Entertainment',
    'yg entertainment': 'YG Entertainment',
    'yuehua entertainment': 'Yuehua Entertainment',
  }

  return canonicalMap[normalized.toLowerCase()] ?? normalized
}

function getAgencyFilterValue(agency: string) {
  return normalizeAgencyName(agency) || AGENCY_UNKNOWN_FILTER
}

function getGroupAgency(group: string) {
  void group
  return ''
}

function matchesAgencyFilter(group: string, selectedAgency: string) {
  if (selectedAgency === 'all') {
    return true
  }

  return getAgencyFilterValue(getGroupAgency(group)) === selectedAgency
}

function buildAgencyMonthSections(
  verifiedRows: VerifiedRelease[],
  scheduledRows: DatedUpcomingSignal[],
) {
  const sections = new Map<string, AgencyMonthSection>()

  for (const item of verifiedRows) {
    const agency = getAgencyFilterValue(item.agencyName ?? '')
    const current = sections.get(agency) ?? {
      agency,
      verifiedRows: [],
      scheduledRows: [],
    }
    current.verifiedRows.push(item)
    sections.set(agency, current)
  }

  for (const item of scheduledRows) {
    const agency = getAgencyFilterValue(item.agencyName ?? '')
    const current = sections.get(agency) ?? {
      agency,
      verifiedRows: [],
      scheduledRows: [],
    }
    current.scheduledRows.push(item)
    sections.set(agency, current)
  }

  return [...sections.values()].sort((left, right) => {
    const countCompare =
      right.verifiedRows.length +
      right.scheduledRows.length -
      (left.verifiedRows.length + left.scheduledRows.length)
    if (countCompare !== 0) {
      return countCompare
    }

    return compareAgencyFilterOptions(left.agency, right.agency)
  })
}

function buildWeeklyDigestRows(rows: VerifiedRelease[], maxItems: number) {
  if (!rows.length) {
    return []
  }

  const groupedByDate = rows.reduce<Map<string, VerifiedRelease[]>>((map, row) => {
    const bucket = map.get(row.isoDate)
    if (bucket) {
      bucket.push(row)
    } else {
      map.set(row.isoDate, [row])
    }
    return map
  }, new Map())

  const selected: VerifiedRelease[] = []
  const sortedDates = [...groupedByDate.keys()].sort((left, right) => parseDateValue(right) - parseDateValue(left))

  for (const isoDate of sortedDates) {
    const remaining = [...(groupedByDate.get(isoDate) ?? [])]
    while (remaining.length && selected.length < maxItems) {
      remaining.sort((left, right) => compareWeeklyDigestCandidates(left, right, selected))
      selected.push(remaining.shift() as VerifiedRelease)
    }

    if (selected.length >= maxItems) {
      break
    }
  }

  return selected
}

function compareWeeklyDigestCandidates(left: VerifiedRelease, right: VerifiedRelease, selected: VerifiedRelease[]) {
  if (left.dateValue.getTime() !== right.dateValue.getTime()) {
    return right.dateValue.getTime() - left.dateValue.getTime()
  }

  const diversityCompare =
    getWeeklyDigestDiversityScore(right, selected) - getWeeklyDigestDiversityScore(left, selected)
  if (diversityCompare !== 0) {
    return diversityCompare
  }

  if (left.context_tags.length !== right.context_tags.length) {
    return right.context_tags.length - left.context_tags.length
  }

  if (left.release_format !== right.release_format) {
    return left.release_format.localeCompare(right.release_format)
  }

  const groupCompare = left.group.localeCompare(right.group)
  if (groupCompare !== 0) {
    return groupCompare
  }

  return left.title.localeCompare(right.title)
}

function getWeeklyDigestDiversityScore(candidate: VerifiedRelease, selected: VerifiedRelease[]) {
  const seenFormats = new Set(selected.map((item) => item.release_format))
  const seenContextTags = new Set(selected.flatMap((item) => item.context_tags))
  let score = seenFormats.has(candidate.release_format) ? 0 : 4

  for (const contextTag of candidate.context_tags) {
    if (!seenContextTags.has(contextTag)) {
      score += 1
    }
  }

  return score
}

function buildSeededVerifiedReleaseHistory(rows: ReleaseHistorySeedRow[]) {
  return rows
    .flatMap((row) =>
      row.releases.map((release) => ({
        ...release,
        group: row.group,
        artist_name_mb: row.artist_name_mb,
        artist_mbid: row.artist_mbid,
        artist_source: row.artist_source,
        actType: getActType(row.group),
        dateValue: new Date(`${release.date}T00:00:00`),
        isoDate: release.date,
      })),
    )
    .sort((left, right) => {
      if (left.dateValue.getTime() !== right.dateValue.getTime()) {
        return right.dateValue.getTime() - left.dateValue.getTime()
      }

      if (left.stream !== right.stream) {
        return left.stream.localeCompare(right.stream)
      }

      return left.title.localeCompare(right.title)
    })
}

function buildVerifiedReleaseHistory(seedReleases: VerifiedRelease[]) {
  const historyByKey = new Map<string, VerifiedRelease>()

  for (const release of seedReleases) {
    historyByKey.set(getReleaseLookupKey(release.group, release.title, release.date, release.stream), release)
  }

  for (const detail of releaseDetailsCatalog) {
    const releaseRow = releaseCatalogByGroup.get(detail.group)
    const matchedRelease =
      (releaseRow
        ? [releaseRow.latest_song, releaseRow.latest_album].find((release, index) => {
            if (!release) {
              return false
            }

            const stream = index === 0 ? 'song' : 'album'
            return (
              release.title === detail.release_title &&
              release.date === detail.release_date &&
              normalizeReleaseStream(stream, release.release_kind) === detail.stream
            )
          })
        : null) ?? null

    historyByKey.set(getReleaseLookupKey(detail.group, detail.release_title, detail.release_date, detail.stream), {
      title: detail.release_title,
      date: detail.release_date,
      source: matchedRelease?.source ?? '',
      release_kind: detail.release_kind,
      release_format: matchedRelease?.release_format ?? detail.release_kind,
      context_tags: matchedRelease?.context_tags ?? [],
      music_handoffs: matchedRelease?.music_handoffs,
      group: detail.group,
      artist_name_mb: releaseRow?.artist_name_mb ?? detail.group,
      artist_mbid: releaseRow?.artist_mbid ?? '',
      artist_source: releaseRow?.artist_source ?? '',
      actType: getActType(detail.group),
      stream: detail.stream,
      dateValue: new Date(`${detail.release_date}T00:00:00`),
      isoDate: detail.release_date,
    })
  }

  for (const release of releases) {
    const key = getReleaseLookupKey(release.group, release.title, release.date, release.stream)
    if (!historyByKey.has(key)) {
      historyByKey.set(key, release)
    }
  }

  return [...historyByKey.values()].sort((left, right) => {
    if (left.dateValue.getTime() !== right.dateValue.getTime()) {
      return right.dateValue.getTime() - left.dateValue.getTime()
    }

    if (left.stream !== right.stream) {
      return left.stream.localeCompare(right.stream)
    }

    return left.title.localeCompare(right.title)
  })
}

function buildAnnualReleaseTimelineSections(
  releases: VerifiedRelease[],
  upcomingSignals: UpcomingCandidateRow[],
) {
  if (!releases.length) {
    return []
  }

  const sections = new Map<number, AnnualReleaseTimelineSection>()

  for (const release of releases) {
    const year = Number.parseInt(release.date.slice(0, 4), 10)
    if (!Number.isFinite(year)) {
      continue
    }

    const current = sections.get(year) ?? { year, items: [] }
    current.items.push({
      kind: 'release',
      occurredAt: release.date,
      release,
    })
    sections.set(year, current)
  }

  const currentYear = new Date().getFullYear()
  const scheduledMarker =
    upcomingSignals.find(
      (item) => hasExactUpcomingDate(item) && Number.parseInt(item.scheduled_date.slice(0, 4), 10) === currentYear,
    ) ?? null

  if (scheduledMarker) {
    const current = sections.get(currentYear) ?? { year: currentYear, items: [] }
    current.items.push({
      kind: 'scheduled',
      occurredAt: scheduledMarker.scheduled_date,
      signal: scheduledMarker,
    })
    sections.set(currentYear, current)
  }

  return [...sections.values()]
    .map((section) => ({
      ...section,
      items: [...section.items].sort(compareAnnualReleaseTimelineItems),
    }))
    .sort((left, right) => right.year - left.year)
}

function compareAnnualReleaseTimelineItems(left: AnnualReleaseTimelineItem, right: AnnualReleaseTimelineItem) {
  const dateCompare = parseDateValue(right.occurredAt) - parseDateValue(left.occurredAt)
  if (dateCompare !== 0) {
    return dateCompare
  }

  if (left.kind !== right.kind) {
    return left.kind === 'scheduled' ? -1 : 1
  }

  if (left.kind === 'release' && right.kind === 'release') {
    if (left.release.stream !== right.release.stream) {
      return left.release.stream.localeCompare(right.release.stream)
    }

    return left.release.title.localeCompare(right.release.title)
  }

  if (left.kind === 'scheduled' && right.kind === 'scheduled') {
    return left.signal.headline.localeCompare(right.signal.headline)
  }

  return 0
}

function getTeamRelatedRadarTags(group: string) {
  const tags = new Set<RelatedRadarTag>()
  const profile = artistProfileByGroup.get(group)
  const watchRow = watchlistByGroup.get(group)

  if (profile?.radar_tags?.includes('rookie')) {
    tags.add('rookie')
  }

  if (watchRow?.watch_reason === 'long_gap') {
    tags.add('long_gap')
  }

  if (watchRow?.watch_reason === 'manual_watch') {
    tags.add('manual_watch')
  }

  return tags
}

function pickSharedRadarTag(left: Set<RelatedRadarTag>, right: Set<RelatedRadarTag>) {
  const priority: RelatedRadarTag[] = ['rookie', 'long_gap', 'manual_watch']
  return priority.find((tag) => left.has(tag) && right.has(tag)) ?? null
}

function hasManualOverridePair(group: string, candidateGroup: string) {
  const groupOverrides = relatedActOverrideMap.get(group) ?? []
  const candidateOverrides = relatedActOverrideMap.get(candidateGroup) ?? []
  return groupOverrides.includes(candidateGroup) || candidateOverrides.includes(group)
}

function compareRelatedActRecommendations(left: RelatedActRecommendation, right: RelatedActRecommendation) {
  if (left.score !== right.score) {
    return right.score - left.score
  }

  const leftLatestRelease = teamProfileMap.get(left.group)?.latestRelease
  const rightLatestRelease = teamProfileMap.get(right.group)?.latestRelease
  const leftDate = parseDateValue(leftLatestRelease?.date)
  const rightDate = parseDateValue(rightLatestRelease?.date)
  if (leftDate !== rightDate) {
    return rightDate - leftDate
  }

  return left.group.localeCompare(right.group)
}

function formatTrackingStatus(status: string, language: Language) {
  return TRANSLATIONS[language].statusLabels[status as keyof typeof TRANSLATIONS.ko.statusLabels] ?? status
}

function formatRelatedActReasonLabel(reason: RelatedActReason, language: Language) {
  const teamCopy = TEAM_COPY[language]

  switch (reason.kind) {
    case 'agency':
      return teamCopy.relatedActsReasonAgency
    case 'entity_type':
      return teamCopy.relatedActsReasonType
    case 'radar_tag':
      return teamCopy.relatedActsReasonRadarTag
    case 'manual_override':
      return teamCopy.relatedActsReasonManual
  }
}

function formatRelatedActReasonDetail(reason: RelatedActReason, language: Language) {
  const teamCopy = TEAM_COPY[language]

  switch (reason.kind) {
    case 'agency':
      return `${teamCopy.relatedActsReasonAgency} · ${reason.agency}`
    case 'entity_type':
      return `${teamCopy.relatedActsReasonType} · ${formatEntityTypeLabel(reason.entityType, language)}`
    case 'radar_tag':
      return `${teamCopy.relatedActsReasonRadarTag} · ${formatRelatedRadarTag(reason.radarTag, language)}`
    case 'manual_override':
      return teamCopy.relatedActsReasonManual
  }
}

function formatRelatedRadarTag(tag: RelatedRadarTag, language: Language) {
  const copy = TRANSLATIONS[language]

  switch (tag) {
    case 'rookie':
      return copy.rookieBadge
    case 'long_gap':
      return copy.watchReasonLabels.long_gap
    case 'manual_watch':
      return copy.watchReasonLabels.manual_watch
  }
}

function formatConfidenceTone(tone: ReturnType<typeof getConfidenceTone>, language: Language) {
  return TRANSLATIONS[language].confidenceToneLabels[tone]
}

function formatReleaseChangeType(changeType: ReleaseChangeType, language: Language) {
  return TRANSLATIONS[language].changeTypeLabels[changeType]
}

function formatTimelineEventType(eventType: SourceTimelineEventType, language: Language) {
  return TRANSLATIONS[language].timelineEventLabels[eventType]
}

function formatWatchReason(reason: WatchReason, language: Language) {
  return TRANSLATIONS[language].watchReasonLabels[reason]
}

function formatGapDuration(days: number, language: Language) {
  if (language === 'ko') {
    return `${days}일`
  }

  return `${days} day${days === 1 ? '' : 's'}`
}

function getUpcomingCountdownState(item: UpcomingCandidateRow): CountdownState | null {
  if (
    !hasExactUpcomingDate(item) ||
    (item.date_status !== 'confirmed' && item.date_status !== 'scheduled')
  ) {
    return null
  }

  const countdownDays = getCountdownDays(item.scheduled_date)
  if (countdownDays < 0) {
    return 'date'
  }
  if (countdownDays === 0) {
    return 'd_day'
  }
  if (countdownDays === 1) {
    return 'd_1'
  }
  if (countdownDays <= 3) {
    return 'd_3'
  }
  if (countdownDays <= 7) {
    return 'd_7'
  }
  return 'date'
}

function formatUpcomingCountdownLabel(
  countdownState: CountdownState,
  scheduledDate: string,
  formatter: Intl.DateTimeFormat,
) {
  if (countdownState === 'd_day') {
    return 'D-DAY'
  }
  if (countdownState === 'd_1') {
    return 'D-1'
  }
  if (countdownState === 'd_3') {
    return 'D-3'
  }
  if (countdownState === 'd_7') {
    return 'D-7'
  }
  return formatDisplayDate(scheduledDate, formatter)
}

function handleMusicHandoffClick(event: ReactMouseEvent<HTMLAnchorElement>, link: MusicHandoffLink) {
  if (shouldBypassManagedHandoff(event)) {
    return
  }

  event.preventDefault()
  openMusicHandoff(link)
}

function buildYouTubeMvCanonicalUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`
}

function buildYouTubeNoCookieEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
}

function extractYouTubeVideoId(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value
  }

  try {
    const url = new URL(value)

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace(/^\//, '')
    }

    const watchId = url.searchParams.get('v')
    if (watchId) {
      return watchId
    }

    const segments = url.pathname.split('/').filter(Boolean)
    const embedIndex = segments.findIndex((segment) => segment === 'embed' || segment === 'shorts')
    if (embedIndex >= 0) {
      return segments[embedIndex + 1] ?? ''
    }
  } catch {
    return ''
  }

  return ''
}

function getReleaseDetailMvUrls(detail: Pick<ReleaseDetailRow, 'youtube_video_id' | 'youtube_video_url'>) {
  const videoId = extractYouTubeVideoId(detail.youtube_video_id) || extractYouTubeVideoId(detail.youtube_video_url)

  return {
    canonicalUrl: videoId ? buildYouTubeMvCanonicalUrl(videoId) : '',
    embedUrl: videoId ? buildYouTubeNoCookieEmbedUrl(videoId) : '',
  }
}

function formatCanonicalDisclosureStatusLabel(status: CanonicalDisclosureStatus, language: Language) {
  if (language === 'ko') {
    switch (status) {
      case 'missing':
        return '미기재'
      case 'unresolved':
        return '미해결'
      case 'review_needed':
        return '검토 필요'
      case 'conditional_none':
        return '조건부 없음'
    }
  }

  switch (status) {
    case 'missing':
      return 'Missing'
    case 'unresolved':
      return 'Unresolved'
    case 'review_needed':
      return 'Review needed'
    case 'conditional_none':
      return 'Conditional none'
  }
}

function formatCanonicalDisclosureLine(
  subject: string,
  status: CanonicalDisclosureStatus,
  detail: string,
  language: Language,
) {
  return `${subject} · ${formatCanonicalDisclosureStatusLabel(status, language)}: ${detail}`
}

function buildTeamCanonicalStatusDisclosure(
  team: TeamProfile,
  language: Language,
): CanonicalSurfaceDisclosure | null {
  const lines: string[] = []

  if (!team.artistSource) {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '아티스트 출처' : 'Artist source',
        'missing',
        language === 'ko'
          ? '프로필 기준 source link가 아직 연결되지 않았습니다.'
          : 'The profile-level source link is not attached yet.',
        language,
      ),
    )
  }

  if (team.nextUpcomingSignal && !team.nextUpcomingSignal.source_url) {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '다음 컴백 출처' : 'Next comeback source',
        'missing',
        language === 'ko'
          ? '예정 신호는 보이지만 source link가 아직 붙지 않았습니다.'
          : 'The upcoming signal exists, but its source link is still missing.',
        language,
      ),
    )
  }

  if (team.latestRelease && !team.latestRelease.source) {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '최신 발매 출처' : 'Latest release source',
        'missing',
        language === 'ko'
          ? 'verified release source link가 아직 연결되지 않았습니다.'
          : 'The verified release source link is not attached yet.',
        language,
      ),
    )
  }

  if (team.sourceTimeline.length === 0) {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '소스 타임라인' : 'Source timeline',
        'unresolved',
        language === 'ko'
          ? '예정·발매 근거를 하나의 타임라인으로 아직 묶지 못했습니다.'
          : 'Scheduled and verified evidence has not been merged into one timeline yet.',
        language,
      ),
    )
  }

  if (lines.length === 0) {
    return null
  }

  return {
    title: language === 'ko' ? '소스 신뢰도' : 'Source confidence',
    lines,
  }
}

function buildReleaseCanonicalStatusDisclosure(
  detail: ReleaseDetailRow,
  language: Language,
): CanonicalSurfaceDisclosure | null {
  const lines: string[] = []

  if (detail.tracks.length === 0) {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '트랙 메타데이터' : 'Track metadata',
        'missing',
        language === 'ko'
          ? '신뢰 가능한 canonical tracklist가 아직 연결되지 않았습니다.'
          : 'A reliable canonical tracklist is not attached yet.',
        language,
      ),
    )
  }

  if (!detail.spotify_url || !detail.youtube_music_url) {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '음원 서비스 링크' : 'Streaming links',
        'missing',
        language === 'ko'
          ? 'Spotify 또는 YouTube Music canonical link가 비어 있습니다.'
          : 'Spotify or YouTube Music canonical links are still missing.',
        language,
      ),
    )
  }

  if (detail.youtube_video_status === 'needs_review') {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '공식 MV' : 'Official MV',
        'review_needed',
        language === 'ko'
          ? '후보는 있지만 사람 검토가 아직 끝나지 않았습니다.'
          : 'A candidate exists, but human review is still required.',
        language,
      ),
    )
  }

  if (detail.youtube_video_status === 'unresolved') {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '공식 MV' : 'Official MV',
        'unresolved',
        language === 'ko'
          ? '채워야 하지만 아직 canonical target을 확정하지 못했습니다.'
          : 'This should be filled, but the canonical target is still unresolved.',
        language,
      ),
    )
  }

  if (detail.youtube_video_status === 'no_mv' || detail.youtube_video_status === 'no_link') {
    lines.push(
      formatCanonicalDisclosureLine(
        language === 'ko' ? '공식 MV' : 'Official MV',
        'conditional_none',
        language === 'ko'
          ? 'first-party evidence 기준으로 공식 MV가 없다고 확인된 상태입니다.'
          : 'First-party evidence confirms that there is no official MV for this release.',
        language,
      ),
    )
  }

  if (lines.length === 0) {
    return null
  }

  return {
    title: language === 'ko' ? '외부 링크 및 메타 상태' : 'External links and metadata state',
    lines,
  }
}

function getPrimaryTitleTrackTitle(detail: Pick<ReleaseDetailRow, 'tracks'>) {
  return detail.tracks.find((track) => track.is_title_track)?.title ?? ''
}

function getReleaseLookupKey(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: ReleaseArtworkRow['stream'] | ReleaseDetailRow['stream'],
) {
  return [group, releaseTitle, releaseDate, stream].join('::')
}

function normalizeReleaseStream(
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ReleaseArtworkRow['stream'] {
  if (stream === 'album') {
    return 'album'
  }
  if (stream === 'song') {
    return 'song'
  }
  return releaseKind === 'album' || releaseKind === 'ep' ? 'album' : 'song'
}

function buildPlaceholderReleaseArtwork(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ResolvedReleaseArtwork {
  return {
    group,
    release_title: releaseTitle,
    release_date: releaseDate,
    stream: normalizeReleaseStream(stream, releaseKind),
    cover_image_url: RELEASE_ARTWORK_PLACEHOLDER_URL,
    thumbnail_image_url: RELEASE_ARTWORK_PLACEHOLDER_URL,
    artwork_source_type: 'placeholder',
    artwork_source_url: RELEASE_ARTWORK_PLACEHOLDER_URL,
    isPlaceholder: true,
  }
}

function buildFallbackReleaseEnrichment(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ResolvedReleaseEnrichment {
  return {
    group,
    release_title: releaseTitle,
    release_date: releaseDate,
    stream: normalizeReleaseStream(stream, releaseKind),
    credits: {
      lyrics: [],
      composition: [],
      arrangement: [],
    },
    charts: [],
    notes: '',
    isFallback: true,
  }
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function humanizeRouteSlug(value: string) {
  const normalized = decodeURIComponent(value).trim().replace(/[-_]+/g, ' ')
  return normalized.length ? normalized : 'Release'
}

function buildSyntheticTeamProfile(group: string | null, entitySlug: string): TeamProfile {
  const displayName = group ?? humanizeRouteSlug(entitySlug)

  return {
    group: displayName,
    slug: entitySlug,
    displayName,
    aliases: [],
    tier: 'tracked',
    trackingStatus: 'watch_only',
    artistSource: '',
    xUrl: '',
    instagramUrl: '',
    youtubeUrl: null,
    hasOfficialYouTubeUrl: false,
    agency: '',
    badgeImageUrl: null,
    badgeSourceUrl: null,
    badgeSourceLabel: null,
    representativeImageUrl: null,
    representativeImageSource: null,
    latestRelease: null,
    recentAlbums: [],
    upcomingSignals: [],
    sourceTimeline: [],
    annualReleaseTimeline: [],
    changeLog: [],
    nextUpcomingSignal: null,
    compareOptions: [],
    relatedActs: [],
  }
}

function normalizeEntityDetailReleaseStream(
  stream: string | null | undefined,
  releaseKind: string | null | undefined,
): VerifiedRelease['stream'] {
  return stream === 'album' || releaseKind === 'album' || releaseKind === 'ep' ? 'album' : 'song'
}

function buildEntityDetailArtwork(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: VerifiedRelease['stream'],
  releaseKind: string | null | undefined,
  artworkValue: unknown,
): ResolvedReleaseArtwork | null {
  if (!isUnknownRecord(artworkValue)) {
    return null
  }

  const coverImageUrl = readNonEmptyString(artworkValue.cover_image_url)
  const thumbnailImageUrl = readNonEmptyString(artworkValue.thumbnail_image_url) ?? coverImageUrl
  const artworkSourceUrl = readNonEmptyString(artworkValue.artwork_source_url) ?? coverImageUrl
  if (!coverImageUrl || !thumbnailImageUrl || !artworkSourceUrl) {
    return null
  }

  return {
    group,
    release_title: releaseTitle,
    release_date: releaseDate,
    stream: normalizeReleaseStream(stream, releaseKind ?? undefined),
    cover_image_url: coverImageUrl,
    thumbnail_image_url: thumbnailImageUrl,
    artwork_source_type: readNonEmptyString(artworkValue.artwork_source_type) ?? 'backend_api',
    artwork_source_url: artworkSourceUrl,
    isPlaceholder: readNonEmptyString(artworkValue.artwork_status) === 'placeholder',
  }
}

function buildSyntheticVerifiedRelease(
  group: string,
  summary:
    | NonNullable<EntityDetailApiResponse['data']>['latest_release']
    | NonNullable<NonNullable<EntityDetailApiResponse['data']>['recent_albums']>[number],
): VerifiedRelease | null {
  const releaseTitle = readNonEmptyString(summary?.release_title)
  const releaseDate = readNonEmptyString(summary?.release_date)
  if (!releaseTitle || !releaseDate) {
    return null
  }

  const stream = normalizeEntityDetailReleaseStream(summary?.stream, summary?.release_kind)
  const releaseKind = normalizeApiReleaseKind(summary?.release_kind, stream === 'album' ? 'album' : 'single')
  const spotifyUrl = readNonEmptyString(summary?.spotify_url)
  const youtubeMusicUrl = readNonEmptyString(summary?.youtube_music_url)
  const canonicalHandoffs =
    spotifyUrl || youtubeMusicUrl
      ? {
          ...(spotifyUrl ? { spotify: spotifyUrl } : {}),
          ...(youtubeMusicUrl ? { youtube_music: youtubeMusicUrl } : {}),
        }
      : undefined

  return {
    group,
    artist_name_mb: group,
    artist_mbid: '',
    artist_source: readNonEmptyString(summary?.artist_source_url) ?? readNonEmptyString(summary?.source_url) ?? '',
    actType: getActType(group),
    stream,
    title: releaseTitle,
    date: releaseDate,
    source: readNonEmptyString(summary?.source_url) ?? '',
    release_kind: releaseKind,
    release_format:
      normalizeReleaseFormatValue(summary?.release_format) ||
      (releaseKind === 'album' || releaseKind === 'ep' || releaseKind === 'single' ? releaseKind : 'single'),
    context_tags: [],
    dateValue: new Date(`${releaseDate}T00:00:00`),
    isoDate: releaseDate,
    music_handoffs: canonicalHandoffs,
    release_id: readNonEmptyString(summary?.release_id) ?? undefined,
    artwork: buildEntityDetailArtwork(group, releaseTitle, releaseDate, stream, releaseKind, summary?.artwork),
    youtube_mv_url: readNonEmptyString(summary?.youtube_mv_url),
  }
}

function buildVerifiedReleaseFromTeamLatestRelease(group: string, latestRelease: TeamLatestRelease): VerifiedRelease {
  const releaseKind = normalizeApiReleaseKind(
    latestRelease.releaseKind,
    latestRelease.stream === 'album' ? 'album' : 'single',
  )

  return {
    group,
    artist_name_mb: group,
    artist_mbid: '',
    artist_source: latestRelease.artistSource,
    actType: getActType(group),
    stream: latestRelease.stream === 'album' ? 'album' : 'song',
    title: latestRelease.title,
    date: latestRelease.date,
    source: latestRelease.source,
    release_kind: releaseKind,
    release_format:
      latestRelease.releaseFormat ||
      (releaseKind === 'album' || releaseKind === 'ep' || releaseKind === 'single' ? releaseKind : 'single'),
    context_tags: latestRelease.contextTags,
    dateValue: new Date(`${latestRelease.date}T00:00:00`),
    isoDate: latestRelease.date,
    music_handoffs: latestRelease.musicHandoffs,
    youtube_mv_url: latestRelease.youtubeMvUrl,
  }
}

function buildEntityDetailCompareSnapshot(team: TeamProfile): TeamCompareSnapshot {
  const recentAlbums = [...team.recentAlbums].sort(compareMonthlyDashboardVerified)
  const latestAlbum = recentAlbums[0] ?? null
  const latestSong =
    team.latestRelease && team.latestRelease.stream === 'song'
      ? buildVerifiedReleaseFromTeamLatestRelease(team.group, team.latestRelease)
      : null

  return {
    group: team.group,
    latestVerifiedRelease:
      team.latestRelease && team.latestRelease.verified
        ? buildVerifiedReleaseFromTeamLatestRelease(team.group, team.latestRelease)
        : latestAlbum,
    latestAlbum,
    latestSong,
    nextUpcomingSignal: team.nextUpcomingSignal,
    recentYearReleaseCount: recentAlbums.length + (latestSong ? 1 : 0),
  }
}

function buildCalendarNavigationMonthKeys(referenceMonthKey: string, selectedMonthKey: string) {
  const baseDate = monthKeyToDate(referenceMonthKey)
  const months = new Set<string>([referenceMonthKey, selectedMonthKey])

  for (let offset = -2; offset <= 12; offset += 1) {
    const nextDate = new Date(baseDate)
    nextDate.setMonth(baseDate.getMonth() + offset)
    months.add(getMonthKey(nextDate))
  }

  return [...months].sort()
}

function buildTeamDirectoryEntries(
  verifiedRows: VerifiedRelease[],
  upcomingRows: UpcomingCandidateRow[],
): TeamDirectoryEntry[] {
  const entries = new Map<string, TeamDirectoryEntry>()

  const ensureEntry = (group: string, entitySlug: string | null | undefined, displayName?: string | null) => {
    const current = entries.get(group)
    if (current) {
      if (!current.entitySlug && entitySlug) {
        current.entitySlug = entitySlug
      }
      if (!current.displayName && displayName) {
        current.displayName = displayName
      }
      return current
    }

    const nextEntry: TeamDirectoryEntry = {
      group,
      entitySlug: entitySlug ?? null,
      displayName: displayName ?? group,
      nextUpcomingSignal: null,
    }
    entries.set(group, nextEntry)
    return nextEntry
  }

  upcomingRows.forEach((row) => {
    const entry = ensureEntry(row.group, row.entitySlug, row.displayName)
    entry.nextUpcomingSignal ??= row
  })

  verifiedRows.forEach((row) => {
    ensureEntry(row.group, row.entitySlug, row.displayName)
  })

  return [...entries.values()]
    .sort((left, right) => {
      const upcomingCompare = compareUpcomingSignals(left.nextUpcomingSignal, right.nextUpcomingSignal)
      if (upcomingCompare !== 0) {
        return upcomingCompare
      }

      return left.displayName.localeCompare(right.displayName)
    })
    .slice(0, 12)
}

function buildRouteSelectedRelease(
  group: string | null,
  routeSelection: ReleaseRouteSelection,
): VerifiedRelease | null {
  if (!routeSelection.releaseDate || !routeSelection.releaseStream) {
    return null
  }

  const fallbackGroup = group ?? humanizeRouteSlug(routeSelection.entitySlug)
  const fallbackTitle = looksLikeUuid(routeSelection.releaseSlug)
    ? 'Release'
    : humanizeRouteSlug(routeSelection.releaseSlug)

  return {
    group: fallbackGroup,
    artist_name_mb: fallbackGroup,
    artist_mbid: '',
    artist_source: '',
    actType: getActType(fallbackGroup),
    stream: routeSelection.releaseStream,
    title: fallbackTitle,
    date: routeSelection.releaseDate,
    source: '',
    release_kind: routeSelection.releaseStream === 'album' ? 'album' : 'single',
    release_format: routeSelection.releaseStream === 'album' ? 'album' : 'single',
    context_tags: [],
    dateValue: new Date(`${routeSelection.releaseDate}T00:00:00`),
    isoDate: routeSelection.releaseDate,
    release_id: routeSelection.releaseId ?? undefined,
  }
}

function normalizeApiReleaseKind(
  releaseKind: string | null | undefined,
  fallbackReleaseKind: VerifiedRelease['release_kind'],
): ReleaseFact['release_kind'] {
  if (releaseKind === 'album' || releaseKind === 'ep') {
    return releaseKind
  }

  return fallbackReleaseKind === 'album' || fallbackReleaseKind === 'ep' ? fallbackReleaseKind : 'single'
}

function normalizeApiActType(entityType: string | null | undefined): ActType {
  if (entityType === 'solo' || entityType === 'unit') {
    return entityType
  }

  return 'group'
}

function formatEntityTypeLabel(entityType: string, language: Language) {
  const actType = normalizeApiActType(entityType)
  return TRANSLATIONS[language].filterOptions[actType]
}

function resolveApiDisplayGroup(entitySlug: string | null | undefined, displayName: string | null | undefined) {
  const normalizedDisplayName = readNonEmptyString(displayName)
  if (normalizedDisplayName) {
    return normalizedDisplayName
  }

  const normalizedEntitySlug = readNonEmptyString(entitySlug)
  return normalizedEntitySlug ? humanizeRouteSlug(normalizedEntitySlug) : null
}

function buildReleaseDetailLookupUrl(album: ReleaseDetailApiRequest, entitySlug: string) {
  const stream = normalizeReleaseStream(album.stream, album.release_kind)

  if (!BACKEND_API_BASE_URL) {
    return buildPagesReadBridgeUrl(
      `releases/lookups/${buildReleaseLookupBridgeAssetId(entitySlug, album.title, album.date, stream)}.json`,
    )
  }

  const params = new URLSearchParams()
  params.set('entity_slug', entitySlug)
  params.set('title', album.title)
  params.set('date', album.date)
  params.set('stream', stream)
  return `/v1/releases/lookup?${params.toString()}`
}

function buildBackendApiUrl(path: string) {
  if (BACKEND_API_BASE_URL) {
    return `${BACKEND_API_BASE_URL}${path}`
  }

  if (path.startsWith('/v1/search?')) {
    return buildPagesReadBridgeUrl('search/index.json')
  }

  if (path === '/v1/radar') {
    return buildPagesReadBridgeUrl('radar.json')
  }

  if (path.startsWith('/v1/calendar/month?')) {
    const monthKey = new URLSearchParams(path.split('?')[1] ?? '').get('month')
    if (monthKey) {
      return buildPagesReadBridgeUrl(`calendar/months/${encodeURIComponent(monthKey)}.json`)
    }
  }

  const releaseDetailMatch = path.match(/^\/v1\/releases\/([^/?]+)$/)
  if (releaseDetailMatch) {
    return buildPagesReadBridgeUrl(`releases/details/${encodeURIComponent(releaseDetailMatch[1])}.json`)
  }

  const entityDetailMatch = path.match(/^\/v1\/entities\/([^/?]+)$/)
  if (entityDetailMatch) {
    return buildPagesReadBridgeUrl(`entities/${encodeURIComponent(entityDetailMatch[1])}.json`)
  }

  return path
}

function buildPagesReadBridgeUrl(relativePath: string) {
  return `${PAGES_READ_BRIDGE_BASE_URL}/${relativePath.replace(/^\/+/, '')}`
}

function buildReleaseLookupBridgeAssetId(entitySlug: string, releaseTitle: string, releaseDate: string, stream: string) {
  return `lookup-${hashBridgeKey([entitySlug, releaseTitle, releaseDate, stream].join('::'))}`
}

function hashBridgeKey(value: string) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

const SEARCH_SURFACE_TIMEOUT_MS = 4_000
const RELEASE_DETAIL_LOOKUP_TIMEOUT_MS = 4_000
const RELEASE_DETAIL_FETCH_TIMEOUT_MS = 4_500
const ENTITY_DETAIL_FETCH_TIMEOUT_MS = 7_000
const CALENDAR_MONTH_FETCH_TIMEOUT_MS = 4_500
const RADAR_FETCH_TIMEOUT_MS = 4_000

async function fetchApiJson<T>(
  path: string,
  signal: AbortSignal,
  timeoutMs: number,
  requestIdPrefix: string,
): Promise<{ ok: boolean; status: number; body: T | null; traceId: string | null }> {
  const result = await fetchJsonWithTimeout<T>(buildBackendApiUrl(path), {
    headers: {
      Accept: 'application/json',
    },
    requestIdPrefix,
    signal,
    timeoutMs,
  })

  return {
    ...result,
    traceId: result.responseRequestId ?? result.requestId,
  }
}

function getBackendTraceIdFromError(error: unknown): string | null {
  return extractBackendFetchRequestId(error)
}

function buildFetchFailureState(error: unknown) {
  return {
    errorCode: classifyBackendFetchError(error),
    traceId: getBackendTraceIdFromError(error),
  }
}

function normalizeApiReleaseDetailSnapshot(
  album: ReleaseDetailApiRequest,
  group: string,
  payload: ReleaseDetailApiResponse['data'],
  releaseId: string,
  canonicalPath: string | null,
): ReleaseDetailApiSnapshot | null {
  if (!payload?.release) {
    return null
  }

  const normalizedStream = normalizeReleaseStream(
    payload.release.stream === 'album' || payload.release.stream === 'song' ? payload.release.stream : album.stream,
    payload.release.release_kind ?? album.release_kind,
  )
  const normalizedTracks = Array.isArray(payload.tracks)
    ? payload.tracks.reduce<ReleaseDetailTrack[]>((tracks, track, index) => {
        const title = readNonEmptyString(track?.title)
        const order = typeof track?.order === 'number' && Number.isFinite(track.order) ? track.order : index + 1
        if (!title) {
          return tracks
        }

        tracks.push({
          order,
          title,
          is_title_track: track?.is_title_track === true,
        })
        return tracks
      }, [])
    : []

  const artworkPayload = isUnknownRecord(payload.artwork) ? payload.artwork : null
  const coverImageUrl = readNonEmptyString(artworkPayload?.cover_image_url)
  const thumbnailImageUrl = readNonEmptyString(artworkPayload?.thumbnail_image_url) ?? coverImageUrl
  const artworkSourceUrl = readNonEmptyString(artworkPayload?.artwork_source_url) ?? coverImageUrl
  const artworkSourceType = readNonEmptyString(artworkPayload?.artwork_source_type) ?? 'backend_api'
  const mvPayload = isUnknownRecord(payload.mv) ? payload.mv : null
  const spotifyLink = isUnknownRecord(payload.service_links?.spotify) ? payload.service_links?.spotify : null
  const youtubeMusicLink = isUnknownRecord(payload.service_links?.youtube_music) ? payload.service_links?.youtube_music : null
  const youtubeVideoStatus = readNonEmptyString(mvPayload?.status)
  const normalizedVideoStatus =
    youtubeVideoStatus === 'relation_match' ||
    youtubeVideoStatus === 'manual_override' ||
    youtubeVideoStatus === 'needs_review' ||
    youtubeVideoStatus === 'no_link' ||
    youtubeVideoStatus === 'no_mv' ||
    youtubeVideoStatus === 'unresolved'
      ? youtubeVideoStatus
      : undefined
  const placeholderArtwork = buildPlaceholderReleaseArtwork(
    group,
    readNonEmptyString(payload.release.release_title) ?? album.title,
    readNonEmptyString(payload.release.release_date) ?? album.date,
    normalizedStream,
    payload.release.release_kind ?? album.release_kind,
  )

  return {
    detail: {
      group,
      release_title: readNonEmptyString(payload.release.release_title) ?? album.title,
      release_date: readNonEmptyString(payload.release.release_date) ?? album.date,
      stream: normalizedStream,
      release_kind: normalizeApiReleaseKind(payload.release.release_kind, album.release_kind),
      tracks: normalizedTracks,
      spotify_url: readNonEmptyString(spotifyLink?.url),
      youtube_music_url: readNonEmptyString(youtubeMusicLink?.url),
      youtube_video_id: readNonEmptyString(mvPayload?.video_id),
      youtube_video_url: readNonEmptyString(mvPayload?.url),
      youtube_video_status: normalizedVideoStatus,
      youtube_video_provenance: readNonEmptyString(mvPayload?.provenance),
      notes: readNonEmptyString(payload.notes) ?? '',
      isFallback: false,
    },
    artwork: coverImageUrl && thumbnailImageUrl && artworkSourceUrl
      ? {
          group,
          release_title: readNonEmptyString(payload.release.release_title) ?? album.title,
          release_date: readNonEmptyString(payload.release.release_date) ?? album.date,
          stream: normalizedStream,
          cover_image_url: coverImageUrl,
          thumbnail_image_url: thumbnailImageUrl,
          artwork_source_type: artworkSourceType,
          artwork_source_url: artworkSourceUrl,
          isPlaceholder: false,
        }
      : placeholderArtwork,
    releaseId,
    canonicalPath,
  }
}

async function fetchReleaseDetailApiSnapshot(
  album: ReleaseDetailApiRequest,
  group: string,
  entitySlug: string,
  signal: AbortSignal,
): Promise<{ snapshot: ReleaseDetailApiSnapshot | null; errorCode: string | null; traceId: string | null }> {
  const cacheKey = getReleaseLookupKey(group, album.title, album.date, normalizeReleaseStream(album.stream, album.release_kind))
  let releaseId = album.release_id ?? releaseDetailApiIdCache.get(cacheKey) ?? null
  let canonicalPath: string | null = null
  let traceId: string | null = null

  if (!releaseId) {
    const lookupResult = await fetchApiJson<ReleaseDetailLookupApiResponse>(
      buildReleaseDetailLookupUrl(album, entitySlug),
      signal,
      RELEASE_DETAIL_LOOKUP_TIMEOUT_MS,
      `web-release-lookup-${group}`,
    )
    traceId = lookupResult.traceId
    if (!lookupResult.ok || !lookupResult.body?.data?.release_id) {
      return {
        snapshot: null,
        errorCode: lookupResult.body?.error?.code ?? `lookup_${lookupResult.status}`,
        traceId,
      }
    }

    releaseId = lookupResult.body.data.release_id
    canonicalPath = lookupResult.body.data.canonical_path ?? null
    releaseDetailApiIdCache.set(cacheKey, releaseId)
  }

  const detailResult = await fetchApiJson<ReleaseDetailApiResponse>(
    `/v1/releases/${releaseId}`,
    signal,
    RELEASE_DETAIL_FETCH_TIMEOUT_MS,
    `web-release-detail-${group}`,
  )
  traceId = detailResult.traceId ?? traceId
  if (!detailResult.ok || !detailResult.body?.data) {
    return {
      snapshot: null,
      errorCode: detailResult.body?.error?.code ?? `detail_${detailResult.status}`,
      traceId,
    }
  }

  const snapshot = normalizeApiReleaseDetailSnapshot(
    album,
    group,
    detailResult.body.data,
    releaseId,
    canonicalPath,
  )

  if (!snapshot) {
    return {
      snapshot: null,
      errorCode: 'invalid_projection_payload',
      traceId,
    }
  }

  releaseDetailApiSnapshotCache.set(cacheKey, snapshot)
  return {
    snapshot,
    errorCode: null,
    traceId,
  }
}

function useReleaseDetailResource({
  album,
  group,
  entitySlug,
}: {
  album: VerifiedRelease
  group: string
  entitySlug: string
}): ReleaseDetailApiResource {
  const cacheKey = getReleaseLookupKey(group, album.title, album.date, normalizeReleaseStream(album.stream, album.release_kind))
  const cachedSnapshot = releaseDetailApiSnapshotCache.get(cacheKey) ?? null
  const cachedSnapshotRef = useRef(cachedSnapshot)
  const [remoteState, setRemoteState] = useState<{
    cacheKey: string
    snapshot: ReleaseDetailApiSnapshot | null
    loading: boolean
    errorCode: string | null
    traceId: string | null
  }>(() => {
    return {
      cacheKey,
      snapshot: cachedSnapshot,
      loading: cachedSnapshot === null,
      errorCode: null,
      traceId: null,
    }
  })

  useEffect(() => {
    cachedSnapshotRef.current = cachedSnapshot
  }, [cachedSnapshot])

  useEffect(() => {
    let cancelled = false
    const currentCachedSnapshot = cachedSnapshotRef.current

    const controller = new AbortController()
    const effectRequestAlbum: ReleaseDetailApiRequest = {
      title: album.title,
      date: album.date,
      stream: album.stream,
      release_kind: album.release_kind,
      release_id: album.release_id,
    }

    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      setRemoteState({
        cacheKey,
        snapshot: currentCachedSnapshot,
        loading: !currentCachedSnapshot,
        errorCode: null,
        traceId: null,
      })
    })

    void fetchReleaseDetailApiSnapshot(effectRequestAlbum, group, entitySlug, controller.signal)
      .then(({ snapshot, errorCode, traceId }) => {
        if (cancelled) {
          return
        }

        if (snapshot) {
          setRemoteState({
            cacheKey,
            snapshot,
            loading: false,
            errorCode: null,
            traceId,
          })
          return
        }

        setRemoteState({
          cacheKey,
          snapshot: currentCachedSnapshot,
          loading: false,
          errorCode: currentCachedSnapshot ? null : errorCode,
          traceId: currentCachedSnapshot ? null : traceId,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const failureState = buildFetchFailureState(error)
        if (failureState.errorCode === null) {
          return
        }

        setRemoteState({
          cacheKey,
          snapshot: currentCachedSnapshot,
          loading: false,
          errorCode: currentCachedSnapshot ? null : failureState.errorCode,
          traceId: currentCachedSnapshot ? null : failureState.traceId,
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [album.date, album.release_id, album.release_kind, album.stream, album.title, cacheKey, entitySlug, group])

  const activeSnapshot =
    remoteState.cacheKey === cacheKey
      ? remoteState.snapshot ?? cachedSnapshot ?? null
      : cachedSnapshot ?? null
  const loading = remoteState.cacheKey === cacheKey && remoteState.snapshot === null && remoteState.loading
  const errorCode = remoteState.cacheKey === cacheKey ? remoteState.errorCode : null
  const source: SurfaceStatusSource = !BACKEND_API_BASE_URL
    ? activeSnapshot || loading
      ? 'json'
      : 'backend_unavailable'
    : remoteState.snapshot || cachedSnapshot || remoteState.loading
      ? 'api'
      : 'backend_unavailable'

  return {
    snapshot: activeSnapshot,
    source,
    loading,
    errorCode,
    traceId: remoteState.cacheKey === cacheKey ? remoteState.traceId : null,
  }
}

function normalizeReleaseFormatValue(value: string | null | undefined): ReleaseFormat | '' {
  return value === 'single' || value === 'album' || value === 'ep' ? value : ''
}

function normalizeSearchDatePrecision(value: string | null | undefined): 'exact' | 'month_only' | 'unknown' {
  return value === 'exact' || value === 'month_only' || value === 'unknown' ? value : 'unknown'
}

function normalizeSearchDateStatus(value: string | null | undefined): 'confirmed' | 'scheduled' | 'rumor' {
  return value === 'confirmed' || value === 'scheduled' || value === 'rumor' ? value : 'rumor'
}

function buildSearchSurfaceApiSnapshot(data: SearchApiResponse['data']): SearchSurfaceSnapshot {
  return {
    entities: (Array.isArray(data?.entities) ? data.entities : []).reduce<SearchSurfaceEntityResult[]>((results, item) => {
      const entitySlug = readNonEmptyString(item.entity_slug)
      const canonicalPath = readNonEmptyString(item.canonical_path) ?? (entitySlug ? `/artists/${entitySlug}` : '')
      const displayName = readNonEmptyString(item.display_name)
      const canonicalName = readNonEmptyString(item.canonical_name) ?? displayName
      const entityType = readNonEmptyString(item.entity_type)
      if (!entitySlug || !canonicalPath || !displayName || !canonicalName || !entityType) {
        return results
      }

      results.push({
        entitySlug,
        canonicalPath,
        displayName,
        canonicalName,
        entityType,
        agencyName: readNonEmptyString(item.agency_name),
        matchReason: readNonEmptyString(item.match_reason) ?? 'partial',
        matchedAlias: readNonEmptyString(item.matched_alias),
        latestRelease:
          item.latest_release &&
          readNonEmptyString(item.latest_release.release_id) &&
          readNonEmptyString(item.latest_release.release_title) &&
          readNonEmptyString(item.latest_release.release_date)
            ? {
                releaseId: readNonEmptyString(item.latest_release.release_id) ?? '',
                title: readNonEmptyString(item.latest_release.release_title) ?? '',
                date: readNonEmptyString(item.latest_release.release_date) ?? '',
                stream:
                  item.latest_release.stream === 'album' || item.latest_release.stream === 'song'
                    ? item.latest_release.stream
                    : 'song',
                releaseKind: normalizeApiReleaseKind(item.latest_release.release_kind, 'single'),
              }
            : null,
        nextUpcoming:
          item.next_upcoming && readNonEmptyString(item.next_upcoming.headline)
            ? {
                headline: readNonEmptyString(item.next_upcoming.headline) ?? '',
                scheduledDate: readNonEmptyString(item.next_upcoming.scheduled_date) ?? '',
                scheduledMonth: readNonEmptyString(item.next_upcoming.scheduled_month) ?? '',
                datePrecision: normalizeSearchDatePrecision(item.next_upcoming.date_precision),
                dateStatus: normalizeSearchDateStatus(item.next_upcoming.date_status),
                releaseFormat: normalizeReleaseFormatValue(item.next_upcoming.release_format),
                confidence:
                  typeof item.next_upcoming.confidence_score === 'number' &&
                  Number.isFinite(item.next_upcoming.confidence_score)
                    ? item.next_upcoming.confidence_score
                    : 0,
              }
            : null,
      })
      return results
    }, []),
    releases: (Array.isArray(data?.releases) ? data.releases : []).reduce<SearchSurfaceReleaseResult[]>((results, item) => {
      const releaseId = readNonEmptyString(item.release_id)
      const entitySlug = readNonEmptyString(item.entity_slug)
      const detailPath =
        readNonEmptyString(item.detail_path) ??
        (releaseId && entitySlug ? `/artists/${entitySlug}/releases/${releaseId}` : '')
      const entityPath = readNonEmptyString(item.entity_path) ?? (entitySlug ? `/artists/${entitySlug}` : '')
      const displayName = readNonEmptyString(item.display_name)
      const releaseTitle = readNonEmptyString(item.release_title)
      const releaseDate = readNonEmptyString(item.release_date)
      const stream = item.stream === 'album' || item.stream === 'song' ? item.stream : null
      if (!releaseId || !entitySlug || !detailPath || !entityPath || !displayName || !releaseTitle || !releaseDate || !stream) {
        return results
      }

      results.push({
        releaseId,
        detailPath,
        entityPath,
        entitySlug,
        displayName,
        releaseTitle,
        releaseDate,
        stream,
        releaseKind: normalizeApiReleaseKind(item.release_kind, stream === 'album' ? 'album' : 'single'),
        releaseFormat: normalizeReleaseFormatValue(item.release_format),
        matchReason: readNonEmptyString(item.match_reason) ?? 'release_title_partial',
        matchedAlias: readNonEmptyString(item.matched_alias),
      })
      return results
    }, []),
    upcoming: (Array.isArray(data?.upcoming) ? data.upcoming : []).reduce<SearchSurfaceUpcomingResult[]>((results, item) => {
      const upcomingSignalId = readNonEmptyString(item.upcoming_signal_id)
      const entitySlug = readNonEmptyString(item.entity_slug)
      const entityPath = readNonEmptyString(item.entity_path) ?? (entitySlug ? `/artists/${entitySlug}` : '')
      const displayName = readNonEmptyString(item.display_name)
      const headline = readNonEmptyString(item.headline)
      if (!upcomingSignalId || !entitySlug || !entityPath || !displayName || !headline) {
        return results
      }

      results.push({
        upcomingSignalId,
        entityPath,
        entitySlug,
        displayName,
        headline,
        scheduled_date: readNonEmptyString(item.scheduled_date) ?? '',
        scheduled_month: readNonEmptyString(item.scheduled_month) ?? '',
        date_precision: normalizeSearchDatePrecision(item.date_precision),
        date_status: normalizeSearchDateStatus(item.date_status),
        release_format: normalizeReleaseFormatValue(item.release_format),
        confidence:
          typeof item.confidence_score === 'number' && Number.isFinite(item.confidence_score) ? item.confidence_score : 0,
        source_type: readNonEmptyString(item.source_type) ?? 'pending',
        source_url: readNonEmptyString(item.source_url) ?? '',
        source_domain: readNonEmptyString(item.source_domain) ?? getSourceDomain(readNonEmptyString(item.source_url) ?? ''),
        evidence_summary: readNonEmptyString(item.evidence_summary) ?? '',
        matchReason: readNonEmptyString(item.match_reason) ?? 'partial',
        matchedAlias: readNonEmptyString(item.matched_alias),
      })
      return results
    }, []),
  }
}

async function fetchSearchSurfaceApiSnapshot(
  search: string,
  signal: AbortSignal,
): Promise<{ snapshot: SearchSurfaceSnapshot | null; errorCode: string | null; traceId: string | null }> {
  const cacheKey = search.trim()
  const params = new URLSearchParams()
  params.set('q', search)
  params.set('limit', '20')

  const result = await fetchApiJson<SearchApiResponse | BridgeSearchIndex>(
    `/v1/search?${params.toString()}`,
    signal,
    SEARCH_SURFACE_TIMEOUT_MS,
    'web-search',
  )
  if (!result.ok || !result.body) {
    return {
      snapshot: null,
      errorCode:
        (result.body && 'error' in result.body ? result.body.error?.code : null) ?? `search_${result.status}`,
      traceId: result.traceId,
    }
  }

  const data = BACKEND_API_BASE_URL
    ? (result.body as SearchApiResponse).data
    : buildBridgeSearchApiData(result.body as BridgeSearchIndex, search)
  const snapshot = buildSearchSurfaceApiSnapshot(data)
  searchSurfaceApiSnapshotCache.set(cacheKey, snapshot)
  return {
    snapshot,
    errorCode: null,
    traceId: result.traceId,
  }
}

function useSearchSurfaceResource({
  search,
}: {
  search: string
}): SearchSurfaceResource {
  const cacheKey = search.trim()
  const cachedSnapshot = cacheKey ? searchSurfaceApiSnapshotCache.get(cacheKey) ?? null : null
  const cachedSnapshotRef = useRef(cachedSnapshot)
  const [remoteState, setRemoteState] = useState<{
    cacheKey: string
    snapshot: SearchSurfaceSnapshot | null
    loading: boolean
    errorCode: string | null
    traceId: string | null
  }>(() => ({
    cacheKey,
    snapshot: cachedSnapshot,
    loading: false,
    errorCode: null,
    traceId: null,
  }))

  useEffect(() => {
    cachedSnapshotRef.current = cachedSnapshot
  }, [cachedSnapshot])

  useEffect(() => {
    if (!cacheKey) {
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const currentCachedSnapshot = cachedSnapshotRef.current

    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      setRemoteState({
        cacheKey,
        snapshot: currentCachedSnapshot,
        loading: !currentCachedSnapshot,
        errorCode: null,
        traceId: null,
      })
    })

    void fetchSearchSurfaceApiSnapshot(search, controller.signal)
      .then(({ snapshot, errorCode, traceId }) => {
        if (cancelled) {
          return
        }

        setRemoteState({
          cacheKey,
          snapshot,
          loading: false,
          errorCode,
          traceId,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const failureState = buildFetchFailureState(error)
        if (failureState.errorCode === null) {
          return
        }

        setRemoteState({
          cacheKey,
          snapshot: currentCachedSnapshot,
          loading: false,
          errorCode: currentCachedSnapshot ? null : failureState.errorCode,
          traceId: currentCachedSnapshot ? null : failureState.traceId,
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [cacheKey, search])

  const activeSnapshot = cacheKey
    ? remoteState.cacheKey === cacheKey
      ? remoteState.snapshot ?? cachedSnapshot ?? null
      : cachedSnapshot
    : null
  const loading = !!cacheKey && remoteState.cacheKey === cacheKey && remoteState.snapshot === null && remoteState.loading
  const errorCode = remoteState.cacheKey === cacheKey ? remoteState.errorCode : null
  const source: SurfaceStatusSource = !cacheKey
    ? 'api'
    : activeSnapshot || loading
      ? BACKEND_API_BASE_URL
        ? 'api'
        : 'json'
      : 'backend_unavailable'

  return {
    ...(activeSnapshot ?? {
      entities: [],
      releases: [],
      upcoming: [],
    }),
    source,
    loading,
    errorCode,
    traceId: remoteState.cacheKey === cacheKey ? remoteState.traceId : null,
  }
}

function buildCalendarApiVerifiedRelease(item: CalendarMonthApiVerifiedRelease): VerifiedRelease | null {
  const entitySlug = readNonEmptyString(item.entity_slug)
  const displayName = readNonEmptyString(item.display_name)
  const releaseTitle = readNonEmptyString(item.release_title)
  const releaseDate = readNonEmptyString(item.release_date)
  const stream = item.stream === 'album' || item.stream === 'song' ? item.stream : null
  const group = resolveApiDisplayGroup(entitySlug, displayName)

  if (!group || !releaseTitle || !releaseDate || !stream) {
    return null
  }

  const releaseKind = normalizeApiReleaseKind(item.release_kind, stream === 'album' ? 'album' : 'single')

  return {
    group,
    entitySlug: entitySlug ?? undefined,
    displayName: displayName ?? group,
    agencyName: normalizeAgencyName(readNonEmptyString(item.agency_name)),
    artist_name_mb: displayName ?? group,
    artist_mbid: '',
    artist_source: readNonEmptyString(item.artist_source_url) ?? '',
    actType: normalizeApiActType(readNonEmptyString(item.entity_type)),
    stream,
    title: releaseTitle,
    date: releaseDate,
    source: readNonEmptyString(item.source_url) ?? '',
    release_kind: releaseKind,
    release_format:
      normalizeReleaseFormatValue(item.release_format) ||
      (releaseKind === 'album' || releaseKind === 'ep' || releaseKind === 'single' ? releaseKind : 'single'),
    context_tags: [],
    dateValue: new Date(`${releaseDate}T00:00:00`),
    isoDate: releaseDate,
    release_id: readNonEmptyString(item.release_id) ?? undefined,
  }
}

function buildCalendarApiUpcomingRow(item: CalendarMonthApiUpcomingItem): UpcomingCandidateRow | null {
  const entitySlug = readNonEmptyString(item.entity_slug)
  const displayName = readNonEmptyString(item.display_name)
  const headline = readNonEmptyString(item.headline)
  const group = resolveApiDisplayGroup(entitySlug, displayName)
  if (!group || !headline) {
    return null
  }

  const scheduledDate = readNonEmptyString(item.scheduled_date) ?? ''
  const scheduledMonth = readNonEmptyString(item.scheduled_month) ?? ''
  const datePrecision =
    item.date_precision === 'exact' || item.date_precision === 'month_only' || item.date_precision === 'unknown'
      ? item.date_precision
      : 'unknown'
  const dateStatus =
    item.date_status === 'confirmed' || item.date_status === 'scheduled' || item.date_status === 'rumor'
      ? item.date_status
      : 'rumor'
  const sourceUrl = readNonEmptyString(item.source_url) ?? ''

  return {
    group,
    entitySlug: entitySlug ?? undefined,
    displayName: displayName ?? group,
    agencyName: normalizeAgencyName(readNonEmptyString(item.agency_name)),
    actType: normalizeApiActType(readNonEmptyString(item.entity_type)),
    scheduled_date: scheduledDate,
    scheduled_month: scheduledMonth,
    date_precision: datePrecision,
    date_status: dateStatus,
    headline,
    release_format: normalizeReleaseFormatValue(item.release_format),
    context_tags: [],
    source_type: readNonEmptyString(item.source_type) ?? 'pending',
    source_url: sourceUrl,
    source_domain: readNonEmptyString(item.source_domain) ?? getSourceDomain(sourceUrl),
    published_at: '',
    confidence:
      typeof item.confidence_score === 'number' && Number.isFinite(item.confidence_score)
        ? item.confidence_score
        : 0,
    evidence_summary: readNonEmptyString(item.evidence_summary) ?? '',
    tracking_status: readNonEmptyString(item.tracking_status) ?? 'watch_only',
    search_term: '',
    event_key: readNonEmptyString(item.upcoming_signal_id) ?? undefined,
    evidence_count:
      typeof item.source_count === 'number' && Number.isFinite(item.source_count) ? item.source_count : undefined,
  }
}

function buildCalendarApiDatedUpcomingSignal(item: CalendarMonthApiUpcomingItem): DatedUpcomingSignal | null {
  const row = buildCalendarApiUpcomingRow(item)
  if (!row || !hasExactUpcomingDate(row)) {
    return null
  }

  return expandUpcomingCandidate(row)[0] ?? null
}

function dedupeCalendarVerifiedRows(rows: VerifiedRelease[]) {
  const seen = new Set<string>()
  return rows.filter((item) => {
    const key = getAlbumKey(item)
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function dedupeCalendarUpcomingRows<T extends UpcomingCandidateRow>(rows: T[]) {
  const seen = new Set<string>()
  return rows.filter((item) => {
    const key = getUpcomingDashboardRowKey(item)
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildCalendarMonthApiSnapshot(data: CalendarMonthApiResponse['data']): CalendarMonthApiSnapshot {
  const dayRows = Array.isArray(data?.days) ? data.days : []
  const verifiedRows = dedupeCalendarVerifiedRows(
    dayRows.flatMap((day) =>
      Array.isArray(day?.verified_releases) ? day.verified_releases.map(buildCalendarApiVerifiedRelease).filter(Boolean) : [],
    ) as VerifiedRelease[],
  )
  const scheduledRows = dedupeCalendarUpcomingRows(
    dayRows.flatMap((day) =>
      Array.isArray(day?.exact_upcoming) ? day.exact_upcoming.map(buildCalendarApiDatedUpcomingSignal).filter(Boolean) : [],
    ) as DatedUpcomingSignal[],
  )
  const monthOnlyRows = dedupeCalendarUpcomingRows(
    (Array.isArray(data?.month_only_upcoming) ? data.month_only_upcoming : [])
      .map(buildCalendarApiUpcomingRow)
      .filter((item): item is UpcomingCandidateRow => item !== null && getUpcomingDatePrecisionValue(item) === 'month_only'),
  )

  return {
    verifiedRows,
    scheduledRows,
    monthOnlyRows,
  }
}

async function fetchCalendarMonthApiSnapshot(
  monthKey: string,
  signal: AbortSignal,
): Promise<{ snapshot: CalendarMonthApiSnapshot | null; errorCode: string | null; traceId: string | null }> {
  const result = await fetchApiJson<CalendarMonthApiResponse>(
    `/v1/calendar/month?month=${encodeURIComponent(monthKey)}`,
    signal,
    CALENDAR_MONTH_FETCH_TIMEOUT_MS,
    `web-calendar-${monthKey}`,
  )
  if (!result.ok || !result.body?.data) {
    return {
      snapshot: null,
      errorCode: result.body?.error?.code ?? `calendar_month_${result.status}`,
      traceId: result.traceId,
    }
  }

  const snapshot = buildCalendarMonthApiSnapshot(result.body.data)
  calendarMonthApiSnapshotCache.set(monthKey, snapshot)
  return {
    snapshot,
    errorCode: null,
    traceId: result.traceId,
  }
}

function useCalendarMonthResource({
  monthKey,
}: {
  monthKey: string
}): CalendarMonthSurfaceResource {
  const cachedSnapshot = calendarMonthApiSnapshotCache.get(monthKey) ?? null
  const cachedSnapshotRef = useRef(cachedSnapshot)
  const [remoteState, setRemoteState] = useState<{
    monthKey: string
    snapshot: CalendarMonthApiSnapshot | null
    loading: boolean
    errorCode: string | null
    traceId: string | null
  }>(() => ({
    monthKey,
    snapshot: cachedSnapshot,
    loading: false,
    errorCode: null,
    traceId: null,
  }))

  useEffect(() => {
    cachedSnapshotRef.current = cachedSnapshot
  }, [cachedSnapshot])

  useEffect(() => {
    if (!monthKey) {
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const currentCachedSnapshot = cachedSnapshotRef.current

    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      setRemoteState({
        monthKey,
        snapshot: currentCachedSnapshot,
        loading: !currentCachedSnapshot,
        errorCode: null,
        traceId: null,
      })
    })

    void fetchCalendarMonthApiSnapshot(monthKey, controller.signal)
      .then(({ snapshot, errorCode, traceId }) => {
        if (cancelled) {
          return
        }

        setRemoteState({
          monthKey,
          snapshot,
          loading: false,
          errorCode,
          traceId,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const failureState = buildFetchFailureState(error)
        if (failureState.errorCode === null) {
          return
        }

        setRemoteState({
          monthKey,
          snapshot: currentCachedSnapshot,
          loading: false,
          errorCode: currentCachedSnapshot ? null : failureState.errorCode,
          traceId: currentCachedSnapshot ? null : failureState.traceId,
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [monthKey])

  const activeSnapshot =
    remoteState.monthKey === monthKey ? remoteState.snapshot ?? cachedSnapshot ?? null : cachedSnapshot
  const loading = remoteState.monthKey === monthKey && remoteState.snapshot === null && remoteState.loading
  const errorCode = remoteState.monthKey === monthKey ? remoteState.errorCode : null
  const source: SurfaceStatusSource = !BACKEND_API_BASE_URL
    ? 'json'
    : activeSnapshot || loading
      ? 'api'
      : 'backend_unavailable'

  return {
    snapshot: activeSnapshot,
    source,
    loading,
    errorCode,
    traceId: remoteState.monthKey === monthKey ? remoteState.traceId : null,
  }
}

function buildRadarLatestRelease(summary: RadarApiReleaseSummary | null | undefined): TeamLatestRelease | null {
  if (!summary) {
    return null
  }

  const releaseTitle = readNonEmptyString(summary.release_title)
  const releaseDate = readNonEmptyString(summary.release_date)
  const stream = summary.stream === 'album' || summary.stream === 'song' ? summary.stream : null
  if (!releaseTitle || !releaseDate || !stream) {
    return null
  }

  const releaseKind = normalizeApiReleaseKind(summary.release_kind, stream === 'album' ? 'album' : 'single')
  return {
    title: releaseTitle,
    date: releaseDate,
    releaseKind,
    releaseFormat:
      normalizeReleaseFormatValue(summary.release_format) ||
      (releaseKind === 'album' || releaseKind === 'ep' || releaseKind === 'single' ? releaseKind : ''),
    contextTags: [],
    streamLabel: stream,
    stream,
    source: readNonEmptyString(summary.source_url) ?? '',
    artistSource: readNonEmptyString(summary.artist_source_url) ?? '',
    verified: true,
  }
}

function buildRadarUpcomingSignal(
  group: string,
  trackingStatus: string,
  summary: RadarApiUpcomingSummary | null | undefined,
): UpcomingCandidateRow | null {
  if (!summary || !readNonEmptyString(summary.headline)) {
    return null
  }

  const headline = readNonEmptyString(summary.headline) ?? ''
  const scheduledDate = readNonEmptyString(summary.scheduled_date) ?? ''
  const scheduledMonth = readNonEmptyString(summary.scheduled_month) ?? ''
  const datePrecision =
    summary.date_precision === 'exact' || summary.date_precision === 'month_only' || summary.date_precision === 'unknown'
      ? summary.date_precision
      : 'unknown'
  const dateStatus =
    summary.date_status === 'confirmed' || summary.date_status === 'scheduled' || summary.date_status === 'rumor'
      ? summary.date_status
      : 'rumor'
  const sourceUrl = readNonEmptyString(summary.source_url) ?? ''

  return {
    group,
    scheduled_date: scheduledDate,
    scheduled_month: scheduledMonth,
    date_precision: datePrecision,
    date_status: dateStatus,
    headline,
    release_format: normalizeReleaseFormatValue(summary.release_format),
    context_tags: [],
    source_type: readNonEmptyString(summary.source_type) ?? 'pending',
    source_url: sourceUrl,
    source_domain: readNonEmptyString(summary.source_domain) ?? getSourceDomain(sourceUrl),
    published_at: readNonEmptyString(summary.latest_seen_at) ?? '',
    confidence:
      typeof summary.confidence_score === 'number' && Number.isFinite(summary.confidence_score)
        ? summary.confidence_score
        : 0,
    evidence_summary: readNonEmptyString(summary.evidence_summary) ?? '',
    tracking_status: trackingStatus,
    search_term: '',
    event_key: readNonEmptyString(summary.upcoming_signal_id) ?? undefined,
    evidence_count:
      typeof summary.source_count === 'number' && Number.isFinite(summary.source_count) ? summary.source_count : undefined,
  }
}

function buildRadarLongGapEntry(item: RadarApiLongGapItem): LongGapRadarEntry | null {
  const entitySlug = readNonEmptyString(item.entity_slug)
  const group = resolveApiDisplayGroup(entitySlug, readNonEmptyString(item.display_name))
  if (!group) {
    return null
  }

  const latestRelease = buildRadarLatestRelease(item.latest_release ?? null)
  if (!latestRelease) {
    return null
  }

  const trackingStatus = readNonEmptyString(item.tracking_status) ?? 'watch_only'
  const latestSignal = buildRadarUpcomingSignal(group, trackingStatus, item.latest_signal ?? null)
  const gapDays =
    typeof item.gap_days === 'number' && Number.isFinite(item.gap_days)
      ? item.gap_days
      : latestRelease.date && isExactDate(latestRelease.date)
        ? getElapsedDaysSinceDate(latestRelease.date)
        : 0

  return {
    group,
    entitySlug: entitySlug ?? undefined,
    agencyName: normalizeAgencyName(readNonEmptyString(item.agency_name)),
    watchReason: item.watch_reason === 'long_gap' ? 'long_gap' : 'long_gap',
    latestRelease,
    gapDays,
    hasUpcomingSignal: Boolean(item.has_upcoming_signal ?? latestSignal),
    latestSignal,
  }
}

function buildRadarRookieEntry(item: RadarApiRookieItem): RookieRadarEntry | null {
  const entitySlug = readNonEmptyString(item.entity_slug)
  const group = resolveApiDisplayGroup(entitySlug, readNonEmptyString(item.display_name))
  if (!group) {
    return null
  }

  const trackingStatus = readNonEmptyString(item.tracking_status) ?? 'watch_only'

  return {
    group,
    entitySlug: entitySlug ?? undefined,
    agencyName: normalizeAgencyName(readNonEmptyString(item.agency_name)),
    debutYear: typeof item.debut_year === 'number' && Number.isFinite(item.debut_year) ? item.debut_year : null,
    latestRelease: buildRadarLatestRelease(item.latest_release ?? null),
    hasUpcomingSignal: Boolean(item.has_upcoming_signal ?? item.latest_signal),
    latestSignal: buildRadarUpcomingSignal(group, trackingStatus, item.latest_signal ?? null),
  }
}

function buildRadarApiSnapshot(data: RadarApiResponse['data']): RadarApiSnapshot {
  return {
    longGapEntries: (Array.isArray(data?.long_gap) ? data.long_gap : [])
      .map(buildRadarLongGapEntry)
      .filter((item): item is LongGapRadarEntry => item !== null)
      .sort(compareLongGapRadarEntries),
    rookieEntries: (Array.isArray(data?.rookie) ? data.rookie : [])
      .map(buildRadarRookieEntry)
      .filter((item): item is RookieRadarEntry => item !== null)
      .sort(compareRookieRadarEntries),
  }
}

async function fetchRadarApiSnapshot(
  signal: AbortSignal,
): Promise<{ snapshot: RadarApiSnapshot | null; errorCode: string | null; traceId: string | null }> {
  const cacheKey = 'default'
  const result = await fetchApiJson<RadarApiResponse>('/v1/radar', signal, RADAR_FETCH_TIMEOUT_MS, 'web-radar')
  if (!result.ok || !result.body?.data) {
    return {
      snapshot: null,
      errorCode: result.body?.error?.code ?? `radar_${result.status}`,
      traceId: result.traceId,
    }
  }

  const snapshot = buildRadarApiSnapshot(result.body.data)
  radarApiSnapshotCache.set(cacheKey, snapshot)
  return {
    snapshot,
    errorCode: null,
    traceId: result.traceId,
  }
}

function useRadarSurfaceResource(): RadarSurfaceResource {
  const cacheKey = 'default'
  const cachedSnapshot = radarApiSnapshotCache.get(cacheKey) ?? null
  const cachedSnapshotRef = useRef(cachedSnapshot)
  const [remoteState, setRemoteState] = useState<{
    snapshot: RadarApiSnapshot | null
    loading: boolean
    errorCode: string | null
    traceId: string | null
  }>(() => ({
    snapshot: cachedSnapshot,
    loading: false,
    errorCode: null,
    traceId: null,
  }))

  useEffect(() => {
    cachedSnapshotRef.current = cachedSnapshot
  }, [cachedSnapshot])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const currentCachedSnapshot = cachedSnapshotRef.current

    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      setRemoteState({
        snapshot: currentCachedSnapshot,
        loading: !currentCachedSnapshot,
        errorCode: null,
        traceId: null,
      })
    })

    void fetchRadarApiSnapshot(controller.signal)
      .then(({ snapshot, errorCode, traceId }) => {
        if (cancelled) {
          return
        }

        setRemoteState({
          snapshot,
          loading: false,
          errorCode,
          traceId,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const failureState = buildFetchFailureState(error)
        if (failureState.errorCode === null) {
          return
        }

        setRemoteState({
          snapshot: currentCachedSnapshot,
          loading: false,
          errorCode: currentCachedSnapshot ? null : failureState.errorCode,
          traceId: currentCachedSnapshot ? null : failureState.traceId,
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const source: SurfaceStatusSource = !BACKEND_API_BASE_URL
    ? 'json'
    : remoteState.snapshot || cachedSnapshot || remoteState.loading
      ? 'api'
      : 'backend_unavailable'

  return {
    snapshot: remoteState.snapshot ?? cachedSnapshot ?? null,
    source,
    loading: remoteState.snapshot === null && remoteState.loading,
    errorCode: remoteState.errorCode,
    traceId: remoteState.traceId,
  }
}

function buildVerifiedTeamLatestRelease(release: VerifiedRelease): TeamLatestRelease {
  return {
    title: release.title,
    date: release.date,
    releaseKind: release.release_kind,
    releaseFormat: release.release_format,
    contextTags: release.context_tags,
    streamLabel: release.stream,
    stream: release.stream,
    source: release.source,
    artistSource: release.artist_source,
    musicHandoffs: release.music_handoffs,
    youtubeMvUrl: release.youtube_mv_url,
    verified: true,
  }
}

function buildEntityDetailUpcomingRow(
  group: string,
  fallbackTrackingStatus: string,
  summary: NonNullable<EntityDetailApiResponse['data']>['next_upcoming'],
): UpcomingCandidateRow | null {
  if (!summary || !readNonEmptyString(summary.headline)) {
    return null
  }

  const headline = readNonEmptyString(summary.headline) ?? ''
  const scheduledDate = readNonEmptyString(summary.scheduled_date) ?? ''
  const scheduledMonth = readNonEmptyString(summary.scheduled_month) ?? ''
  const datePrecision =
    summary.date_precision === 'exact' || summary.date_precision === 'month_only' || summary.date_precision === 'unknown'
      ? summary.date_precision
      : 'unknown'
  const dateStatus =
    summary.date_status === 'confirmed' || summary.date_status === 'scheduled' || summary.date_status === 'rumor'
      ? summary.date_status
      : 'rumor'
  const sourceUrl = readNonEmptyString(summary.source_url) ?? ''

  return {
    group,
    scheduled_date: scheduledDate,
    scheduled_month: scheduledMonth,
    date_precision: datePrecision,
    date_status: dateStatus,
    headline,
    release_format: normalizeReleaseFormatValue(summary.release_format),
    context_tags: [],
    source_type: readNonEmptyString(summary.source_type) ?? 'pending',
    source_url: sourceUrl,
    source_domain: readNonEmptyString(summary.source_domain) ?? getSourceDomain(sourceUrl),
    published_at: readNonEmptyString(summary.latest_seen_at) ?? '',
    confidence:
      typeof summary.confidence_score === 'number' && Number.isFinite(summary.confidence_score)
        ? summary.confidence_score
        : 0,
    evidence_summary: readNonEmptyString(summary.evidence_summary) ?? '',
    tracking_status: fallbackTrackingStatus,
    search_term: '',
    event_key: readNonEmptyString(summary.upcoming_signal_id) ?? undefined,
    evidence_count:
      typeof summary.source_count === 'number' && Number.isFinite(summary.source_count) ? summary.source_count : undefined,
  }
}

function inferEntityTimelineEventType(item: EntityDetailTimelineEntry): SourceTimelineEventType {
  const headline = (readNonEmptyString(item.headline) ?? '').toLowerCase()

  if (headline.includes('tracklist')) {
    return 'tracklist_reveal'
  }
  if (readNonEmptyString(item.scheduled_date)) {
    return item.date_status === 'confirmed' ? 'official_announcement' : 'date_update'
  }
  if (readNonEmptyString(item.scheduled_month)) {
    return 'date_update'
  }

  return 'first_signal'
}

function buildEntityTimelineSummary(item: EntityDetailTimelineEntry) {
  const parts = [
    normalizeReleaseFormatValue(item.release_format),
    readNonEmptyString(item.date_status),
    readNonEmptyString(item.scheduled_date) ?? readNonEmptyString(item.scheduled_month),
  ].filter((value): value is string => Boolean(value))

  return parts.join(' · ')
}

function buildEntityDetailSourceTimeline(
  group: string,
  items: NonNullable<EntityDetailApiResponse['data']>['source_timeline'],
): SourceTimelineItem[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item, index) => {
      const headline = readNonEmptyString(item.headline)
      if (!headline) {
        return null
      }

      const occurredAt =
        readNonEmptyString(item.published_at) ??
        readNonEmptyString(item.scheduled_date) ??
        readNonEmptyString(item.scheduled_month) ??
        ''

      return {
        group,
        occurred_at: occurredAt,
        event_type: inferEntityTimelineEventType(item),
        source_type: readNonEmptyString(item.source_type) ?? 'pending',
        headline,
        source_url: readNonEmptyString(item.source_url) ?? '',
        summary: buildEntityTimelineSummary(item),
        source_domain: readNonEmptyString(item.source_domain) ?? getSourceDomain(readNonEmptyString(item.source_url) ?? ''),
        sortValue: Date.parse(occurredAt) || index,
      } satisfies SourceTimelineItem
    })
    .filter((item): item is SourceTimelineItem => item !== null)
}

function normalizeEntityTypeLabel(value: string | null | undefined) {
  const normalized = readNonEmptyString(value)?.toLowerCase()
  if (normalized === 'solo') {
    return 'solo'
  }
  if (normalized === 'unit') {
    return 'unit'
  }
  return 'group'
}

function buildEntityDetailCompareOptions(
  items: NonNullable<EntityDetailApiResponse['data']>['compare_candidates'],
): TeamCompareOption[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => {
      const entitySlug = readNonEmptyString(item.entity_slug)
      const displayName = readNonEmptyString(item.display_name)
      if (!entitySlug || !displayName) {
        return null
      }

      return {
        group: displayName,
        entitySlug,
        displayName,
      } satisfies TeamCompareOption
    })
    .filter((item): item is TeamCompareOption => item !== null)
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

function buildEntityDetailRelatedActs(
  items: NonNullable<EntityDetailApiResponse['data']>['related_acts'],
): RelatedActRecommendation[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items.reduce<RelatedActRecommendation[]>((recommendations, item, index) => {
      const entitySlug = readNonEmptyString(item.entity_slug)
      const displayName = readNonEmptyString(item.display_name)
      if (!entitySlug || !displayName) {
        return recommendations
      }

      const reasonKind = readNonEmptyString(item.reason?.kind)
      let reason: RelatedActReason | null = null

      if (reasonKind === 'agency') {
        reason = {
          kind: 'agency',
          agency: readNonEmptyString(item.reason?.value) ?? readNonEmptyString(item.agency_name) ?? displayName,
        }
      } else if (reasonKind === 'entity_type') {
        reason = {
          kind: 'entity_type',
          entityType: normalizeEntityTypeLabel(item.reason?.value ?? item.entity_type),
        }
      }

      if (!reason) {
        return recommendations
      }

      recommendations.push({
        group: displayName,
        entitySlug,
        displayName,
        reason,
        score: items.length - index,
      })
      return recommendations
    }, [])
}

function buildEntityDetailTeamProfile(
  group: string,
  entitySlug: string,
  data: NonNullable<EntityDetailApiResponse['data']>,
): TeamProfile {
  const baseTeam = buildSyntheticTeamProfile(group, entitySlug)
  const canonicalGroup =
    readNonEmptyString(data.identity?.canonical_name) ??
    readNonEmptyString(data.identity?.display_name) ??
    group
  const releaseHistory = Array.isArray(data.release_history)
    ? data.release_history
        .map((item) => buildSyntheticVerifiedRelease(canonicalGroup, item))
        .filter((item): item is VerifiedRelease => item !== null)
    : []
  const latestReleaseSummary = data.latest_release
  const latestReleaseId = readNonEmptyString(latestReleaseSummary?.release_id)
  const latestReleaseRecordFromSummary = latestReleaseSummary
    ? buildSyntheticVerifiedRelease(canonicalGroup, latestReleaseSummary)
    : null
  const latestReleaseRecord =
    (latestReleaseId ? releaseHistory.find((item) => item.release_id === latestReleaseId) ?? null : null) ??
    latestReleaseRecordFromSummary ??
    releaseHistory[0] ??
    null
  const recentAlbums = Array.isArray(data.recent_albums)
    ? data.recent_albums
        .map((item) => buildSyntheticVerifiedRelease(canonicalGroup, item))
        .filter((item): item is VerifiedRelease => item !== null && item.stream === 'album')
    : []
  const nextUpcomingSignal = buildEntityDetailUpcomingRow(
    canonicalGroup,
    readNonEmptyString(data.tracking_state?.tracking_status) ?? baseTeam.trackingStatus,
    data.next_upcoming,
  )
  const upcomingSignals = nextUpcomingSignal ? [nextUpcomingSignal] : []
  const primaryTeamChannelUrl =
    readNonEmptyString(data.youtube_channels?.primary_team_channel_url) ??
    readNonEmptyString(data.official_links?.youtube) ??
    null
  const sourceTimeline = buildEntityDetailSourceTimeline(canonicalGroup, data.source_timeline)
  const compareOptions = buildEntityDetailCompareOptions(data.compare_candidates)
  const relatedActs = buildEntityDetailRelatedActs(data.related_acts)
  const verifiedHistoryByKey = new Map<string, VerifiedRelease>()

  for (const release of releaseHistory) {
    verifiedHistoryByKey.set(
      getReleaseLookupKey(canonicalGroup, release.title, release.date, release.stream),
      release,
    )
  }

  if (latestReleaseRecord) {
    verifiedHistoryByKey.set(
      getReleaseLookupKey(canonicalGroup, latestReleaseRecord.title, latestReleaseRecord.date, latestReleaseRecord.stream),
      latestReleaseRecord,
    )
  }

  const annualReleaseTimeline = buildAnnualReleaseTimelineSections(
    [...verifiedHistoryByKey.values()].sort(compareMonthlyDashboardVerified),
    upcomingSignals,
  )

  return {
    ...baseTeam,
    group: canonicalGroup,
    slug: readNonEmptyString(data.identity?.entity_slug) ?? baseTeam.slug,
    displayName: readNonEmptyString(data.identity?.display_name) ?? baseTeam.displayName,
    tier: readNonEmptyString(data.tracking_state?.tier) ?? baseTeam.tier,
    trackingStatus: readNonEmptyString(data.tracking_state?.tracking_status) ?? baseTeam.trackingStatus,
    artistSource: readNonEmptyString(data.artist_source_url) ?? '',
    xUrl: readNonEmptyString(data.official_links?.x) ?? '',
    instagramUrl: readNonEmptyString(data.official_links?.instagram) ?? '',
    youtubeUrl: primaryTeamChannelUrl,
    hasOfficialYouTubeUrl: Boolean(primaryTeamChannelUrl),
    agency: normalizeAgencyName(readNonEmptyString(data.identity?.agency_name) ?? baseTeam.agency),
    badgeImageUrl: readNonEmptyString(data.identity?.badge_image_url) ?? baseTeam.badgeImageUrl,
    representativeImageUrl: readNonEmptyString(data.identity?.representative_image_url) ?? baseTeam.representativeImageUrl,
    latestRelease: latestReleaseRecord ? buildVerifiedTeamLatestRelease(latestReleaseRecord) : null,
    recentAlbums,
    annualReleaseTimeline,
    upcomingSignals,
    sourceTimeline,
    nextUpcomingSignal,
    compareOptions,
    relatedActs,
  }
}

async function requestEntityDetailApiSnapshot(
  entitySlug: string,
  group: string | null,
  signal: AbortSignal,
  cacheKeys: string[],
): Promise<{ team: TeamProfile | null; errorCode: string | null; traceId: string | null; resolvedEntitySlug: string }> {
  const result = await fetchApiJson<EntityDetailApiResponse>(
    `/v1/entities/${encodeURIComponent(entitySlug)}`,
    signal,
    ENTITY_DETAIL_FETCH_TIMEOUT_MS,
    `web-entity-${entitySlug}`,
  )
  if (!result.ok || !result.body?.data) {
    return {
      team: null,
      errorCode: result.body?.error?.code ?? `entity_${result.status}`,
      traceId: result.traceId,
      resolvedEntitySlug: entitySlug,
    }
  }

  const fallbackGroup = group ?? humanizeRouteSlug(entitySlug)
  const team = buildEntityDetailTeamProfile(fallbackGroup, entitySlug, result.body.data)
  for (const nextCacheKey of cacheKeys) {
    if (nextCacheKey) {
      entityDetailApiSnapshotCache.set(nextCacheKey, team)
    }
  }
  return {
    team,
    errorCode: null,
    traceId: result.traceId,
    resolvedEntitySlug: entitySlug,
  }
}

async function fetchEntityDetailRecoveryCandidate(
  entitySlug: string,
  signal: AbortSignal,
): Promise<{ entitySlug: string; displayName: string } | null> {
  const searchTerms = buildEntityDetailRecoverySearchTerms(entitySlug)

  for (const searchTerm of searchTerms) {
    const params = new URLSearchParams()
    params.set('q', searchTerm)
    params.set('limit', '5')

    const result = await fetchApiJson<SearchApiResponse>(
      `/v1/search?${params.toString()}`,
      signal,
      SEARCH_SURFACE_TIMEOUT_MS,
      `web-entity-reresolve-${entitySlug}`,
    )

    if (!result.ok || !result.body?.data) {
      continue
    }

    const candidate = pickEntityDetailRecoveryCandidate(result.body.data.entities, entitySlug, searchTerm)
    if (candidate) {
      return candidate
    }
  }

  return null
}

async function fetchEntityDetailApiSnapshot(
  entitySlug: string,
  group: string | null,
  signal: AbortSignal,
): Promise<{ team: TeamProfile | null; errorCode: string | null; traceId: string | null }> {
  const directResult = await requestEntityDetailApiSnapshot(entitySlug, group, signal, [entitySlug])
  if (directResult.team || group) {
    return {
      team: directResult.team,
      errorCode: directResult.errorCode,
      traceId: directResult.traceId,
    }
  }

  const recoveryCandidate = await fetchEntityDetailRecoveryCandidate(entitySlug, signal)
  if (!recoveryCandidate) {
    return {
      team: directResult.team,
      errorCode: directResult.errorCode,
      traceId: directResult.traceId,
    }
  }

  const recoveredResult = await requestEntityDetailApiSnapshot(
    recoveryCandidate.entitySlug,
    recoveryCandidate.displayName,
    signal,
    [entitySlug, recoveryCandidate.entitySlug],
  )

  return {
    team: recoveredResult.team,
    errorCode: recoveredResult.errorCode,
    traceId: recoveredResult.traceId,
  }
}

function useEntityDetailResource({
  group,
  entitySlug,
}: {
  group: string | null
  entitySlug: string | null
}): EntityDetailSurfaceResource {
  const cacheKey = entitySlug ?? group ?? ''
  const cachedSnapshot = cacheKey ? entityDetailApiSnapshotCache.get(cacheKey) ?? null : null
  const cachedSnapshotRef = useRef(cachedSnapshot)
  const [remoteState, setRemoteState] = useState<{
    cacheKey: string
    team: TeamProfile | null
    loading: boolean
    errorCode: string | null
    traceId: string | null
  }>(() => ({
    cacheKey,
    team: cachedSnapshot,
    loading: Boolean(cacheKey && entitySlug && !cachedSnapshot && BACKEND_API_BASE_URL),
    errorCode: null,
    traceId: null,
  }))

  useEffect(() => {
    cachedSnapshotRef.current = cachedSnapshot
  }, [cachedSnapshot])

  useEffect(() => {
    if (!cacheKey || !entitySlug) {
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const currentCachedSnapshot = cachedSnapshotRef.current

    Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      setRemoteState({
        cacheKey,
        team: currentCachedSnapshot,
        loading: !currentCachedSnapshot,
        errorCode: null,
        traceId: null,
      })
    })

    void fetchEntityDetailApiSnapshot(entitySlug, group, controller.signal)
      .then(({ team, errorCode, traceId }) => {
        if (cancelled) {
          return
        }

        setRemoteState({
          cacheKey,
          team,
          loading: false,
          errorCode,
          traceId,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const failureState = buildFetchFailureState(error)
        if (failureState.errorCode === null) {
          return
        }

        setRemoteState({
          cacheKey,
          team: currentCachedSnapshot,
          loading: false,
          errorCode: currentCachedSnapshot ? null : failureState.errorCode,
          traceId: currentCachedSnapshot ? null : failureState.traceId,
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [cacheKey, entitySlug, group])

  const activeTeam = cacheKey
    ? remoteState.cacheKey === cacheKey
      ? remoteState.team ?? cachedSnapshot
      : cachedSnapshot
    : null
  const loading = !!cacheKey && remoteState.cacheKey === cacheKey && remoteState.team === null && remoteState.loading
  const errorCode = remoteState.cacheKey === cacheKey ? remoteState.errorCode : null
  const source: SurfaceStatusSource = activeTeam || loading ? (BACKEND_API_BASE_URL ? 'api' : 'json') : 'backend_unavailable'

  return {
    team: activeTeam,
    source,
    loading,
    errorCode,
    traceId: remoteState.cacheKey === cacheKey ? remoteState.traceId : null,
  }
}

function buildReleaseDetailHandoffs(
  detail: ResolvedReleaseDetail | null,
  canonicalUrls?: MusicHandoffUrls,
): MusicHandoffUrls | undefined {
  const merged = {
    spotify: detail?.spotify_url ?? canonicalUrls?.spotify,
    youtube_music: detail?.youtube_music_url ?? canonicalUrls?.youtube_music,
  }

  if (!merged.spotify && !merged.youtube_music) {
    return canonicalUrls
  }

  return merged
}

function buildTeamProfiles() {
  return Array.from(
    new Set([
      ...watchlist.map((row) => row.group),
      ...releaseCatalog.map((row) => row.group),
      ...upcomingCandidates.map((row) => row.group),
    ]),
  )
    .map((group) => {
      const watchRow = watchlistByGroup.get(group)
      const releaseRow = releaseCatalogByGroup.get(group)
      const artistProfile = artistProfileByGroup.get(group)
      const groupReleases = releaseGroups.get(group) ?? []
      const verifiedHistory = verifiedReleaseHistoryByGroup.get(group) ?? []
      const upcomingSignals = [...(upcomingByGroup.get(group) ?? [])].sort(compareUpcomingSignals)
      const changeLog = releaseChangeLogByGroup.get(group) ?? []
      const sourceTimeline = buildSourceTimeline(group, rawUpcomingByGroup.get(group) ?? [], groupReleases)
      const annualReleaseTimeline = buildAnnualReleaseTimelineSections(verifiedHistory, upcomingSignals)
      const latestRelease = deriveLatestRelease(groupReleases, watchRow, releaseRow)
      const badgeSourceUrl = getTeamBadgeSourceUrl(group)
      const primaryYouTubeUrl = getPrimaryTeamYouTubeUrl(group)

      return {
        group,
        slug: artistProfile?.slug ?? slugifyGroup(group),
        displayName: artistProfile?.display_name ?? group,
        aliases: artistProfile?.aliases ?? [],
        tier: watchRow?.tier ?? 'tracked',
        trackingStatus: watchRow?.tracking_status ?? 'watch_only',
        artistSource: releaseRow?.artist_source ?? latestRelease?.artistSource ?? '',
        xUrl: artistProfile?.official_x_url ?? '',
        instagramUrl: artistProfile?.official_instagram_url ?? '',
        youtubeUrl: primaryYouTubeUrl,
        hasOfficialYouTubeUrl: Boolean(primaryYouTubeUrl),
        agency: normalizeAgencyName(artistProfile?.agency),
        badgeImageUrl: getTeamBadgeImageUrl(group),
        badgeSourceUrl,
        badgeSourceLabel: getTeamBadgeSourceLabel(group),
        representativeImageUrl: artistProfile?.representative_image_url ?? null,
        representativeImageSource: artistProfile?.representative_image_source ?? null,
        latestRelease,
        recentAlbums: verifiedHistory.filter((item) => item.stream === 'album'),
        upcomingSignals,
        sourceTimeline,
        annualReleaseTimeline,
        changeLog,
        nextUpcomingSignal: upcomingSignals[0] ?? null,
        compareOptions: [],
        relatedActs: [],
      }
    })
    .sort(compareTeamProfiles)
}

function buildRelatedActsByGroup() {
  return teamProfiles.reduce<Map<string, RelatedActRecommendation[]>>((map, team) => {
    const teamRadarTags = getTeamRelatedRadarTags(team.group)
    const recommendations = teamProfiles
      .flatMap((candidate) => {
        if (candidate.group === team.group) {
          return []
        }

        const agencyMatch =
          team.agency && candidate.agency && team.agency === candidate.agency && team.agency !== AGENCY_UNKNOWN_FILTER
        const sharedRadarTag = pickSharedRadarTag(teamRadarTags, getTeamRelatedRadarTags(candidate.group))
        const manualOverrideMatch = hasManualOverridePair(team.group, candidate.group)

        let reason: RelatedActReason | null = null
        let score = 0

        if (agencyMatch) {
          reason = {
            kind: 'agency',
            agency: team.agency,
          }
          score = 300
        } else if (sharedRadarTag) {
          reason = {
            kind: 'radar_tag',
            radarTag: sharedRadarTag,
          }
          score = 200
        } else if (manualOverrideMatch) {
          reason = {
            kind: 'manual_override',
          }
          score = 100
        }

        if (!reason) {
          return []
        }

        if (agencyMatch && sharedRadarTag) {
          score += 20
        }
        if (agencyMatch && manualOverrideMatch) {
          score += 10
        }

        return [
          {
            group: candidate.group,
            entitySlug: candidate.slug,
            displayName: candidate.displayName,
            reason,
            score,
          } satisfies RelatedActRecommendation,
        ]
      })
      .sort(compareRelatedActRecommendations)
      .slice(0, 6)

    map.set(team.group, recommendations)
    return map
  }, new Map())
}

function buildTeamCompareSnapshot(group: string): TeamCompareSnapshot {
  const verifiedRows = verifiedReleaseHistoryByGroup.get(group) ?? []
  const upcomingSignals = [...(upcomingByGroup.get(group) ?? [])].sort(compareUpcomingSignals)
  const recentYearThreshold = getDateDaysBefore(new Date(), 365)

  return {
    group,
    latestVerifiedRelease: verifiedRows[0] ?? null,
    latestAlbum: verifiedRows.find((item) => item.stream === 'album') ?? null,
    latestSong: verifiedRows.find((item) => item.stream === 'song') ?? null,
    nextUpcomingSignal: upcomingSignals[0] ?? null,
    recentYearReleaseCount: verifiedRows.filter((item) => item.dateValue.getTime() >= recentYearThreshold.getTime()).length,
  }
}

function compareLongGapRadarEntries(left: LongGapRadarEntry, right: LongGapRadarEntry) {
  if (left.hasUpcomingSignal !== right.hasUpcomingSignal) {
    return left.hasUpcomingSignal ? -1 : 1
  }

  const leftConfidence = left.latestSignal?.confidence ?? -1
  const rightConfidence = right.latestSignal?.confidence ?? -1
  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence
  }

  const leftOccurredAt = left.latestSignal ? getSourceTimelineSortValue(getSignalOccurredAt(left.latestSignal)) : -1
  const rightOccurredAt = right.latestSignal ? getSourceTimelineSortValue(getSignalOccurredAt(right.latestSignal)) : -1
  if (leftOccurredAt !== rightOccurredAt) {
    return rightOccurredAt - leftOccurredAt
  }

  if (left.gapDays !== right.gapDays) {
    return right.gapDays - left.gapDays
  }

  return left.group.localeCompare(right.group)
}

function compareMonthlyDashboardVerified(left: VerifiedRelease, right: VerifiedRelease) {
  if (left.dateValue.getTime() !== right.dateValue.getTime()) {
    return left.dateValue.getTime() - right.dateValue.getTime()
  }

  return left.group.localeCompare(right.group)
}

function compareMonthlyDashboardUpcoming(left: DatedUpcomingSignal, right: DatedUpcomingSignal) {
  if (left.dateValue.getTime() !== right.dateValue.getTime()) {
    return left.dateValue.getTime() - right.dateValue.getTime()
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence
  }

  return left.group.localeCompare(right.group)
}

function getVerifiedDashboardDefaultSortDirection(): DashboardSortDirection {
  return 'asc'
}

function getScheduledDashboardDefaultSortDirection(key: ScheduledDashboardSortKey): DashboardSortDirection {
  return key === 'confidence' ? 'desc' : 'asc'
}

function sortVerifiedDashboardRows(
  rows: VerifiedRelease[],
  sortKey: VerifiedDashboardSortKey,
  direction: DashboardSortDirection,
) {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    let comparison = 0

    if (sortKey === 'team') {
      comparison = getTeamDisplayName(left.group).localeCompare(getTeamDisplayName(right.group))
      if (comparison === 0) {
        comparison = left.dateValue.getTime() - right.dateValue.getTime()
      }
    } else {
      comparison = left.dateValue.getTime() - right.dateValue.getTime()
      if (comparison === 0) {
        comparison = getTeamDisplayName(left.group).localeCompare(getTeamDisplayName(right.group))
      }
    }

    if (comparison === 0) {
      comparison = left.title.localeCompare(right.title)
    }

    return comparison * multiplier
  })
}

function sortScheduledDashboardRows<T extends UpcomingSignalBase>(
  rows: T[],
  sortKey: ScheduledDashboardSortKey,
  direction: DashboardSortDirection,
) {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    let comparison = 0

    if (sortKey === 'team') {
      comparison = getTeamDisplayName(left.group).localeCompare(getTeamDisplayName(right.group))
    } else if (sortKey === 'status') {
      comparison = compareDashboardStatus(left.date_status, right.date_status)
    } else if (sortKey === 'confidence') {
      comparison = left.confidence - right.confidence
    } else {
      comparison = compareScheduledDashboardDate(left, right)
    }

    if (comparison === 0) {
      comparison = compareScheduledDashboardDate(left, right)
    }

    if (comparison === 0) {
      comparison = getTeamDisplayName(left.group).localeCompare(getTeamDisplayName(right.group))
    }

    if (comparison === 0) {
      comparison = left.headline.localeCompare(right.headline)
    }

    return comparison * multiplier
  })
}

function compareScheduledDashboardDate(left: UpcomingSignalBase, right: UpcomingSignalBase) {
  const leftHasDate = hasExactUpcomingDate(left)
  const rightHasDate = hasExactUpcomingDate(right)
  if (leftHasDate && rightHasDate) {
    const dateCompare = parseDateValue(left.scheduled_date) - parseDateValue(right.scheduled_date)
    if (dateCompare !== 0) {
      return dateCompare
    }
  } else if (leftHasDate !== rightHasDate) {
    return leftHasDate ? -1 : 1
  }

  const leftMonthKey = getUpcomingMonthKey(left)
  const rightMonthKey = getUpcomingMonthKey(right)
  if (leftMonthKey && rightMonthKey && leftMonthKey !== rightMonthKey) {
    return leftMonthKey.localeCompare(rightMonthKey)
  }

  return 0
}

function compareDashboardStatus(left: UpcomingSignalBase['date_status'], right: UpcomingSignalBase['date_status']) {
  const rank = { confirmed: 0, scheduled: 1, rumor: 2 }
  return rank[left] - rank[right]
}

function formatDashboardSortIndicator(direction: DashboardSortDirection) {
  return direction === 'asc' ? '↑' : '↓'
}

function compareRookieRadarEntries(left: RookieRadarEntry, right: RookieRadarEntry) {
  if (left.hasUpcomingSignal !== right.hasUpcomingSignal) {
    return left.hasUpcomingSignal ? -1 : 1
  }

  const leftReleaseDate = parseDateValue(left.latestRelease?.date)
  const rightReleaseDate = parseDateValue(right.latestRelease?.date)
  if (leftReleaseDate !== rightReleaseDate) {
    return rightReleaseDate - leftReleaseDate
  }

  if ((left.debutYear ?? -1) !== (right.debutYear ?? -1)) {
    return (right.debutYear ?? -1) - (left.debutYear ?? -1)
  }

  return left.group.localeCompare(right.group)
}

function buildSearchIndexByGroup() {
  const groups = new Set([
    ...artistProfiles.map((row) => row.group),
    ...watchlist.map((row) => row.group),
    ...releaseCatalog.map((row) => row.group),
    ...upcomingCandidates.map((row) => row.group),
  ])

  return new Map(
    Array.from(groups, (group) => {
      const artistProfile = artistProfileByGroup.get(group)
      const releaseRow = releaseCatalogByGroup.get(group)
      const upcomingSignals = upcomingByGroup.get(group) ?? []

      return [
        group,
        buildSearchIndex([
          group,
          artistProfile?.slug,
          artistProfile?.display_name,
          ...(artistProfile?.aliases ?? []),
          ...(artistProfile?.search_aliases ?? []),
          releaseRow?.latest_song?.title,
          releaseRow?.latest_album?.title,
          ...upcomingSignals.map((item) => item.headline),
        ]),
      ]
    }),
  )
}

function deriveLatestRelease(
  groupReleases: VerifiedRelease[],
  watchRow?: WatchlistRow,
  releaseRow?: ReleaseRow,
): TeamLatestRelease | null {
  const latestVerified = groupReleases[0]
  if (latestVerified) {
    return {
      title: latestVerified.title,
      date: latestVerified.date,
      releaseKind: latestVerified.release_kind,
      releaseFormat: latestVerified.release_format,
      contextTags: latestVerified.context_tags,
      streamLabel: latestVerified.stream,
      stream: latestVerified.stream,
      source: latestVerified.source,
      artistSource: latestVerified.artist_source,
      musicHandoffs: latestVerified.music_handoffs,
      verified: true,
    }
  }

  if (!watchRow?.latest_release_title && !watchRow?.latest_release_date) {
    return null
  }

  return {
    title: watchRow.latest_release_title || 'Tracked release pending',
    date: watchRow.latest_release_date || '',
    releaseKind: watchRow.latest_release_kind || 'unknown',
    releaseFormat:
      watchRow.latest_release_kind === 'single' ||
      watchRow.latest_release_kind === 'album' ||
      watchRow.latest_release_kind === 'ep'
        ? watchRow.latest_release_kind
        : '',
    contextTags: [],
    streamLabel: 'watchlist',
    stream: 'watchlist',
    source: '',
    artistSource: releaseRow?.artist_source ?? '',
    verified: false,
  }
}

function compareTeamProfiles(left: TeamProfile, right: TeamProfile) {
  const upcomingCompare = compareUpcomingSignals(left.nextUpcomingSignal, right.nextUpcomingSignal)
  if (upcomingCompare !== 0) {
    return upcomingCompare
  }

  const leftDate = parseDateValue(left.latestRelease?.date)
  const rightDate = parseDateValue(right.latestRelease?.date)
  if (leftDate !== rightDate) {
    return rightDate - leftDate
  }

  return left.group.localeCompare(right.group)
}

function getUpcomingSourceTier(sourceType: string) {
  const tiers: Record<string, number> = {
    agency_notice: 4,
    weverse_notice: 3,
    official_social: 2,
    news_rss: 1,
  }

  return tiers[sourceType] ?? 0
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripUpcomingSourceSuffix(value: string) {
  return value.replace(/\s+-\s+[^-]+$/u, ' ')
}

function normalizeUpcomingGroupingText(value: string, group: string) {
  let normalized = stripUpcomingSourceSuffix(value)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, ' and ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')

  for (const token of group.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token.length < 2) {
      continue
    }
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'g'), ' ')
  }

  return normalized
    .replace(
      /\b(?:comeback|comebacks|announce|announces|announced|announcing|return|returns|returning|release|releases|released|releasing|drop|drops|dropped|dropping|set|scheduled|schedule|showcase|notice|official|teaser|teasers|trailer|trailers|report|reports|ahead|after|with|their|first|new|album|mini|single|ep|tracklist|title|track|tour|global|hosts|hosted|concert|celebrate|chapter)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:a|an|the|and|for|of|to|in|on|at|this|that)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractUpcomingReleaseLabel(item: UpcomingSignalBase) {
  const text = `${item.headline} ${item.evidence_summary}`
  const patterns = [
    /(?:mini album|album|single|ep|title track|showcase(?:\s+for)?|trailer(?:\s+for)?|teaser(?:\s+for)?)\s*[“"'‘]?([^“”"'’]{2,80})[”"'’]/gi,
    /[“"'‘]([^“”"'’]{2,80})[”"'’]/g,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const normalized = normalizeUpcomingGroupingText(match[1] ?? '', item.group)
      if (normalized) {
        return normalized
      }
    }
  }

  return ''
}

function getUpcomingMonthKey(item: UpcomingSignalBase) {
  if (hasExactUpcomingDate(item)) {
    return item.scheduled_date.slice(0, 7)
  }
  if (getUpcomingDatePrecisionValue(item) === 'month_only' && isMonthKey(item.scheduled_month)) {
    return item.scheduled_month
  }
  return ''
}

function getUpcomingEventDescriptor(item: UpcomingSignalBase) {
  const releaseLabel = extractUpcomingReleaseLabel(item)
  if (releaseLabel) {
    return releaseLabel
  }

  const headlineKey = normalizeUpcomingGroupingText(item.headline, item.group)
  if (headlineKey) {
    return headlineKey
  }

  const summaryKey = normalizeUpcomingGroupingText(item.evidence_summary, item.group)
  return summaryKey || 'signal'
}

function getUpcomingStructuredMetadataScore(item: UpcomingSignalBase) {
  let score = 0
  if (item.release_format) {
    score += 2
  }
  score += item.context_tags.length
  if (extractUpcomingReleaseLabel(item)) {
    score += 2
  }
  if (item.evidence_summary) {
    score += 1
  }
  return score
}

function getUpcomingPublishedSortValue(item: UpcomingSignalBase) {
  const timestamp = Date.parse(item.published_at)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function compareUpcomingRepresentativeRows(left: UpcomingSignalBase, right: UpcomingSignalBase) {
  const sourceCompare = getUpcomingSourceTier(right.source_type) - getUpcomingSourceTier(left.source_type)
  if (sourceCompare !== 0) {
    return sourceCompare
  }

  const exactDateCompare = Number(hasExactUpcomingDate(right)) - Number(hasExactUpcomingDate(left))
  const rightPrecision = getUpcomingDatePrecisionValue(right)
  const leftPrecision = getUpcomingDatePrecisionValue(left)
  const precisionRank = {
    exact: 0,
    month_only: 1,
    unknown: 2,
  }
  if (precisionRank[leftPrecision] !== precisionRank[rightPrecision]) {
    return precisionRank[leftPrecision] - precisionRank[rightPrecision]
  }
  if (exactDateCompare !== 0) {
    return exactDateCompare
  }

  const leftMonthKey = getUpcomingMonthKey(left)
  const rightMonthKey = getUpcomingMonthKey(right)
  if (leftMonthKey && rightMonthKey && leftMonthKey !== rightMonthKey) {
    return leftMonthKey.localeCompare(rightMonthKey)
  }

  const statusRank = {
    confirmed: 0,
    scheduled: 1,
    rumor: 2,
  }
  if (statusRank[left.date_status] !== statusRank[right.date_status]) {
    return statusRank[left.date_status] - statusRank[right.date_status]
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence
  }

  const metadataCompare = getUpcomingStructuredMetadataScore(right) - getUpcomingStructuredMetadataScore(left)
  if (metadataCompare !== 0) {
    return metadataCompare
  }

  const publishedCompare = getUpcomingPublishedSortValue(right) - getUpcomingPublishedSortValue(left)
  if (publishedCompare !== 0) {
    return publishedCompare
  }

  return left.headline.localeCompare(right.headline)
}

function pickUpcomingRepresentative(rows: UpcomingSignalBase[]) {
  return [...rows].sort(compareUpcomingRepresentativeRows)[0]
}

function pushUpcomingGroup<T>(map: Map<string, T[]>, key: string, value: T) {
  const bucket = map.get(key) ?? []
  bucket.push(value)
  map.set(key, bucket)
}

function selectBestUpcomingGroup(groups?: UpcomingSignalBase[][]) {
  if (!groups?.length) {
    return null
  }

  return [...groups].sort((left, right) => {
    const leftRepresentative = pickUpcomingRepresentative(left)
    const rightRepresentative = pickUpcomingRepresentative(right)
    return compareUpcomingRepresentativeRows(leftRepresentative, rightRepresentative)
  })[0]
}

function buildUpcomingDisplayRow(rows: UpcomingSignalBase[]) {
  const representative = pickUpcomingRepresentative(rows)
  const monthKey = getUpcomingMonthKey(representative) || 'undated'
  return {
    ...representative,
    event_key: [representative.group.toLowerCase(), representative.scheduled_date || monthKey, getUpcomingEventDescriptor(representative)].join(
      '::',
    ),
    evidence_count: rows.length,
    hidden_source_count: Math.max(rows.length - 1, 0),
  }
}

function dedupeUpcomingCandidatesForDisplay(rows: UpcomingCandidateRow[]) {
  const exactGroups = new Map<string, UpcomingSignalBase[]>()
  const pendingGroups = new Map<string, UpcomingSignalBase[]>()

  for (const row of rows) {
    const descriptor = getUpcomingEventDescriptor(row)
    if (hasExactUpcomingDate(row)) {
      pushUpcomingGroup(exactGroups, [row.group.toLowerCase(), row.scheduled_date, descriptor].join('::'), row)
      continue
    }

    const pendingMonthKey = getUpcomingMonthKey(row) || 'undated'
    pushUpcomingGroup(pendingGroups, [row.group.toLowerCase(), pendingMonthKey, descriptor].join('::'), row)
  }

  const exactGroupsByDate = new Map<string, UpcomingSignalBase[][]>()
  for (const exactGroup of exactGroups.values()) {
    const bucketKey = [exactGroup[0].group.toLowerCase(), exactGroup[0].scheduled_date].join('::')
    pushUpcomingGroup(exactGroupsByDate, bucketKey, exactGroup)
  }

  const normalizedExactGroups: UpcomingSignalBase[][] = []
  for (const dateBucket of exactGroupsByDate.values()) {
    const bucketRows = dateBucket.flat()
    const hasOfficialSource = bucketRows.some((item) => getUpcomingSourceTier(item.source_type) > getUpcomingSourceTier('news_rss'))
    if (hasOfficialSource) {
      normalizedExactGroups.push(bucketRows)
      continue
    }
    normalizedExactGroups.push(...dateBucket)
  }

  const exactGroupsByTopic = new Map<string, UpcomingSignalBase[][]>()
  const exactGroupsByMonth = new Map<string, UpcomingSignalBase[][]>()
  for (const exactGroup of normalizedExactGroups) {
    const representative = pickUpcomingRepresentative(exactGroup)
    pushUpcomingGroup(exactGroupsByTopic, [representative.group.toLowerCase(), getUpcomingEventDescriptor(representative)].join('::'), exactGroup)

    const exactMonthKey = getUpcomingMonthKey(representative)
    if (exactMonthKey) {
      pushUpcomingGroup(exactGroupsByMonth, [representative.group.toLowerCase(), exactMonthKey].join('::'), exactGroup)
    }
  }

  const mergedGroups = [...normalizedExactGroups]
  for (const pendingGroup of pendingGroups.values()) {
    const representative = pickUpcomingRepresentative(pendingGroup)
    const topicMatch = selectBestUpcomingGroup(
      exactGroupsByTopic.get([representative.group.toLowerCase(), getUpcomingEventDescriptor(representative)].join('::')),
    )
    const monthKey = getUpcomingMonthKey(representative)
    const monthMatch =
      topicMatch || !monthKey
        ? null
        : selectBestUpcomingGroup(exactGroupsByMonth.get([representative.group.toLowerCase(), monthKey].join('::')))

    if (topicMatch ?? monthMatch) {
      ;(topicMatch ?? monthMatch)?.push(...pendingGroup)
      continue
    }

    mergedGroups.push(pendingGroup)
  }

  return mergedGroups.map(buildUpcomingDisplayRow).sort(compareUpcomingSignals)
}

function formatUpcomingEvidenceMeta(item: UpcomingCandidateRow, language: Language) {
  const evidenceCount = item.evidence_count ?? 1
  const hiddenCount = item.hidden_source_count ?? Math.max(evidenceCount - 1, 0)

  if (evidenceCount <= 1) {
    return ''
  }

  if (language === 'ko') {
    return hiddenCount > 0 ? `근거 ${evidenceCount}건 · 외 ${hiddenCount}건` : `근거 ${evidenceCount}건`
  }

  return hiddenCount > 0
    ? `${evidenceCount} sources · ${hiddenCount} more`
    : `${evidenceCount} source${evidenceCount === 1 ? '' : 's'}`
}

function compareUpcomingSignals(
  left?: UpcomingCandidateRow | null,
  right?: UpcomingCandidateRow | null,
) {
  if (!left && !right) {
    return 0
  }
  if (!left) {
    return 1
  }
  if (!right) {
    return -1
  }

  const leftHasDate = hasExactUpcomingDate(left)
  const rightHasDate = hasExactUpcomingDate(right)
  const leftPrecision = getUpcomingDatePrecisionValue(left)
  const rightPrecision = getUpcomingDatePrecisionValue(right)
  const precisionRank = {
    exact: 0,
    month_only: 1,
    unknown: 2,
  }
  if (precisionRank[leftPrecision] !== precisionRank[rightPrecision]) {
    return precisionRank[leftPrecision] - precisionRank[rightPrecision]
  }
  if (leftHasDate && rightHasDate) {
    const dateCompare = parseDateValue(left.scheduled_date) - parseDateValue(right.scheduled_date)
    if (dateCompare !== 0) {
      return dateCompare
    }
  } else if (leftHasDate !== rightHasDate) {
    return leftHasDate ? -1 : 1
  }

  const leftMonthKey = getUpcomingMonthKey(left)
  const rightMonthKey = getUpcomingMonthKey(right)
  if (leftMonthKey && rightMonthKey && leftMonthKey !== rightMonthKey) {
    return leftMonthKey.localeCompare(rightMonthKey)
  }

  const statusRank = {
    confirmed: 0,
    scheduled: 1,
    rumor: 2,
  }
  if (statusRank[left.date_status] !== statusRank[right.date_status]) {
    return statusRank[left.date_status] - statusRank[right.date_status]
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence
  }

  return left.headline.localeCompare(right.headline)
}

function compareReleaseChanges(left: ReleaseChangeLogRow, right: ReleaseChangeLogRow) {
  const leftValue = getSourceTimelineSortValue(left.occurred_at)
  const rightValue = getSourceTimelineSortValue(right.occurred_at)
  if (leftValue !== rightValue) {
    return rightValue - leftValue
  }

  return left.group.localeCompare(right.group)
}

function buildSourceTimeline(
  group: string,
  upcomingSignals: UpcomingCandidateRow[],
  groupReleases: VerifiedRelease[],
) {
  const timelineItems: SourceTimelineItem[] = []
  const usedSignalKeys = new Set<string>()
  const timelineSignals = [...upcomingSignals].sort(compareTimelineSignals)
  const firstSignal = timelineSignals[0]

  if (firstSignal) {
    timelineItems.push(buildUpcomingTimelineItem(group, firstSignal, 'first_signal'))
    usedSignalKeys.add(getSourceTimelineSignalKey(firstSignal))
  }

  const officialAnnouncement = timelineSignals.find(
    (item) => !usedSignalKeys.has(getSourceTimelineSignalKey(item)) && isOfficialAnnouncementSignal(item),
  )
  if (officialAnnouncement) {
    timelineItems.push(buildUpcomingTimelineItem(group, officialAnnouncement, 'official_announcement'))
    usedSignalKeys.add(getSourceTimelineSignalKey(officialAnnouncement))
  }

  const tracklistReveal = timelineSignals.find(
    (item) => !usedSignalKeys.has(getSourceTimelineSignalKey(item)) && isTracklistRevealSignal(item),
  )
  if (tracklistReveal) {
    timelineItems.push(buildUpcomingTimelineItem(group, tracklistReveal, 'tracklist_reveal'))
    usedSignalKeys.add(getSourceTimelineSignalKey(tracklistReveal))
  }

  const dateUpdate = findDateUpdateSignal(timelineSignals, usedSignalKeys)
  if (dateUpdate) {
    timelineItems.push(buildUpcomingTimelineItem(group, dateUpdate, 'date_update'))
    usedSignalKeys.add(getSourceTimelineSignalKey(dateUpdate))
  }

  const latestVerifiedRelease = groupReleases[0]
  if (latestVerifiedRelease?.source) {
    timelineItems.push(buildReleaseTimelineItem(group, latestVerifiedRelease))
  }

  return timelineItems
    .sort(compareSourceTimelineItems)
    .filter((item, index, items) => {
      const previous = items[index - 1]
      return !previous || getSourceTimelineItemKey(previous) !== getSourceTimelineItemKey(item)
    })
}

function buildUpcomingTimelineItem(
  group: string,
  item: UpcomingCandidateRow,
  eventType: SourceTimelineEventType,
): SourceTimelineItem {
  const occurredAt = getSignalOccurredAt(item)
  return {
    group,
    occurred_at: occurredAt,
    event_type: eventType,
    source_type: item.source_type || 'pending',
    headline: item.headline,
    source_url: item.source_url,
    summary: buildUpcomingTimelineSummary(item, eventType),
    source_domain: item.source_domain || getSourceDomain(item.source_url),
    sortValue: getSourceTimelineSortValue(occurredAt),
  }
}

function buildReleaseTimelineItem(group: string, release: VerifiedRelease): SourceTimelineItem {
  return {
    group,
    occurred_at: release.date,
    event_type: 'release_verified',
    source_type: 'release_catalog',
    headline: `${release.title}`,
    source_url: release.source,
    summary: truncateTimelineSummary(
      `Latest verified ${release.stream} record in the dataset for ${group}, captured from the release catalog.`,
    ),
    source_domain: getSourceDomain(release.source),
    sortValue: getSourceTimelineSortValue(release.date),
  }
}

function buildUpcomingTimelineSummary(
  item: UpcomingCandidateRow,
  eventType: SourceTimelineEventType,
) {
  if (eventType === 'date_update' && item.scheduled_date) {
    return truncateTimelineSummary(
      item.evidence_summary || `The strongest captured date signal currently points to ${item.scheduled_date}.`,
    )
  }

  if (eventType === 'official_announcement') {
    return truncateTimelineSummary(
      item.evidence_summary || 'An official channel or agency notice confirmed the comeback context.',
    )
  }

  if (eventType === 'tracklist_reveal') {
    return truncateTimelineSummary(
      item.evidence_summary || 'A tracklist or title-track clue was captured for this comeback cycle.',
    )
  }

  if (eventType === 'first_signal') {
    return truncateTimelineSummary(item.evidence_summary || 'This was the earliest captured comeback signal.')
  }

  return truncateTimelineSummary(item.evidence_summary)
}

function truncateTimelineSummary(value: string, maxLength = 180) {
  if (!value) {
    return ''
  }

  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function compareTimelineSignals(left: UpcomingCandidateRow, right: UpcomingCandidateRow) {
  const leftValue = getSourceTimelineSortValue(getSignalOccurredAt(left))
  const rightValue = getSourceTimelineSortValue(getSignalOccurredAt(right))
  if (leftValue !== rightValue) {
    return leftValue - rightValue
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence
  }

  return left.headline.localeCompare(right.headline)
}

function compareSourceTimelineItems(left: SourceTimelineItem, right: SourceTimelineItem) {
  if (left.sortValue !== right.sortValue) {
    return left.sortValue - right.sortValue
  }

  return left.headline.localeCompare(right.headline)
}

function getSignalOccurredAt(item: UpcomingCandidateRow) {
  if (item.published_at && !Number.isNaN(Date.parse(item.published_at))) {
    return new Date(Date.parse(item.published_at)).toISOString()
  }

  return item.scheduled_date
}

function getSourceTimelineSortValue(value: string) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER
  }

  const timestamp = Date.parse(value)
  if (!Number.isNaN(timestamp)) {
    return timestamp
  }

  if (isExactDate(value)) {
    return new Date(`${value}T00:00:00`).getTime()
  }

  return Number.MAX_SAFE_INTEGER
}

function getSourceTimelineSignalKey(item: UpcomingCandidateRow) {
  return [item.group, item.source_url, item.headline, item.published_at, item.scheduled_date, item.scheduled_month].join('::')
}

function getSourceTimelineItemKey(item: SourceTimelineItem) {
  return [item.event_type, item.headline, item.occurred_at, item.source_url].join('::')
}

function isOfficialAnnouncementSignal(item: UpcomingCandidateRow) {
  if (item.source_type === 'agency_notice' || item.source_type === 'weverse_notice') {
    return true
  }

  return item.search_term.startsWith('official_')
}

function isTracklistRevealSignal(item: UpcomingCandidateRow) {
  const text = `${item.headline} ${item.evidence_summary}`.toLowerCase()
  return /track\s*list|tracklist|title track/.test(text)
}

function findDateUpdateSignal(rows: UpcomingCandidateRow[], usedSignalKeys: Set<string>) {
  const datedRows = rows.filter((item) => hasExactUpcomingDate(item))
  if (!datedRows.length) {
    return null
  }

  for (let index = datedRows.length - 1; index >= 0; index -= 1) {
    const row = datedRows[index]
    if (usedSignalKeys.has(getSourceTimelineSignalKey(row))) {
      continue
    }

    const previousDate = datedRows[index - 1]?.scheduled_date ?? ''
    if (!previousDate || previousDate !== row.scheduled_date || index === 0) {
      return row
    }
  }

  return null
}

function groupReleasesByGroup(rows: VerifiedRelease[]) {
  return rows.reduce<Map<string, VerifiedRelease[]>>((map, row) => {
    const bucket = map.get(row.group) ?? []
    bucket.push(row)
    map.set(row.group, bucket)
    return map
  }, new Map())
}

function groupUpcomingCandidatesByGroup(rows: UpcomingCandidateRow[]) {
  return rows.reduce<Map<string, UpcomingCandidateRow[]>>((map, row) => {
    const bucket = map.get(row.group) ?? []
    bucket.push(row)
    map.set(row.group, bucket)
    return map
  }, new Map())
}

function groupReleaseChangeLogByGroup(rows: ReleaseChangeLogRow[]) {
  return rows.reduce<Map<string, ReleaseChangeLogRow[]>>((map, row) => {
    const bucket = map.get(row.group) ?? []
    bucket.push(row)
    bucket.sort(compareReleaseChanges)
    map.set(row.group, bucket)
    return map
  }, new Map())
}

function getTeamMonogram(group: string) {
  const cleaned = group.replace(/[^A-Za-z0-9 ]/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (!words.length) {
    return group.slice(0, 2).toUpperCase()
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return words
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function getTeamBadgeImageUrl(group: string) {
  return teamBadgeAssetByGroup.get(group)?.badge_image_url ?? null
}

function getTeamRepresentativeImageUrl(group: string) {
  return artistProfileByGroup.get(group)?.representative_image_url ?? null
}

function getTeamBadgeSourceUrl(group: string) {
  return teamBadgeAssetByGroup.get(group)?.badge_source_url ?? null
}

function getTeamBadgeSourceLabel(group: string) {
  return teamBadgeAssetByGroup.get(group)?.badge_source_label ?? null
}

function getPrimaryTeamYouTubeUrl(group: string) {
  return youtubeChannelAllowlistByGroup.get(group)?.primary_team_channel_url ?? null
}

function getTeamDisplayName(group: string) {
  return group
}

function getCompactTeamLabel(group: string) {
  if (group.length <= 12) {
    return group
  }

  const cleaned = group.replace(/[^A-Za-z0-9 ]/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const monogram = getTeamMonogram(group)
    if (monogram.length >= 2 && monogram.length <= 4) {
      return monogram
    }
  }

  return `${group.slice(0, 10).trim()}…`
}

function getTeamBadgeStyle(group: string) {
  const hue = getTeamHue(group)
  return {
    background: `linear-gradient(155deg, hsl(${hue} 72% 64%), hsl(${(hue + 38) % 360} 52% 28%))`,
  }
}

function getTeamHue(group: string) {
  return Array.from(group).reduce((total, char) => total + char.charCodeAt(0), 0) % 360
}

function describeUpcomingSignal(
  item: UpcomingCandidateRow,
  language: Language,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  return `${formatDateStatus(item.date_status, language)} · ${formatUpcomingTimingLabel(item, language, formatter, fallback)}`
}

function describeSearchEntityResult(
  item: SearchSurfaceEntityResult,
  language: Language,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  if (item.nextUpcoming) {
    return `${formatDateStatus(item.nextUpcoming.dateStatus, language)} · ${formatUpcomingTimingLabel(
      {
        scheduled_date: item.nextUpcoming.scheduledDate,
        scheduled_month: item.nextUpcoming.scheduledMonth,
        date_precision: item.nextUpcoming.datePrecision,
      },
      language,
      formatter,
      fallback,
    )}`
  }

  if (item.latestRelease) {
    return `${item.latestRelease.title} · ${formatOptionalDate(item.latestRelease.date, formatter, fallback)}`
  }

  return fallback
}

function describeSearchReleaseResult(item: SearchSurfaceReleaseResult, language: Language) {
  const releaseFormat = formatReleaseFormat(item.releaseFormat, language)
  return releaseFormat || item.releaseKind || item.stream
}

function parseDateValue(value?: string) {
  if (!value || !isExactDate(value)) {
    return -1
  }
  return new Date(`${value}T00:00:00`).getTime()
}

function getDateDaysBefore(referenceDate: Date, days: number) {
  const nextDate = new Date(referenceDate)
  nextDate.setDate(nextDate.getDate() - days)
  return nextDate
}

function getCountdownDays(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const targetDate = new Date(year, month - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function getElapsedDaysSinceDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const targetDate = new Date(year, month - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000)))
}

function getAlbumKey(item: VerifiedRelease) {
  return `${item.group}-${item.stream}-${item.title}-${item.date}`
}

function getUpcomingDashboardRowKey(item: UpcomingCandidateRow) {
  return item.event_key ?? [item.group, item.scheduled_date || item.scheduled_month || 'undated', item.headline].join('::')
}

function getReleaseDetailActionLabel(releaseKind: ReleaseFact['release_kind'], language: Language) {
  const teamCopy = TEAM_COPY[language]
  return releaseKind === 'single' ? teamCopy.releaseDetail : teamCopy.albumDetail
}

function readSelectedGroupFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  return getGroupFromPath(window.location.pathname)
}

function readSelectedEntitySlugFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  return getEntitySlugFromPath(window.location.pathname)
}

function readSelectedCompareGroupFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  const primaryEntitySlug = getEntitySlugFromPath(window.location.pathname)
  if (!primaryEntitySlug) {
    return null
  }

  const compareValue = new URLSearchParams(window.location.search).get('compare')
  if (!compareValue) {
    return null
  }

  const compareEntitySlug = decodeURIComponent(compareValue).trim().toLowerCase()
  if (!compareEntitySlug || compareEntitySlug === primaryEntitySlug) {
    return null
  }

  return compareEntitySlug
}

function readSelectedReleaseKeyFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  return getReleaseRouteFromPath(window.location.pathname, window.location.search)?.releaseKey ?? null
}

function readSelectedReleaseRouteSelectionFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  return getReleaseRouteSelectionFromPath(window.location.pathname, window.location.search)
}

function readBackendTargetInspectionFromLocation() {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search).get('inspect') === 'backend-target'
}

function appendPersistentInspectParams(params: URLSearchParams) {
  if (typeof window === 'undefined') {
    return params
  }

  const currentParams = new URLSearchParams(window.location.search)
  if (currentParams.get('inspect') === 'backend-target') {
    params.set('inspect', 'backend-target')
  }

  return params
}

function getEntitySlugFromPath(pathname: string) {
  const match = pathname.match(/^\/artists\/([^/]+)(?:\/releases\/[^/]+)?\/?$/)
  if (!match) {
    return null
  }

  return decodeURIComponent(match[1]).trim().toLowerCase()
}

function getGroupFromPath(pathname: string) {
  const slug = getEntitySlugFromPath(pathname)
  if (!slug) {
    return null
  }

  return resolveGroupReference(slug)
}

function resolveGroupReference(value: string) {
  const normalized = decodeURIComponent(value).trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return humanizeRouteSlug(normalized)
}

function getHomePath() {
  const params = appendPersistentInspectParams(new URLSearchParams())
  const query = params.toString()
  return query ? `/?${query}` : '/'
}

function getArtistPathBySlug(entitySlug: string, compareGroup?: string | null) {
  const pathname = `/artists/${entitySlug}`
  const params = appendPersistentInspectParams(new URLSearchParams())
  if (compareGroup && compareGroup !== entitySlug) {
    params.set('compare', compareGroup)
  }
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function getArtistPath(group: string, compareGroup?: string | null) {
  const pathname = `/artists/${slugifyGroup(group)}`
  const params = appendPersistentInspectParams(new URLSearchParams())
  const primaryEntitySlug = slugifyGroup(group)
  if (compareGroup && compareGroup !== primaryEntitySlug) {
    params.set('compare', compareGroup)
  }
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function getReleaseRouteFromPath(pathname: string, search = '') {
  const match = pathname.match(/^\/artists\/([^/]+)\/releases\/([^/]+)\/?$/)
  if (!match) {
    return null
  }

  const group = getGroupFromPath(pathname)
  if (!group) {
    return null
  }

  const releaseSlug = decodeURIComponent(match[2]).trim().toLowerCase()
  const params = new URLSearchParams(search)
  const releaseDate = params.get('date')
  const releaseStream = params.get('stream')

  const release =
    (verifiedReleaseHistoryByGroup.get(group) ?? []).find((item) => {
      if (releaseSlug !== 'release' && slugifyPathSegment(item.title) !== releaseSlug) {
        return false
      }

      if (releaseDate && item.date !== releaseDate) {
        return false
      }

      if (releaseStream && item.stream !== releaseStream) {
        return false
      }

      return true
    }) ?? null

  if (!release) {
    return null
  }

  return {
    group,
    releaseKey: getAlbumKey(release),
  }
}

function getReleaseRouteSelectionFromPath(pathname: string, search = ''): ReleaseRouteSelection | null {
  const match = pathname.match(/^\/artists\/([^/]+)\/releases\/([^/]+)\/?$/)
  if (!match) {
    return null
  }

  const entitySlug = decodeURIComponent(match[1]).trim().toLowerCase()
  const releaseSlug = decodeURIComponent(match[2]).trim().toLowerCase()
  const params = new URLSearchParams(search)
  const releaseDate = params.get('date')
  const releaseStream = params.get('stream')
  const normalizedStream = releaseStream === 'album' || releaseStream === 'song' ? releaseStream : null

  return {
    entitySlug,
    releaseSlug,
    releaseDate,
    releaseStream: normalizedStream,
    releaseId: looksLikeUuid(releaseSlug) ? releaseSlug : null,
  }
}

function getReleasePath(release: VerifiedRelease, entitySlugOverride?: string | null) {
  const releaseSlug = release.release_id ?? (slugifyPathSegment(release.title) || 'release')
  const entitySlug = entitySlugOverride ?? slugifyGroup(release.group)
  const pathname = `/artists/${entitySlug}/releases/${releaseSlug}`
  const params = appendPersistentInspectParams(new URLSearchParams())
  params.set('date', release.date)
  params.set('stream', release.stream)
  return `${pathname}?${params.toString()}`
}

function normalizeBackendTargetEnvironment(value: unknown): BackendTargetEnvironment {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (
    normalized === 'production' ||
    normalized === 'preview' ||
    normalized === 'local' ||
    normalized === 'bridge' ||
    normalized === 'unknown'
  ) {
    return normalized
  }

  return BACKEND_API_BASE_URL ? classifyBackendTarget(BACKEND_API_BASE_URL) : 'bridge'
}

function classifyBackendTarget(apiBaseUrl: string): BackendTargetEnvironment {
  if (!apiBaseUrl) {
    return 'bridge'
  }

  try {
    const hostname = new URL(apiBaseUrl).hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('127.')
    ) {
      return 'local'
    }

    if (
      hostname.includes('preview') ||
      hostname.includes('staging') ||
      hostname.includes('dev') ||
      hostname.includes('test')
    ) {
      return 'preview'
    }

    return 'production'
  } catch {
    return 'unknown'
  }
}

function createSearchNeedle(value: string): SearchNeedle | null {
  const normalized = normalizeSearchText(value)
  if (!normalized) {
    return null
  }

  return {
    normalized,
    compact: collapseSearchText(normalized),
  }
}

function buildSearchIndex(values: Array<string | null | undefined>): SearchIndex {
  const normalizedTerms = new Set<string>()
  const compactTerms = new Set<string>()

  values.forEach((value) => {
    if (!value) {
      return
    }

    const normalized = normalizeSearchText(value)
    if (!normalized) {
      return
    }

    normalizedTerms.add(normalized)
    compactTerms.add(collapseSearchText(normalized))
  })

  return {
    normalizedTerms: Array.from(normalizedTerms),
    compactTerms: Array.from(compactTerms),
  }
}

function matchesSearchValues(values: Array<string | null | undefined>, needle: SearchNeedle | null) {
  return matchesSearchIndex(buildSearchIndex(values), needle)
}

function matchesSearchIndex(index: SearchIndex | undefined, needle: SearchNeedle | null) {
  if (!needle) {
    return true
  }

  if (!index) {
    return false
  }

  return (
    index.normalizedTerms.some((term) => term.includes(needle.normalized)) ||
    index.compactTerms.some((term) => term.includes(needle.compact))
  )
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[×✕]/g, 'x')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collapseSearchText(value: string) {
  return value.replace(/\s+/g, '')
}

function slugifyPathSegment(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[×✕]/g, 'x')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugifyGroup(group: string) {
  return group
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getActType(group: string): ActType {
  return unitGroups.has(group) ? 'unit' : 'group'
}

function getMonthKeys(rows: Array<{ dateValue: Date }>) {
  return Array.from(
    new Set(
      rows.map((item) => {
        return getMonthKey(item.dateValue)
      }),
    ),
  ).sort()
}

function getLatestMonthKey(rows: VerifiedRelease[]) {
  return getMonthKeys(rows).at(-1) ?? getMonthKey(new Date())
}

function getVisibleMonthKeys(
  releaseRows: VerifiedRelease[],
  upcomingRows: DatedUpcomingSignal[],
  extraMonthKeys: string[] = [],
) {
  return Array.from(new Set([...getMonthKeys([...releaseRows, ...upcomingRows]), ...extraMonthKeys])).sort()
}

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'ko'
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'ko' || stored === 'en') {
    return stored
  }

  return 'ko'
}

function sanitizeStoredMyTeams(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const savedGroups: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    savedGroups.push(normalized)
    seen.add(normalized)

    if (savedGroups.length >= MY_TEAMS_LIMIT) {
      break
    }
  }

  return savedGroups
}

function readInitialMyTeams() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = window.localStorage.getItem(MY_TEAMS_STORAGE_KEY)
    if (!stored) {
      return []
    }

    return sanitizeStoredMyTeams(JSON.parse(stored))
  } catch {
    return []
  }
}

function matchesMyTeamsFilter(group: string, myTeamsSet: Set<string>, selectedMyTeamsOnly: boolean) {
  if (!selectedMyTeamsOnly || myTeamsSet.size === 0) {
    return true
  }

  return myTeamsSet.has(group)
}

function matchesReleaseFilters(
  item: VerifiedRelease,
  {
    searchNeedle,
    selectedReleaseKind,
    selectedActType,
    selectedDashboardStatus,
    selectedAgency,
    myTeamsSet,
    selectedMyTeamsOnly,
  }: {
    searchNeedle: SearchNeedle | null
    selectedReleaseKind: (typeof releaseKindOptions)[number]
    selectedActType: (typeof actTypeOptions)[number]
    selectedDashboardStatus: (typeof dashboardStatusOptions)[number]
    selectedAgency: string
    myTeamsSet: Set<string>
    selectedMyTeamsOnly: boolean
  },
) {
  const matchesSearch =
    matchesSearchValues([item.group, item.displayName, item.entitySlug, item.title], searchNeedle)
  const matchesReleaseKind = selectedReleaseKind === 'all' || item.release_kind === selectedReleaseKind
  const matchesActType = selectedActType === 'all' || item.actType === selectedActType
  const matchesStatus = selectedDashboardStatus === 'all' || selectedDashboardStatus === 'verified'
  const matchesAgency =
    item.agencyName !== undefined
      ? getAgencyFilterValue(normalizeAgencyName(item.agencyName)) === selectedAgency || selectedAgency === 'all'
      : selectedAgency === 'all' || selectedAgency === AGENCY_UNKNOWN_FILTER
  const matchesMyTeams = matchesMyTeamsFilter(item.group, myTeamsSet, selectedMyTeamsOnly)
  return matchesSearch && matchesReleaseKind && matchesActType && matchesStatus && matchesAgency && matchesMyTeams
}

function matchesUpcomingFilters(
  item: UpcomingCandidateRow,
  {
    searchNeedle,
    selectedReleaseKind,
    selectedActType,
    selectedDashboardStatus,
    selectedAgency,
    myTeamsSet,
    selectedMyTeamsOnly,
  }: {
    searchNeedle: SearchNeedle | null
    selectedReleaseKind: (typeof releaseKindOptions)[number]
    selectedActType: (typeof actTypeOptions)[number]
    selectedDashboardStatus: (typeof dashboardStatusOptions)[number]
    selectedAgency: string
    myTeamsSet: Set<string>
    selectedMyTeamsOnly: boolean
  },
) {
  const matchesSearch =
    matchesSearchValues([item.group, item.displayName, item.entitySlug, item.headline], searchNeedle)
  const matchesReleaseKind = selectedReleaseKind === 'all' || item.release_format === selectedReleaseKind
  const matchesActType = selectedActType === 'all' || (item.actType ?? getActType(item.group)) === selectedActType
  const matchesStatus =
    selectedDashboardStatus === 'all'
      ? true
      : selectedDashboardStatus === 'verified'
        ? false
        : item.date_status === selectedDashboardStatus
  const matchesAgency =
    item.agencyName !== undefined
      ? getAgencyFilterValue(normalizeAgencyName(item.agencyName)) === selectedAgency || selectedAgency === 'all'
      : selectedAgency === 'all' || selectedAgency === AGENCY_UNKNOWN_FILTER
  const matchesMyTeams = matchesMyTeamsFilter(item.group, myTeamsSet, selectedMyTeamsOnly)
  return matchesSearch && matchesReleaseKind && matchesActType && matchesStatus && matchesAgency && matchesMyTeams
}

function filterCalendarMonthApiSnapshot(
  snapshot: CalendarMonthApiSnapshot,
  filters: {
    searchNeedle: SearchNeedle | null
    selectedReleaseKind: (typeof releaseKindOptions)[number]
    selectedActType: (typeof actTypeOptions)[number]
    selectedDashboardStatus: (typeof dashboardStatusOptions)[number]
    selectedAgency: string
    myTeamsSet: Set<string>
    selectedMyTeamsOnly: boolean
  },
): CalendarMonthApiSnapshot {
  return {
    verifiedRows: snapshot.verifiedRows.filter((item) => matchesReleaseFilters(item, filters)),
    scheduledRows: snapshot.scheduledRows.filter((item) => matchesUpcomingFilters(item, filters)),
    monthOnlyRows: snapshot.monthOnlyRows.filter((item) => matchesUpcomingFilters(item, filters)),
  }
}

function matchesRadarEntryFilters(
  entry: {
    group: string
    entitySlug?: string
    agencyName?: string | null
    latestRelease?: TeamLatestRelease | null
    latestSignal?: UpcomingCandidateRow | null
  },
  {
    searchNeedle,
    selectedAgency,
    myTeamsSet,
    selectedMyTeamsOnly,
  }: {
    searchNeedle: SearchNeedle | null
    selectedAgency: string
    myTeamsSet: Set<string>
    selectedMyTeamsOnly: boolean
  },
) {
  return (
    matchesSearchValues([entry.group, entry.entitySlug, entry.latestRelease?.title, entry.latestSignal?.headline], searchNeedle) &&
    (selectedAgency === 'all' ||
      (entry.agencyName !== undefined
        ? getAgencyFilterValue(normalizeAgencyName(entry.agencyName)) === selectedAgency
        : selectedAgency === AGENCY_UNKNOWN_FILTER)) &&
    matchesMyTeamsFilter(entry.group, myTeamsSet, selectedMyTeamsOnly)
  )
}

function filterRadarApiSnapshot(
  snapshot: RadarApiSnapshot,
  filters: {
    searchNeedle: SearchNeedle | null
    selectedAgency: string
    myTeamsSet: Set<string>
    selectedMyTeamsOnly: boolean
  },
): RadarApiSnapshot {
  return {
    longGapEntries: snapshot.longGapEntries.filter((item) => matchesRadarEntryFilters(item, filters)),
    rookieEntries: snapshot.rookieEntries.filter((item) => matchesRadarEntryFilters(item, filters)),
  }
}

function formatMyTeamsCount(count: number, limit: number, language: Language) {
  return language === 'ko' ? `${count}/${limit} 저장` : `${count}/${limit} saved`
}

function isExactDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value)
}

function getUpcomingDatePrecisionValue(item: Pick<UpcomingSignalBase, 'date_precision' | 'scheduled_date' | 'scheduled_month'>) {
  if (item.date_precision === 'exact' || item.date_precision === 'month_only' || item.date_precision === 'unknown') {
    return item.date_precision
  }

  if (isExactDate(item.scheduled_date)) {
    return 'exact'
  }

  if (isMonthKey(item.scheduled_month)) {
    return 'month_only'
  }

  return 'unknown'
}

function shouldDisplayUpcomingCandidate(
  item: Pick<UpcomingSignalBase, 'date_precision' | 'scheduled_date' | 'scheduled_month'>,
  todayIsoDate: string,
) {
  return !(getUpcomingDatePrecisionValue(item) === 'exact' && isExactDate(item.scheduled_date) && item.scheduled_date < todayIsoDate)
}

void [
  expandReleaseRow,
  matchesAgencyFilter,
  buildSeededVerifiedReleaseHistory,
  buildVerifiedReleaseHistory,
  buildTeamProfiles,
  buildRelatedActsByGroup,
  buildTeamCompareSnapshot,
  buildSearchIndexByGroup,
  dedupeUpcomingCandidatesForDisplay,
  groupReleasesByGroup,
  groupUpcomingCandidatesByGroup,
  groupReleaseChangeLogByGroup,
  getLatestMonthKey,
  getVisibleMonthKeys,
  shouldDisplayUpcomingCandidate,
]

function hasExactUpcomingDate(item: Pick<UpcomingSignalBase, 'date_precision' | 'scheduled_date' | 'scheduled_month'>) {
  return getUpcomingDatePrecisionValue(item) === 'exact' && isExactDate(item.scheduled_date)
}

function formatDisplayDate(isoDate: string, formatter: Intl.DateTimeFormat) {
  if (!isExactDate(isoDate)) {
    return isoDate
  }

  return formatter.format(new Date(`${isoDate}T00:00:00`))
}

function formatSourceTimelineDate(
  value: string,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  if (!value) {
    return fallback
  }

  const timestamp = Date.parse(value)
  if (!Number.isNaN(timestamp)) {
    return formatter.format(new Date(timestamp))
  }

  if (isExactDate(value)) {
    return formatter.format(new Date(`${value}T00:00:00`))
  }

  return value
}

function formatOptionalDate(
  isoDate: string,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  if (!isoDate) {
    return fallback
  }

  return formatDisplayDate(isoDate, formatter)
}

function formatUpcomingTimingLabel(
  item: Pick<UpcomingSignalBase, 'scheduled_date' | 'scheduled_month' | 'date_precision'>,
  language: Language,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  if (hasExactUpcomingDate(item)) {
    return formatDisplayDate(item.scheduled_date, formatter)
  }

  if (getUpcomingDatePrecisionValue(item) === 'month_only' && isMonthKey(item.scheduled_month)) {
    return UPCOMING_MONTH_FORMATTERS[language].format(monthKeyToDate(item.scheduled_month))
  }

  return fallback
}

function formatScheduledDashboardTimingLabel(
  item: Pick<UpcomingSignalBase, 'scheduled_date' | 'scheduled_month' | 'date_precision'>,
  language: Language,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  const copy = TRANSLATIONS[language]
  const timingLabel = formatUpcomingTimingLabel(item, language, formatter, fallback)
  if (getUpcomingDatePrecisionValue(item) !== 'month_only') {
    return timingLabel
  }

  return timingLabel === fallback ? copy.monthlyDashboardDatePending : `${timingLabel} · ${copy.monthlyDashboardDatePending}`
}

function getMonthKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

function pickClosestIsoDate(isoDates: string[], referenceIso: string) {
  if (!isoDates.length || !isExactDate(referenceIso)) {
    return ''
  }

  const referenceValue = parseDateValue(referenceIso)
  return [...isoDates].sort((left, right) => {
    const distanceCompare = Math.abs(parseDateValue(left) - referenceValue) - Math.abs(parseDateValue(right) - referenceValue)
    if (distanceCompare !== 0) {
      return distanceCompare
    }

    return parseDateValue(left) - parseDateValue(right)
  })[0]
}

function getSourceDomain(sourceUrl: string) {
  if (!sourceUrl) {
    return ''
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function monthKeyToDate(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function buildCalendarDays(date: Date): CalendarDay[] {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const leadingDays = startOfMonth.getDay()
  const trailingDays = 6 - endOfMonth.getDay()
  const gridStart = new Date(startOfMonth)
  const gridEnd = new Date(endOfMonth)
  gridStart.setDate(startOfMonth.getDate() - leadingDays)
  gridEnd.setDate(endOfMonth.getDate() + trailingDays)

  const days: CalendarDay[] = []
  const cursor = new Date(gridStart)

  while (cursor <= gridEnd) {
    days.push({
      date: new Date(cursor),
      iso: dateFormatter.format(cursor),
      inMonth: cursor.getMonth() === date.getMonth(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function groupByDate(rows: VerifiedRelease[]) {
  return rows.reduce<Map<string, VerifiedRelease[]>>((map, row) => {
    const bucket = map.get(row.isoDate) ?? []
    bucket.push(row)
    map.set(row.isoDate, bucket)
    return map
  }, new Map())
}

function groupUpcomingByDate(rows: DatedUpcomingSignal[]) {
  return rows.reduce<Map<string, DatedUpcomingSignal[]>>((map, row) => {
    const bucket = map.get(row.isoDate) ?? []
    bucket.push(row)
    map.set(row.isoDate, bucket)
    return map
  }, new Map())
}

export default App
