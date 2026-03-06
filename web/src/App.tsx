import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import './App.css'
import artistProfileRows from './data/artistProfiles.json'
import releaseArtworkRows from './data/releaseArtwork.json'
import releaseDetailRows from './data/releaseDetails.json'
import releaseEnrichmentRows from './data/releaseEnrichment.json'
import releaseRows from './data/releases.json'
import unresolvedRows from './data/unresolved.json'
import upcomingCandidateRows from './data/upcomingCandidates.json'
import releaseChangeLogRows from './data/releaseChangeLog.json'
import relatedActOverrideRows from './data/relatedActsOverrides.json'
import watchlistRows from './data/watchlist.json'

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

type ReleaseDetailTrack = {
  order: number
  title: string
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

type ActType = 'group' | 'solo' | 'unit'

type VerifiedRelease = ReleaseFact & {
  group: string
  artist_name_mb: string
  artist_mbid: string
  artist_source: string
  actType: ActType
  stream: 'song' | 'album'
  dateValue: Date
  isoDate: string
}

type UnresolvedRow = {
  group: string
  reason: string
  artist_mbid?: string
}

type UpcomingSignalBase = {
  group: string
  scheduled_date: string
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
      kind: 'radar_tag'
      radarTag: RelatedRadarTag
    }
  | {
      kind: 'manual_override'
    }

type RelatedActRecommendation = {
  group: string
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

type MusicService = 'spotify' | 'youtube_music'
type ServiceActionId = MusicService | 'youtube_mv'

type ReleaseFormat = 'single' | 'album' | 'ep'

type ContextTag =
  | 'pre_release'
  | 'title_track'
  | 'ost'
  | 'collab'
  | 'japanese_release'
  | 'special_project'

type SourceBadgeType = 'agency_notice' | 'weverse_notice' | 'news_rss' | 'database' | 'pending'

type MusicHandoffMode = 'canonical' | 'search'

type MusicHandoffUrls = Partial<Record<MusicService, string>>

type MusicHandoffLink = {
  service: ServiceActionId
  href: string
  mode: MusicHandoffMode
}

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
  youtubeUrl: string
  hasOfficialYouTubeUrl: boolean
  agency: string
  representativeImageUrl: string | null
  representativeImageSource: string | null
  latestRelease: TeamLatestRelease | null
  recentAlbums: VerifiedRelease[]
  upcomingSignals: UpcomingCandidateRow[]
  sourceTimeline: SourceTimelineItem[]
  annualReleaseTimeline: AnnualReleaseTimelineSection[]
  changeLog: ReleaseChangeLogRow[]
  nextUpcomingSignal: UpcomingCandidateRow | null
}

type LongGapRadarEntry = {
  group: string
  watchReason: WatchReason
  latestRelease: TeamLatestRelease
  gapDays: number
  hasUpcomingSignal: boolean
  latestSignal: UpcomingCandidateRow | null
}

type RookieRadarEntry = {
  group: string
  debutYear: number | null
  latestRelease: TeamLatestRelease | null
  hasUpcomingSignal: boolean
  latestSignal: UpcomingCandidateRow | null
}

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
    monthlyNearestEmpty: '일정 없음',
    monthlyHighlightLabel: '가장 가까운 일정',
    monthlyHighlightEmpty: '현재 월과 필터 기준으로 표시할 예정 컴백이 없습니다.',
    stats: {
      verifiedReleases: '검증된 발매',
      watchTargets: '추적 대상',
      upcomingSignals: '예정 신호',
      needsReview: '검토 필요',
    },
    monthlyGrid: '월간 캘린더',
    prev: '이전',
    next: '다음',
    searchLabel: '그룹, 곡, 앨범 검색',
    searchPlaceholder: 'BLACKPINK, Hearts2Hearts, DEADLINE, RUDE!...',
    monthSummaryVerified: '검증됨',
    monthSummaryScheduled: '예정',
    filterLabels: {
      releaseKind: '발매 종류',
      actType: '액트 유형',
      status: '표시 상태',
      agency: '소속사',
    },
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
    monthlyDashboardVerifiedTitle: 'Verified releases',
    monthlyDashboardScheduledTitle: 'Scheduled comebacks',
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
    handoffHint: '앱 안에서 직접 재생하지 않고 새 탭으로 외부 서비스로 이동합니다.',
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
    monthlyNearestEmpty: 'No schedule',
    monthlyHighlightLabel: 'Closest schedule',
    monthlyHighlightEmpty: 'No scheduled comebacks match this month and filter state.',
    stats: {
      verifiedReleases: 'Verified releases',
      watchTargets: 'Watch targets',
      upcomingSignals: 'Upcoming signals',
      needsReview: 'Needs review',
    },
    monthlyGrid: 'Monthly grid',
    prev: 'Prev',
    next: 'Next',
    searchLabel: 'Search group, song, or album',
    searchPlaceholder: 'BLACKPINK, Hearts2Hearts, DEADLINE, RUDE!...',
    monthSummaryVerified: 'verified',
    monthSummaryScheduled: 'scheduled',
    filterLabels: {
      releaseKind: 'Release kind',
      actType: 'Act type',
      status: 'Status',
      agency: 'Agency',
    },
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
    monthlyDashboardVerifiedTitle: 'Verified releases',
    monthlyDashboardScheduledTitle: 'Scheduled comebacks',
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
    handoffHint: 'Opens in a new tab without in-app playback.',
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
  },
} as const

const TEAM_COPY = {
  ko: {
    action: '팀 페이지',
    back: '대시보드로',
    panelLabel: '팀 페이지',
    intro:
      '해당 팀의 컴백 신호를 먼저 보고, 최신 발매와 앨범 상세를 같은 화면에서 바로 확인할 수 있습니다.',
    agencyHint: '소속 힌트',
    latestReleaseDate: '최근 발매일',
    comebackStatus: '컴백 상태',
    tier: '티어',
    representativeImage: '대표 이미지',
    generatedMark: '생성된 팀 마크',
    youtubeSearch: '유튜브 검색',
    footnote:
      '상단 이미지는 팀명 기반으로 생성한 마크이며, YouTube는 검증된 채널 URL이 없을 때 검색 결과로 연결됩니다.',
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
    recentAlbumsTitle: '앨범 카드는 페이지 안에서 상세를 엽니다.',
    recentAlbumsEmptyTitle: '앨범 카드 없음',
    recentAlbumsEmpty: '검증된 앨범 또는 EP가 아직 없습니다.',
    openAlbumDetail: '앨범 상세 열기',
    releaseDetail: '릴리즈 상세',
    quickJumpLabel: '빠른 이동',
    quickJumpTitle: '다른 추적 팀',
    noOtherTeams: '다른 필터된 팀이 없습니다.',
    noSignal: '신호 없음',
    relatedActsLabel: '관련 팀 추천',
    relatedActsTitle: '비슷한 결로 바로 이동',
    relatedActsEmpty: '추천할 관련 팀 데이터가 아직 충분하지 않습니다.',
    relatedActsReasonAgency: '같은 소속사',
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
    trackPreview: '트랙 프리뷰',
    trackPreviewHint: '시드 데이터가 있으면 실제 트랙을, 없으면 placeholder 프리뷰를 표시합니다.',
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
    officialMvLinkOnly: '임베드가 준비되지 않은 경우 YouTube 링크만 노출합니다.',
    watchOnYouTube: 'YouTube에서 보기',
    placeholderCover: '릴리즈 아트워크',
    drawerCopy:
      '앨범 상세는 팀 페이지 안 슬라이드오버로 유지해서 컴백 맥락을 잃지 않고 바로 돌아올 수 있습니다.',
    appleMusicNext: 'Apple Music 다음 이슈',
    spotifyNext: 'Spotify 다음 이슈',
    latestNow: '현재 가장 최근 검증 발매',
  },
  en: {
    action: 'Team page',
    back: 'Back to dashboard',
    panelLabel: 'Team page',
    intro:
      'See comeback signals first, then move into the latest release and album detail without leaving the same view.',
    agencyHint: 'Agency hint',
    latestReleaseDate: 'Latest release date',
    comebackStatus: 'Comeback status',
    tier: 'Tier',
    representativeImage: 'Representative image',
    generatedMark: 'Generated team mark',
    youtubeSearch: 'YouTube search',
    footnote:
      'The hero image is a generated team mark, and YouTube falls back to search until a verified channel URL is added.',
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
    recentAlbumsTitle: 'Album cards open detail inside the page.',
    recentAlbumsEmptyTitle: 'No album card yet',
    recentAlbumsEmpty: 'No verified album or EP is available for this team yet.',
    openAlbumDetail: 'Open album detail',
    releaseDetail: 'Release detail',
    quickJumpLabel: 'Quick jump',
    quickJumpTitle: 'Other tracked teams',
    noOtherTeams: 'No other filtered teams available.',
    noSignal: 'No signal',
    relatedActsLabel: 'Related acts',
    relatedActsTitle: 'Jump into adjacent acts',
    relatedActsEmpty: 'There is not enough related-act data to recommend another team yet.',
    relatedActsReasonAgency: 'Same agency',
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
    trackPreview: 'Track preview',
    trackPreviewHint: 'Uses seeded track data when available and falls back to placeholder preview rows otherwise.',
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
    officialMvLinkOnly: 'If embedding is unavailable, the drawer falls back to a YouTube link only.',
    watchOnYouTube: 'Watch on YouTube',
    placeholderCover: 'Release artwork',
    drawerCopy:
      'Album detail stays inside the team page so users can inspect the release and return to comeback context immediately.',
    appleMusicNext: 'Apple Music next',
    spotifyNext: 'Spotify next',
    latestNow: 'Latest verified release right now',
  },
} as const

const releaseKindOptions = ['all', 'single', 'album', 'ep'] as const
const actTypeOptions = ['all', 'group', 'solo', 'unit'] as const
const dashboardStatusOptions = ['all', 'verified', 'confirmed', 'scheduled', 'rumor'] as const
const unitGroups = new Set(['ARTMS', 'NCT DREAM', 'NCT WISH', 'VIVIZ'])
const MUSIC_HANDOFF_SERVICES: MusicService[] = ['spotify', 'youtube_music']
const RELEASE_ARTWORK_PLACEHOLDER_URL = '/release-placeholder.svg'
const LONG_GAP_THRESHOLD_DAYS = 365
const ROOKIE_RECENT_YEAR_WINDOW = 2
const AGENCY_UNKNOWN_FILTER = 'agency_unknown'

const artistProfiles = artistProfileRows as ArtistProfileRow[]
const releaseArtworkCatalog = releaseArtworkRows as ReleaseArtworkRow[]
const releaseDetailsCatalog = releaseDetailRows as ReleaseDetailRow[]
const releaseEnrichmentCatalog = releaseEnrichmentRows as ReleaseEnrichmentRow[]
const releaseCatalog = releaseRows as ReleaseRow[]
const relatedActOverrides = relatedActOverrideRows as RelatedActsOverrideRow[]
const releases = releaseCatalog
  .flatMap((row) => expandReleaseRow(row))
  .sort((left, right) => right.dateValue.getTime() - left.dateValue.getTime())

const unresolved = unresolvedRows as UnresolvedRow[]
const watchlist = watchlistRows as WatchlistRow[]
const upcomingCandidates = upcomingCandidateRows as UpcomingCandidateRow[]
const releaseChangeLog = releaseChangeLogRows as ReleaseChangeLogRow[]

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const releaseCatalogByGroup = new Map(releaseCatalog.map((row) => [row.group, row]))
const artistProfileByGroup = new Map(artistProfiles.map((row) => [row.group, row]))
const artistProfileBySlug = new Map(artistProfiles.map((row) => [row.slug, row]))
const releaseArtworkByKey = new Map(
  releaseArtworkCatalog.map((row) => [getReleaseLookupKey(row.group, row.release_title, row.release_date, row.stream), row]),
)
const releaseDetailsByKey = new Map(
  releaseDetailsCatalog.map((row) => [getReleaseLookupKey(row.group, row.release_title, row.release_date, row.stream), row]),
)
const releaseEnrichmentByKey = new Map(
  releaseEnrichmentCatalog.map((row) => [
    getReleaseLookupKey(row.group, row.release_title, row.release_date, row.stream),
    row,
  ]),
)
const releaseGroups = groupReleasesByGroup(releases)
const verifiedReleaseHistory = buildVerifiedReleaseHistory()
const verifiedReleaseHistoryByGroup = groupReleasesByGroup(verifiedReleaseHistory)
const watchlistByGroup = new Map(watchlist.map((row) => [row.group, row]))
const relatedActOverrideMap = new Map(relatedActOverrides.map((row) => [row.group, row.related_groups]))
const dedupedUpcomingCandidates = dedupeUpcomingCandidatesForDisplay(upcomingCandidates)
const rawUpcomingByGroup = groupUpcomingCandidatesByGroup(upcomingCandidates)
const upcomingByGroup = groupUpcomingCandidatesByGroup(dedupedUpcomingCandidates)
const releaseChangeLogByGroup = groupReleaseChangeLogByGroup(releaseChangeLog)
const latestReleaseChangeByGroup = new Map(
  Array.from(releaseChangeLogByGroup, ([group, changes]) => [group, changes[0] ?? null]),
)
const searchIndexByGroup = buildSearchIndexByGroup()
const teamProfiles = buildTeamProfiles()
const teamProfileMap = new Map(teamProfiles.map((team) => [team.group, team]))
const relatedActsByGroup = buildRelatedActsByGroup()
const agencyFilterOptions = ['all', ...buildAgencyFilterOptions()]
const longGapRadarEntries = buildLongGapRadarEntries()
const rookieRadarEntries = buildRookieRadarEntries()

function App() {
  const latestMonthKey = getLatestMonthKey(releases)
  const [selectedMonthKey, setSelectedMonthKey] = useState(latestMonthKey)
  const [selectedDayIso, setSelectedDayIso] = useState('')
  const [search, setSearch] = useState('')
  const [selectedReleaseKind, setSelectedReleaseKind] = useState<(typeof releaseKindOptions)[number]>('all')
  const [selectedActType, setSelectedActType] = useState<(typeof actTypeOptions)[number]>('all')
  const [selectedDashboardStatus, setSelectedDashboardStatus] = useState<(typeof dashboardStatusOptions)[number]>('all')
  const [selectedAgency, setSelectedAgency] = useState<string>('all')
  const [language, setLanguage] = useState<Language>(readInitialLanguage)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(readSelectedGroupFromLocation)
  const [selectedCompareGroup, setSelectedCompareGroup] = useState<string | null>(readSelectedCompareGroupFromLocation)
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null)
  const [selectedDayInteractionTick, setSelectedDayInteractionTick] = useState(0)
  const [desktopUpcomingPanelHeight, setDesktopUpcomingPanelHeight] = useState<number | null>(null)
  const calendarPanelRef = useRef<HTMLElement | null>(null)
  const selectedDayPanelRef = useRef<HTMLElement | null>(null)
  const activeCompareGroup =
    selectedGroup && selectedCompareGroup && selectedCompareGroup !== selectedGroup && teamProfileMap.has(selectedCompareGroup)
      ? selectedCompareGroup
      : null

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = selectedGroup
        ? activeCompareGroup
          ? `${selectedGroup} vs ${activeCompareGroup} | Idol Song App`
          : `${selectedGroup} | Idol Song App`
        : 'Idol Song App'
    }
  }, [activeCompareGroup, selectedGroup])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handlePopState = () => {
      setSelectedGroup(readSelectedGroupFromLocation())
      setSelectedCompareGroup(readSelectedCompareGroupFromLocation())
      setSelectedAlbumKey(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextPath = selectedGroup ? getArtistPath(selectedGroup, activeCompareGroup) : '/'
    const currentLocation = `${window.location.pathname}${window.location.search}`
    if (currentLocation !== nextPath) {
      window.history.pushState({ group: selectedGroup, compare: activeCompareGroup }, '', nextPath)
    }
  }, [activeCompareGroup, selectedGroup])

  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]
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
  const weekdayFormatter = new Intl.DateTimeFormat(copy.locale, {
    weekday: 'short',
  })
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const reference = new Date(Date.UTC(2026, 0, 4 + index))
    return weekdayFormatter.format(reference)
  })
  const searchNeedle = createSearchNeedle(search)

  const filteredReleases = releases.filter((item) => {
    const matchesSearch = matchesSearchIndex(searchIndexByGroup.get(item.group), searchNeedle)
    const matchesReleaseKind =
      selectedReleaseKind === 'all' || item.release_kind === selectedReleaseKind
    const matchesActType = selectedActType === 'all' || item.actType === selectedActType
    const matchesStatus =
      selectedDashboardStatus === 'all' || selectedDashboardStatus === 'verified'
    const matchesAgency = matchesAgencyFilter(item.group, selectedAgency)
    return matchesSearch && matchesReleaseKind && matchesActType && matchesStatus && matchesAgency
  })

  const filteredUpcoming = dedupedUpcomingCandidates.filter((item) => {
    const matchesSearch = matchesSearchIndex(searchIndexByGroup.get(item.group), searchNeedle)
    const matchesReleaseKind =
      selectedReleaseKind === 'all' || item.release_format === selectedReleaseKind
    const matchesActType = selectedActType === 'all' || getActType(item.group) === selectedActType
    const matchesStatus =
      selectedDashboardStatus === 'all'
        ? true
        : selectedDashboardStatus === 'verified'
          ? false
          : item.date_status === selectedDashboardStatus
    const matchesAgency = matchesAgencyFilter(item.group, selectedAgency)
    return matchesSearch && matchesReleaseKind && matchesActType && matchesStatus && matchesAgency
  })
  const filteredTeams = teamProfiles.filter(
    (team) =>
      matchesSearchIndex(searchIndexByGroup.get(team.group), searchNeedle) &&
      matchesAgencyFilter(team.group, selectedAgency),
  )
  const filteredLongGapRadar = longGapRadarEntries.filter((item) =>
    matchesSearchIndex(searchIndexByGroup.get(item.group), searchNeedle) &&
      matchesAgencyFilter(item.group, selectedAgency),
  )
  const filteredRookieRadar = rookieRadarEntries.filter((item) =>
    matchesSearchIndex(searchIndexByGroup.get(item.group), searchNeedle) &&
      matchesAgencyFilter(item.group, selectedAgency),
  )
  const filteredUpcomingSignals = filteredUpcoming
    .flatMap((item) => expandUpcomingCandidate(item))
    .sort((left, right) => left.dateValue.getTime() - right.dateValue.getTime())

  const visibleMonthKeys = getVisibleMonthKeys(filteredReleases, filteredUpcomingSignals)
  const effectiveMonthKey = visibleMonthKeys.includes(selectedMonthKey)
    ? selectedMonthKey
    : visibleMonthKeys.at(-1) ?? selectedMonthKey
  const selectedMonthDate = monthKeyToDate(effectiveMonthKey)
  const monthDays = buildCalendarDays(selectedMonthDate)
  const releasesByDate = groupByDate(filteredReleases)
  const upcomingByDate = groupUpcomingByDate(filteredUpcomingSignals)
  const monthReleases = filteredReleases.filter((item) => getMonthKey(item.dateValue) === effectiveMonthKey)
  const monthUpcomingSignals = filteredUpcomingSignals.filter(
    (item) => getMonthKey(item.dateValue) === effectiveMonthKey,
  )
  const monthVerifiedDashboardRows = [...monthReleases].sort(compareMonthlyDashboardVerified)
  const monthScheduledDashboardRows = [...monthUpcomingSignals].sort(compareMonthlyDashboardUpcoming)
  const monthAgencySections = buildAgencyMonthSections(monthVerifiedDashboardRows, monthScheduledDashboardRows)
  const monthActiveDayIsos = Array.from(
    new Set([...monthReleases.map((item) => item.isoDate), ...monthUpcomingSignals.map((item) => item.isoDate)]),
  ).sort()
  const filteredActiveDayIsos = Array.from(
    new Set([
      ...filteredReleases.map((item) => item.isoDate),
      ...filteredUpcomingSignals.map((item) => item.isoDate),
    ]),
  ).sort()
  const weeklyDigestReferenceDate = filteredReleases[0]?.dateValue ?? null
  const weeklyDigestWindowStart = weeklyDigestReferenceDate ? getDateDaysBefore(weeklyDigestReferenceDate, 6) : null
  const weeklyDigestRows =
    weeklyDigestReferenceDate && weeklyDigestWindowStart
      ? buildWeeklyDigestRows(
          filteredReleases.filter((item) => {
            const time = item.dateValue.getTime()
            return time >= weeklyDigestWindowStart.getTime() && time <= weeklyDigestReferenceDate.getTime()
          }),
          WEEKLY_DIGEST_MAX_ITEMS,
        )
      : []
  const visibleDayIsos = new Set(monthDays.map((day) => day.iso))
  const isSelectedDayVisible = visibleDayIsos.has(selectedDayIso)
  const hasNoReleaseMatches = filteredReleases.length === 0 && filteredUpcomingSignals.length === 0

  const effectiveSelectedDayIso =
    isSelectedDayVisible
      ? selectedDayIso
      : monthActiveDayIsos[0] ?? monthDays.find((day) => day.inMonth)?.iso ?? filteredActiveDayIsos[0] ?? ''

  const selectedDayReleases = effectiveSelectedDayIso
    ? releasesByDate.get(effectiveSelectedDayIso) ?? []
    : []
  const selectedDayUpcomingSignals = effectiveSelectedDayIso
    ? upcomingByDate.get(effectiveSelectedDayIso) ?? []
    : []

  const latestRelease = filteredReleases[0]
  const earliestRelease = filteredReleases.at(-1)
  const monthIndex = visibleMonthKeys.indexOf(effectiveMonthKey)
  const selectedDayLabel = effectiveSelectedDayIso
    ? formatDisplayDate(effectiveSelectedDayIso, displayDateFormatter)
    : copy.noReleaseSelected
  const monthlyContextTitle =
    language === 'ko'
      ? `${selectedMonthDate.getFullYear()}년 ${selectedMonthDate.getMonth() + 1}월 컴백 캘린더`
      : `${monthFormatter.format(selectedMonthDate)} comeback calendar`
  const nearestMonthlySignal = monthScheduledDashboardRows[0] ?? null
  const selectedTeam = selectedGroup ? teamProfileMap.get(selectedGroup) ?? null : null
  const compareTeam = activeCompareGroup ? teamProfileMap.get(activeCompareGroup) ?? null : null
  const compareTeamOptions = selectedTeam ? teamProfiles.filter((team) => team.group !== selectedTeam.group) : []
  const selectedTeamCompareSnapshot = selectedTeam ? buildTeamCompareSnapshot(selectedTeam.group) : null
  const compareTeamSnapshot = compareTeam ? buildTeamCompareSnapshot(compareTeam.group) : null
  const selectedAlbum =
    selectedTeam && selectedAlbumKey
      ? findVerifiedReleaseByKey(selectedTeam.group, selectedAlbumKey)
      : null
  const selectedTeamLatestRecord =
    selectedTeam?.latestRelease?.verified
      ? findVerifiedReleaseRecord(
          selectedTeam.group,
          selectedTeam.latestRelease.title,
          selectedTeam.latestRelease.date,
          selectedTeam.latestRelease.stream,
          selectedTeam.latestRelease.releaseKind,
        )
      : null
  const selectedTeamLatestDetail =
    selectedTeam?.latestRelease
      ? getReleaseDetail(
          selectedTeam.group,
          selectedTeam.latestRelease.title,
          selectedTeam.latestRelease.date,
          selectedTeam.latestRelease.stream,
          selectedTeam.latestRelease.releaseKind,
        )
      : null
  const selectedTeamLatestHandoffs =
    selectedTeam?.latestRelease
      ? buildReleaseDetailHandoffs(selectedTeamLatestDetail, selectedTeam.latestRelease.musicHandoffs)
      : undefined
  const selectedTeamLatestMvUrl = selectedTeamLatestDetail
    ? getReleaseDetailMvUrls(selectedTeamLatestDetail).canonicalUrl
    : ''
  const relatedActs = selectedTeam ? relatedActsByGroup.get(selectedTeam.group) ?? [] : []

  useEffect(() => {
    if (!selectedDayInteractionTick || !selectedDayPanelRef.current || !effectiveSelectedDayIso) {
      return undefined
    }

    const panelNode = selectedDayPanelRef.current

    panelNode.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
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

  function openTeamPage(group: string) {
    setSelectedGroup(group)
    setSelectedCompareGroup(null)
    setSelectedAlbumKey(null)
  }

  function openReleaseDetail(release: VerifiedRelease) {
    setSelectedGroup(release.group)
    setSelectedCompareGroup(null)
    setSelectedAlbumKey(getAlbumKey(release))
  }

  function closeTeamPage() {
    setSelectedGroup(null)
    setSelectedCompareGroup(null)
    setSelectedAlbumKey(null)
  }

  function handleSelectDay(dayIso: string) {
    setSelectedDayIso(dayIso)
    setSelectedDayInteractionTick((tick) => tick + 1)
  }

  return (
    <div className="shell">
      <header className="panel context-header">
        <div className="context-header-top">
          <div className="context-header-copy">
            <p className="panel-label">{copy.monthlyContextLabel}</p>
            <h1>{monthlyContextTitle}</h1>
            <div className="context-summary-grid">
              <article className="context-summary-card">
                <span>{copy.monthlySummaryLabels.verified}</span>
                <strong>{monthReleases.length}</strong>
              </article>
              <article className="context-summary-card">
                <span>{copy.monthlySummaryLabels.scheduled}</span>
                <strong>{monthScheduledDashboardRows.length}</strong>
              </article>
              <article className="context-summary-card">
                <span>{copy.monthlySummaryLabels.nearest}</span>
                <strong>
                  {nearestMonthlySignal
                    ? formatOptionalDate(nearestMonthlySignal.scheduled_date, displayDateFormatter, copy.none)
                    : copy.monthlyNearestEmpty}
                </strong>
                <p className="context-summary-meta">
                  {nearestMonthlySignal ? getTeamDisplayName(nearestMonthlySignal.group) : copy.none}
                </p>
              </article>
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

            <article className="context-highlight-card">
              <div className="context-highlight-head">
                <div>
                  <p className="panel-label">{copy.monthlyHighlightLabel}</p>
                  <h2>{nearestMonthlySignal ? nearestMonthlySignal.headline : copy.monthlyNearestEmpty}</h2>
                </div>
                {nearestMonthlySignal ? (
                  <div className="signal-tags">
                    <UpcomingCountdownBadge item={nearestMonthlySignal} formatter={shortDateFormatter} />
                    <span className={`signal-badge signal-badge-date-${nearestMonthlySignal.date_status}`}>
                      {formatDateStatus(nearestMonthlySignal.date_status, language)}
                    </span>
                  </div>
                ) : null}
              </div>

              {nearestMonthlySignal ? (
                <div className="context-highlight-body">
                  <div>
                    <TeamIdentity group={nearestMonthlySignal.group} variant="list" />
                    <p className="signal-meta">
                      {formatOptionalDate(nearestMonthlySignal.scheduled_date, displayDateFormatter, copy.none)} ·{' '}
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
                <p className="empty-copy">{copy.monthlyHighlightEmpty}</p>
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
        </div>
      </header>

      {selectedTeam ? (
        <main className="team-page">
          <section className="panel team-page-hero">
            <div className="team-page-head">
              <button type="button" className="ghost-button" onClick={closeTeamPage}>
                {teamCopy.back}
              </button>
              <span className={`signal-badge signal-badge-${selectedTeam.trackingStatus}`}>
                {formatTrackingStatus(selectedTeam.trackingStatus, language)}
              </span>
            </div>

            <div className="team-page-summary">
              <div className="team-title-wrap">
                <div className="team-avatar" aria-hidden="true">
                  {selectedTeam.representativeImageUrl ? (
                    <img className="team-avatar-image" src={selectedTeam.representativeImageUrl} alt="" />
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
                  value={selectedTeam.representativeImageSource ?? teamCopy.generatedMark}
                />
              </div>
            </div>

            <div className="team-links-row meta-links">
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
              <a href={selectedTeam.youtubeUrl} target="_blank" rel="noreferrer" className="meta-link">
                {selectedTeam.hasOfficialYouTubeUrl ? 'YouTube' : teamCopy.youtubeSearch}
              </a>
              {selectedTeam.artistSource ? (
                <a href={selectedTeam.artistSource} target="_blank" rel="noreferrer" className="meta-link">
                  {copy.artistSource}
                </a>
              ) : null}
            </div>
            <p className="team-footnote">{teamCopy.footnote}</p>
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
                            {formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}
                          </p>
                          {formatUpcomingEvidenceMeta(item, language) ? (
                            <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                          ) : null}
                          {item.evidence_summary ? (
                            <p className="signal-evidence">{item.evidence_summary}</p>
                          ) : null}
                        </div>
                        <div className="signal-date-wrap">
                          <time>{formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}</time>
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
                      artwork={getReleaseArtwork(
                        selectedTeam.group,
                        selectedTeam.latestRelease.title,
                        selectedTeam.latestRelease.date,
                        selectedTeam.latestRelease.stream,
                        selectedTeam.latestRelease.releaseKind,
                      )}
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
                      {selectedTeamLatestDetail?.notes ? (
                        <p className="signal-evidence">{selectedTeamLatestDetail.notes}</p>
                      ) : null}
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
                      const artwork = getReleaseArtwork(
                        item.group,
                        item.title,
                        item.date,
                        item.stream,
                        item.release_kind,
                      )
                      const detail = getReleaseDetail(
                        item.group,
                        item.title,
                        item.date,
                        item.stream,
                        item.release_kind,
                      )

                      return (
                        <article key={getAlbumKey(item)} className="album-card-shell">
                          <button
                            type="button"
                            className="album-card"
                            onClick={() => setSelectedAlbumKey(getAlbumKey(item))}
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
                            canonicalUrls={buildReleaseDetailHandoffs(detail, item.music_handoffs)}
                            mvUrl={getReleaseDetailMvUrls(detail).canonicalUrl}
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
                      const team = teamProfileMap.get(item.group)
                      if (!team) {
                        return null
                      }

                      return (
                        <article key={team.group} className="related-acts-card">
                          <div className="related-acts-head">
                            <TeamIdentity group={team.group} variant="list" />
                            <span className={`signal-badge signal-badge-related-${item.reason.kind}`}>
                              {formatRelatedActReasonLabel(item.reason, language)}
                            </span>
                          </div>
                          <p className="related-acts-reason">{formatRelatedActReasonDetail(item.reason, language)}</p>
                          <div className="action-row">
                            <ActionButton variant="primary" onClick={() => openTeamPage(team.group)}>
                              {teamCopy.action}
                            </ActionButton>
                            <ActionButton variant="secondary" onClick={() => setSelectedCompareGroup(team.group)}>
                              {teamCopy.compareAction}
                            </ActionButton>
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
              rows={weeklyDigestRows}
              windowStartDate={weeklyDigestWindowStart}
              windowEndDate={weeklyDigestReferenceDate}
              language={language}
              displayDateFormatter={displayDateFormatter}
              onOpenReleaseDetail={openReleaseDetail}
            />

            <section ref={calendarPanelRef} className="panel panel-calendar">
              <div className="panel-top">
                <div>
                  <p className="panel-label">{copy.monthlyGrid}</p>
                  <h2>{monthFormatter.format(selectedMonthDate)}</h2>
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

              {hasNoReleaseMatches ? (
                <div className="empty-state">
                  {copy.noFilteredMatches}
                </div>
              ) : null}

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

            <MonthlyReleaseDashboard
              monthLabel={monthFormatter.format(selectedMonthDate)}
              verifiedRows={monthVerifiedDashboardRows}
              scheduledRows={monthScheduledDashboardRows}
              language={language}
              displayDateFormatter={displayDateFormatter}
              onOpenTeamPage={openTeamPage}
              onOpenReleaseDetail={openReleaseDetail}
            />

            <AgencyCalendarView
              sections={monthAgencySections}
              language={language}
              displayDateFormatter={displayDateFormatter}
              onOpenTeamPage={openTeamPage}
              onOpenReleaseDetail={openReleaseDetail}
            />

            <SelectedDayPanel
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

          <aside className="sidebar">
            <section
              className="panel sidebar-upcoming-panel"
              style={desktopUpcomingPanelHeight ? { height: `${desktopUpcomingPanelHeight}px` } : undefined}
            >
              <div className="sidebar-upcoming-panel-head">
                <div>
                  <p className="panel-label">{copy.upcomingScan}</p>
                  <h2>{copy.upcomingTitle}</h2>
                </div>
                <span className="sidebar-panel-count">{filteredUpcoming.length}</span>
              </div>
              <div className="sidebar-upcoming-panel-body">
                {filteredUpcoming.length ? (
                  <div className="feed-list">
                    {filteredUpcoming.map((item) => (
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
                            {formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}
                          </p>
                          {formatUpcomingEvidenceMeta(item, language) ? (
                            <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                          ) : null}
                          {item.evidence_summary ? (
                            <p className="signal-evidence">{item.evidence_summary}</p>
                          ) : null}
                          <div className="action-stack">
                            <div className="action-row">
                              <ActionButton variant="primary" onClick={() => openTeamPage(item.group)}>
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
                          <time>{formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}</time>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">{copy.noUpcomingCandidates}</p>
                )}
              </div>
            </section>

            <section className="panel">
              <p className="panel-label">{copy.longGapRadar}</p>
              <h2>{copy.longGapRadarTitle}</h2>
              <LongGapRadarList
                entries={filteredLongGapRadar}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenTeamPage={openTeamPage}
              />
            </section>

            <section className="panel">
              <p className="panel-label">{copy.rookieRadar}</p>
              <h2>{copy.rookieRadarTitle}</h2>
              <RookieRadarList
                entries={filteredRookieRadar}
                language={language}
                displayDateFormatter={displayDateFormatter}
                onOpenTeamPage={openTeamPage}
              />
            </section>

            <section className="panel">
              <p className="panel-label">{copy.recentFeed}</p>
              <h2>{copy.newestReleasesFirst}</h2>
              <div className="feed-list">
                {filteredReleases.slice(0, 10).map((item) => (
                  <article key={`${item.group}-${item.stream}-${item.title}`} className="feed-row">
                    <div>
                      <div className="signal-head">
                        <TeamIdentity group={item.group} variant="list" />
                        <span className="signal-badge">{describeRelease(item, language)}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <div className="row-actions">
                        <button type="button" className="inline-button" onClick={() => openTeamPage(item.group)}>
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
                {filteredTeams.length ? (
                  filteredTeams.slice(0, 12).map((team) => (
                    <button
                      type="button"
                      key={team.group}
                      className="team-directory-button"
                      onClick={() => openTeamPage(team.group)}
                    >
                      <span>{team.displayName}</span>
                      <strong>
                        {team.nextUpcomingSignal
                          ? describeUpcomingSignal(team.nextUpcomingSignal, language, displayDateFormatter, copy.none)
                          : teamCopy.noSignal}
                      </strong>
                    </button>
                  ))
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
                  value={unresolved.length ? unresolved.map((item) => item.group).join(', ') : copy.none}
                />
              </div>
            </section>
        </aside>
      </main>
      )}

      {selectedTeam && selectedAlbum ? (
        <AlbumDrawer
          album={selectedAlbum}
          group={selectedTeam.group}
          language={language}
          displayDateFormatter={displayDateFormatter}
          onClose={() => setSelectedAlbumKey(null)}
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

function AlbumDrawer({
  album,
  group,
  language,
  displayDateFormatter,
  onClose,
}: {
  album: VerifiedRelease
  group: string
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onClose: () => void
}) {
  const copy = TRANSLATIONS[language]
  const teamCopy = TEAM_COPY[language]
  const displayName = getTeamDisplayName(group)
  const artwork = getReleaseArtwork(group, album.title, album.date, album.stream, album.release_kind)
  const releaseDetail = getReleaseDetail(group, album.title, album.date, album.stream, album.release_kind)
  const releaseEnrichment = getReleaseEnrichment(group, album.title, album.date, album.stream, album.release_kind)
  const previewTracks = releaseDetail.tracks.length
    ? releaseDetail.tracks
    : buildAlbumPreviewTracks(album, group, language).map((title, index) => ({ order: index + 1, title }))
  const canonicalHandoffs = buildReleaseDetailHandoffs(releaseDetail, album.music_handoffs)
  const mv = getReleaseDetailMvUrls(releaseDetail)

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="album-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="team-page-head">
          <div>
            <p className="panel-label">{teamCopy.albumDetail}</p>
            <h2>{album.title}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            {teamCopy.close}
          </button>
        </div>

        <div className="album-drawer-cover">
          <ReleaseArtworkFigure
            artwork={artwork}
            alt={`${displayName} ${album.title} cover artwork`}
            variant="drawer"
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
          <div className="track-list">
            {previewTracks.map((track) => (
              <div key={`${album.title}-${track.title}-${track.order}`} className="track-row">
                <div className="track-row-main">
                  <span>{`${track.order}`.padStart(2, '0')}</span>
                  <strong>{track.title}</strong>
                </div>
                <MusicHandoffRow group={group} title={track.title} language={language} compact includeMv={false} />
              </div>
            ))}
          </div>
          <p className="hero-text drawer-copy">{teamCopy.trackPreviewHint}</p>
        </section>

        {releaseDetail.notes ? (
          <section className="track-preview">
            <p className="panel-label">{teamCopy.releaseNotes}</p>
            <p className="hero-text drawer-copy">{releaseDetail.notes}</p>
          </section>
        ) : null}

        {mv.canonicalUrl ? (
          <section className="official-mv-section">
            <p className="panel-label">{teamCopy.officialMv}</p>
            <p className="hero-text drawer-copy">{teamCopy.officialMvHint}</p>
            {mv.embedUrl ? (
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
            ) : (
              <p className="hero-text drawer-copy">{teamCopy.officialMvLinkOnly}</p>
            )}
            <div className="meta-links">
              <a href={mv.canonicalUrl} target="_blank" rel="noreferrer" className="meta-link">
                {teamCopy.watchOnYouTube}
              </a>
            </div>
          </section>
        ) : null}

        <ReleaseEnrichmentSection
          enrichment={releaseEnrichment}
          language={language}
          displayDateFormatter={displayDateFormatter}
        />

        <p className="hero-text drawer-copy">{teamCopy.drawerCopy}</p>
        <div className="action-stack">
          <MusicHandoffRow
            group={group}
            title={album.title}
            canonicalUrls={canonicalHandoffs}
            mvUrl={mv.canonicalUrl}
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
      </aside>
    </div>
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
  includeMv = true,
}: {
  group: string
  title: string
  canonicalUrls?: MusicHandoffUrls
  language: Language
  compact?: boolean
  showHint?: boolean
  mvUrl?: string
  includeMv?: boolean
}) {
  const copy = TRANSLATIONS[language]
  const links = buildServiceActionLinks({
    group,
    title,
    canonicalUrls,
    mvUrl,
    includeMv,
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
  const badgeImageUrl = getTeamBadgeImageUrl(group)
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
        {badgeImageUrl ? (
          <img className="team-badge-image" src={badgeImageUrl} alt="" />
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
  onOpenTeamPage: (group: string) => void
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
                {formatOptionalDate(entry.latestSignal.scheduled_date, displayDateFormatter, copy.none)}
              </p>
              {entry.latestSignal.evidence_summary ? (
                <p className="signal-evidence">{entry.latestSignal.evidence_summary}</p>
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">{copy.longGapLatestSignalEmpty}</p>
          )}
          <div className="detail-links">
            <button type="button" className="inline-button" onClick={() => onOpenTeamPage(entry.group)}>
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
  onOpenTeamPage: (group: string) => void
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
                {formatOptionalDate(entry.latestSignal.scheduled_date, displayDateFormatter, copy.none)}
              </p>
              {entry.latestSignal.evidence_summary ? (
                <p className="signal-evidence">{entry.latestSignal.evidence_summary}</p>
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">{copy.rookieLatestSignalEmpty}</p>
          )}

          <div className="detail-links">
            <button type="button" className="inline-button" onClick={() => onOpenTeamPage(entry.group)}>
              {teamCopy.action}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function WeeklyMustListenDigest({
  rows,
  windowStartDate,
  windowEndDate,
  language,
  displayDateFormatter,
  onOpenReleaseDetail,
}: {
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
    <section className="panel weekly-digest">
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
                            {formatOptionalDate(item.signal.scheduled_date, displayDateFormatter, copy.none)}
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
  compareOptions: TeamProfile[]
  selectedCompareGroup: string | null
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onSelectCompareGroup: (group: string | null) => void
  onOpenTeamPage: (group: string) => void
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
              <option key={team.group} value={team.group}>
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
                <ActionButton variant="secondary" onClick={() => onOpenTeamPage(primaryTeam.group)}>
                  {teamCopy.action}
                </ActionButton>
              </div>
            </article>
            <article className="compare-summary-card">
              <TeamIdentity group={secondaryTeam.group} variant="list" />
              <div className="action-row">
                <ActionButton variant="secondary" onClick={() => onOpenTeamPage(secondaryTeam.group)}>
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
        {formatOptionalDate(signal.scheduled_date, displayDateFormatter, copy.none)} ·{' '}
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

function MonthlyReleaseDashboard({
  monthLabel,
  verifiedRows,
  scheduledRows,
  language,
  displayDateFormatter,
  onOpenTeamPage,
  onOpenReleaseDetail,
}: {
  monthLabel: string
  verifiedRows: VerifiedRelease[]
  scheduledRows: DatedUpcomingSignal[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string) => void
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const copy = TRANSLATIONS[language]

  return (
    <section className="panel monthly-dashboard">
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

      <div className="monthly-dashboard-stack">
        <section className="monthly-dashboard-section">
          <div className="selected-day-panel-head">
            <h3>{copy.monthlyDashboardVerifiedTitle}</h3>
            <span className="selected-day-panel-count">{verifiedRows.length}</span>
          </div>
          {verifiedRows.length ? (
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
                    {verifiedRows.map((item) => (
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
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
                {verifiedRows.map((item) => (
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
                        <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
            <span className="selected-day-panel-count">{scheduledRows.length}</span>
          </div>
          {scheduledRows.length ? (
            <>
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
                    {scheduledRows.map((item) => (
                      <tr key={`${item.group}-${item.scheduled_date}-${item.headline}`}>
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
                        <td>{formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}</td>
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
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
                {scheduledRows.map((item) => (
                  <article
                    key={`mobile-${item.group}-${item.scheduled_date}-${item.headline}`}
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
                      {formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}
                    </p>
                    <p className="signal-meta">
                      {formatSourceType(item.source_type, language)} · {item.source_domain || copy.sourceTypeLabels.pending}
                    </p>
                    {formatUpcomingEvidenceMeta(item, language) ? (
                      <p className="signal-meta">{formatUpcomingEvidenceMeta(item, language)}</p>
                    ) : null}
                    <div className="action-stack">
                      <div className="action-row">
                        <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
            </>
          ) : (
            <p className="empty-copy">{copy.monthlyDashboardScheduledEmpty}</p>
          )}
        </section>
      </div>
    </section>
  )
}

function AgencyCalendarView({
  sections,
  language,
  displayDateFormatter,
  onOpenTeamPage,
  onOpenReleaseDetail,
}: {
  sections: AgencyMonthSection[]
  language: Language
  displayDateFormatter: Intl.DateTimeFormat
  onOpenTeamPage: (group: string) => void
  onOpenReleaseDetail: (release: VerifiedRelease) => void
}) {
  const copy = TRANSLATIONS[language]

  return (
    <section className="panel agency-view">
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
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
                            {formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}
                          </p>
                          <div className="action-row">
                            <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
  const detail = getReleaseDetail(release.group, release.title, release.date, release.stream, release.release_kind)
  const canonicalHandoffs = buildReleaseDetailHandoffs(detail, release.music_handoffs)
  const mvUrl = getReleaseDetailMvUrls(detail).canonicalUrl

  return (
    <MusicHandoffRow
      group={release.group}
      title={release.title}
      canonicalUrls={canonicalHandoffs}
      mvUrl={mvUrl}
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
  onOpenTeamPage: (group: string) => void
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
              releases.map((item) => {
                const detail = getReleaseDetail(item.group, item.title, item.date, item.stream, item.release_kind)
                const canonicalHandoffs = buildReleaseDetailHandoffs(detail, item.music_handoffs)
                const mvUrl = getReleaseDetailMvUrls(detail).canonicalUrl

                return (
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
                        <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
                          {teamCopy.action}
                        </ActionButton>
                        <ActionButton variant="secondary" onClick={() => onOpenReleaseDetail(item)}>
                          {getReleaseDetailActionLabel(item.release_kind, language)}
                        </ActionButton>
                      </div>
                      <MusicHandoffRow
                        group={item.group}
                        title={item.title}
                        canonicalUrls={canonicalHandoffs}
                        mvUrl={mvUrl}
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
                )
              })
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
                      <ActionButton variant="primary" onClick={() => onOpenTeamPage(item.group)}>
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
  if (!isExactDate(row.scheduled_date)) {
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

function buildAgencyFilterOptions() {
  const agencies = new Set<string>()

  for (const team of teamProfiles) {
    agencies.add(getAgencyFilterValue(team.agency))
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
  return normalizeAgencyName(artistProfileByGroup.get(group)?.agency)
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
    const agency = getAgencyFilterValue(getGroupAgency(item.group))
    const current = sections.get(agency) ?? {
      agency,
      verifiedRows: [],
      scheduledRows: [],
    }
    current.verifiedRows.push(item)
    sections.set(agency, current)
  }

  for (const item of scheduledRows) {
    const agency = getAgencyFilterValue(getGroupAgency(item.group))
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

function buildVerifiedReleaseHistory() {
  const historyByKey = new Map<string, VerifiedRelease>()

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
      (item) => isExactDate(item.scheduled_date) && Number.parseInt(item.scheduled_date.slice(0, 4), 10) === currentYear,
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
    !isExactDate(item.scheduled_date) ||
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

function buildServiceActionLinks({
  group,
  title,
  canonicalUrls,
  mvUrl,
  includeMv = true,
}: {
  group: string
  title: string
  canonicalUrls?: MusicHandoffUrls
  mvUrl?: string
  includeMv?: boolean
}): MusicHandoffLink[] {
  const query = `${group} ${title}`.trim()
  const links: MusicHandoffLink[] = MUSIC_HANDOFF_SERVICES.map((service) => ({
    service,
    href: canonicalUrls?.[service] || buildMusicSearchUrl(service, query),
    mode: canonicalUrls?.[service] ? 'canonical' : 'search',
  }))

  if (includeMv) {
    links.push({
      service: 'youtube_mv',
      href: mvUrl || buildYouTubeMvSearchUrl(query),
      mode: mvUrl ? 'canonical' : 'search',
    })
  }

  return links
}

function buildMusicSearchUrl(service: MusicService, query: string) {
  const encodedQuery = encodeURIComponent(query)
  if (service === 'spotify') {
    return `https://open.spotify.com/search/${encodedQuery}`
  }

  return `https://music.youtube.com/search?q=${encodedQuery}`
}

function buildYouTubeMvSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} official mv`)}`
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
    canonicalUrl: videoId ? buildYouTubeMvCanonicalUrl(videoId) : detail.youtube_video_url || '',
    embedUrl: videoId ? buildYouTubeNoCookieEmbedUrl(videoId) : '',
  }
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

function getReleaseArtwork(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ResolvedReleaseArtwork {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind)
  const artwork = releaseArtworkByKey.get(
    getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream),
  )

  if (!artwork) {
    return buildPlaceholderReleaseArtwork(group, releaseTitle, releaseDate, stream, releaseKind)
  }

  return {
    ...artwork,
    isPlaceholder: artwork.artwork_source_type === 'placeholder',
  }
}

function buildFallbackReleaseDetail(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ResolvedReleaseDetail {
  return {
    group,
    release_title: releaseTitle,
    release_date: releaseDate,
    stream: normalizeReleaseStream(stream, releaseKind),
    release_kind: releaseKind === 'album' || releaseKind === 'ep' ? releaseKind : 'single',
    tracks: [],
    spotify_url: null,
    youtube_music_url: null,
    youtube_video_id: null,
    youtube_video_url: null,
    notes: '',
    isFallback: true,
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

function getReleaseDetail(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ResolvedReleaseDetail {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind)
  const detail = releaseDetailsByKey.get(
    getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream),
  )

  if (!detail) {
    return buildFallbackReleaseDetail(group, releaseTitle, releaseDate, stream, releaseKind)
  }

  return {
    ...detail,
    isFallback: false,
  }
}

function getReleaseEnrichment(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
): ResolvedReleaseEnrichment {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind)
  const enrichment = releaseEnrichmentByKey.get(
    getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream),
  )

  if (!enrichment) {
    return buildFallbackReleaseEnrichment(group, releaseTitle, releaseDate, stream, releaseKind)
  }

  return {
    ...enrichment,
    isFallback: false,
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
        youtubeUrl: artistProfile?.official_youtube_url ?? getYouTubeSearchUrl(group),
        hasOfficialYouTubeUrl: Boolean(artistProfile?.official_youtube_url),
        agency: normalizeAgencyName(artistProfile?.agency),
        representativeImageUrl: artistProfile?.representative_image_url ?? null,
        representativeImageSource: artistProfile?.representative_image_source ?? null,
        latestRelease,
        recentAlbums: groupReleases.filter((item) => item.stream === 'album'),
        upcomingSignals,
        sourceTimeline,
        annualReleaseTimeline,
        changeLog,
        nextUpcomingSignal: upcomingSignals[0] ?? null,
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
            reason,
            score,
          },
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

function buildLongGapRadarEntries() {
  return teamProfiles
    .flatMap((team) => {
      const watchRow = watchlistByGroup.get(team.group)
      if (!watchRow || !isLongGapRadarWatchReason(watchRow.watch_reason)) {
        return []
      }

      if (!team.latestRelease?.date || !isExactDate(team.latestRelease.date)) {
        return []
      }

      const gapDays = getElapsedDaysSinceDate(team.latestRelease.date)
      if (watchRow.watch_reason === 'long_gap' && gapDays < LONG_GAP_THRESHOLD_DAYS) {
        return []
      }

      return [
        {
          group: team.group,
          watchReason: watchRow.watch_reason,
          latestRelease: team.latestRelease,
          gapDays,
          hasUpcomingSignal: team.upcomingSignals.length > 0,
          latestSignal: pickLatestRadarSignal(team.upcomingSignals),
        },
      ]
    })
    .sort(compareLongGapRadarEntries)
}

function buildRookieRadarEntries() {
  return teamProfiles
    .flatMap((team) => {
      const artistProfile = artistProfileByGroup.get(team.group)
      if (!artistProfile || !isRookieEligible(artistProfile)) {
        return []
      }

      return [
        {
          group: team.group,
          debutYear: artistProfile.debut_year ?? null,
          latestRelease: team.latestRelease,
          hasUpcomingSignal: team.upcomingSignals.length > 0,
          latestSignal: pickLatestRadarSignal(team.upcomingSignals),
        },
      ]
    })
    .sort(compareRookieRadarEntries)
}

function pickLatestRadarSignal(rows: UpcomingCandidateRow[]) {
  return [...rows].sort(compareLatestRadarSignals)[0] ?? null
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

function compareLatestRadarSignals(left: UpcomingCandidateRow, right: UpcomingCandidateRow) {
  const leftOccurredAt = getSourceTimelineSortValue(getSignalOccurredAt(left))
  const rightOccurredAt = getSourceTimelineSortValue(getSignalOccurredAt(right))
  if (leftOccurredAt !== rightOccurredAt) {
    return rightOccurredAt - leftOccurredAt
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence
  }

  return compareUpcomingSignals(left, right)
}

function isLongGapRadarWatchReason(reason: WatchReason) {
  return reason === 'long_gap' || reason === 'manual_watch'
}

function isRookieEligible(profile: ArtistProfileRow) {
  if (profile.radar_tags?.includes('rookie')) {
    return true
  }

  if (typeof profile.debut_year !== 'number') {
    return false
  }

  const currentYear = new Date().getFullYear()
  const minimumYear = currentYear - (ROOKIE_RECENT_YEAR_WINDOW - 1)
  return profile.debut_year >= minimumYear && profile.debut_year <= currentYear
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
  if (isExactDate(item.scheduled_date)) {
    return item.scheduled_date.slice(0, 7)
  }

  const monthMatch = item.evidence_summary.match(/Future month reference:\s*(\d{4}-\d{2})/i)
  return monthMatch?.[1] ?? ''
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

  const exactDateCompare = Number(isExactDate(right.scheduled_date)) - Number(isExactDate(left.scheduled_date))
  if (exactDateCompare !== 0) {
    return exactDateCompare
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
    if (isExactDate(row.scheduled_date)) {
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

  const leftHasDate = isExactDate(left.scheduled_date)
  const rightHasDate = isExactDate(right.scheduled_date)
  if (leftHasDate && rightHasDate) {
    const dateCompare = parseDateValue(left.scheduled_date) - parseDateValue(right.scheduled_date)
    if (dateCompare !== 0) {
      return dateCompare
    }
  } else if (leftHasDate !== rightHasDate) {
    return leftHasDate ? -1 : 1
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
  return [item.group, item.source_url, item.headline, item.published_at, item.scheduled_date].join('::')
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
  const datedRows = rows.filter((item) => isExactDate(item.scheduled_date))
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

function getYouTubeSearchUrl(group: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${group} official channel`)}`
}

function getTeamBadgeImageUrl(group: string) {
  return artistProfileByGroup.get(group)?.representative_image_url ?? null
}

function getTeamDisplayName(group: string) {
  return artistProfileByGroup.get(group)?.display_name ?? group
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
  return `${formatDateStatus(item.date_status, language)} · ${formatOptionalDate(item.scheduled_date, formatter, fallback)}`
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

function findVerifiedReleaseByKey(group: string, albumKey: string) {
  return (verifiedReleaseHistoryByGroup.get(group) ?? []).find((item) => getAlbumKey(item) === albumKey) ?? null
}

function findVerifiedReleaseRecord(
  group: string,
  releaseTitle: string,
  releaseDate: string,
  stream: TeamLatestRelease['stream'] | VerifiedRelease['stream'],
  releaseKind?: string,
) {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind)
  return (
    (releaseGroups.get(group) ?? []).find(
      (item) => item.title === releaseTitle && item.date === releaseDate && item.stream === normalizedStream,
    ) ?? null
  )
}

function getReleaseDetailActionLabel(releaseKind: ReleaseFact['release_kind'], language: Language) {
  const teamCopy = TEAM_COPY[language]
  return releaseKind === 'single' ? teamCopy.releaseDetail : teamCopy.albumDetail
}

function buildAlbumPreviewTracks(album: VerifiedRelease, group: string, language: Language) {
  if (language === 'ko') {
    if (album.release_kind === 'single') {
      return [album.title, `${group} Instrumental placeholder`]
    }

    return [`${group} Intro`, album.title, `${album.release_kind.toUpperCase()} B-side placeholder`]
  }

  if (album.release_kind === 'single') {
    return [album.title, `${group} instrumental placeholder`]
  }

  return [`${group} intro`, album.title, `${album.release_kind.toUpperCase()} B-side placeholder`]
}

function readSelectedGroupFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  return getGroupFromPath(window.location.pathname)
}

function readSelectedCompareGroupFromLocation() {
  if (typeof window === 'undefined') {
    return null
  }

  const primaryGroup = getGroupFromPath(window.location.pathname)
  if (!primaryGroup) {
    return null
  }

  const compareValue = new URLSearchParams(window.location.search).get('compare')
  if (!compareValue) {
    return null
  }

  const resolvedGroup = resolveGroupReference(compareValue)
  if (!resolvedGroup || resolvedGroup === primaryGroup) {
    return null
  }

  return resolvedGroup
}

function getGroupFromPath(pathname: string) {
  const match = pathname.match(/^\/artists\/([^/]+)\/?$/)
  if (!match) {
    return null
  }

  const slug = decodeURIComponent(match[1]).toLowerCase()
  return artistProfileBySlug.get(slug)?.group ?? teamProfiles.find((team) => team.slug === slug)?.group ?? null
}

function resolveGroupReference(value: string) {
  const normalized = decodeURIComponent(value).trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return (
    artistProfileBySlug.get(normalized)?.group ??
    teamProfiles.find((team) => team.slug === normalized || team.group.toLowerCase() === normalized)?.group ??
    null
  )
}

function getArtistPath(group: string, compareGroup?: string | null) {
  const pathname = `/artists/${artistProfileByGroup.get(group)?.slug ?? slugifyGroup(group)}`
  if (!compareGroup || compareGroup === group) {
    return pathname
  }

  const params = new URLSearchParams()
  params.set('compare', artistProfileByGroup.get(compareGroup)?.slug ?? slugifyGroup(compareGroup))
  return `${pathname}?${params.toString()}`
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

function getVisibleMonthKeys(releaseRows: VerifiedRelease[], upcomingRows: DatedUpcomingSignal[]) {
  return getMonthKeys([...releaseRows, ...upcomingRows])
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

function isExactDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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

function getMonthKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

function getSourceDomain(sourceUrl: string) {
  if (!sourceUrl) {
    return ''
  }

  try {
    return new URL(sourceUrl).hostname
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
