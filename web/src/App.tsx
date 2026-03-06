import { useEffect, useState } from 'react'
import './App.css'
import releaseRows from './data/releases.json'
import unresolvedRows from './data/unresolved.json'
import upcomingCandidateRows from './data/upcomingCandidates.json'
import watchlistRows from './data/watchlist.json'

type ReleaseFact = {
  title: string
  date: string
  source: string
  release_kind: 'single' | 'album' | 'ep'
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

type UpcomingCandidateRow = {
  group: string
  scheduled_date: string
  date_status: 'confirmed' | 'scheduled' | 'rumor'
  headline: string
  source_type: string
  source_url: string
  source_domain: string
  published_at: string
  confidence: number
  evidence_summary: string
  tracking_status: string
  search_term: string
}

type DatedUpcomingSignal = UpcomingCandidateRow & {
  dateValue: Date
  isoDate: string
}

type WatchlistRow = {
  group: string
  tier: string
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

type MusicHandoffMode = 'canonical' | 'search'

type MusicHandoffUrls = Partial<Record<MusicService, string>>

type MusicHandoffLink = {
  service: MusicService
  href: string
  mode: MusicHandoffMode
}

type TeamLatestRelease = {
  title: string
  date: string
  releaseKind: string
  streamLabel: string
  source: string
  artistSource: string
  musicHandoffs?: MusicHandoffUrls
  verified: boolean
}

type TeamProfile = {
  group: string
  tier: string
  trackingStatus: string
  artistSource: string
  xUrl: string
  instagramUrl: string
  youtubeUrl: string
  agency: string
  latestRelease: TeamLatestRelease | null
  recentAlbums: VerifiedRelease[]
  upcomingSignals: UpcomingCandidateRow[]
  nextUpcomingSignal: UpcomingCandidateRow | null
}

type Language = 'ko' | 'en'

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
    },
    filterOptions: {
      all: '전체',
      single: '싱글',
      album: '앨범',
      ep: 'EP',
      group: '그룹',
      solo: '솔로',
      unit: '유닛',
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
    noFilteredMatches: '현재 검색어와 필터 조합에 맞는 검증 발매가 없습니다.',
    releaseSource: '발매 출처',
    artistSource: '아티스트 출처',
    sourceLink: '출처 링크',
    noSourceLink: '출처 링크 없음',
    open: '열기',
    musicServices: {
      spotify: 'Spotify',
      youtube_music: 'YouTube Music',
    },
    handoffModeLabels: {
      canonical: '직접 링크',
      search: '검색 열기',
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
    sourceTypeLabels: {
      agency_notice: '기획사 공지',
      weverse_notice: '위버스 공지',
      news_rss: '기사 RSS',
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
  },
  en: {
    locale: 'en-US',
    eyebrow: 'K-pop Release Calendar',
    heroTitle: 'Calendar UI plus a weekly comeback-intelligence cycle.',
    heroText:
      'Verified releases stay in the calendar. A wider watchlist keeps filtered and dormant teams in circulation, then a weekly scan looks for future comeback signals from news and official source trails.',
    languageLabel: 'Language',
    languageNames: { ko: 'Korean', en: 'English' },
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
    },
    filterOptions: {
      all: 'All',
      single: 'Single',
      album: 'Album',
      ep: 'EP',
      group: 'Group',
      solo: 'Solo',
      unit: 'Unit',
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
    noFilteredMatches: 'No verified releases match this search and filter combination.',
    releaseSource: 'Release source',
    artistSource: 'Artist source',
    sourceLink: 'Source link',
    noSourceLink: 'No source link',
    open: 'Open',
    musicServices: {
      spotify: 'Spotify',
      youtube_music: 'YouTube Music',
    },
    handoffModeLabels: {
      canonical: 'Direct link',
      search: 'Search fallback',
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
    sourceTypeLabels: {
      agency_notice: 'Agency notice',
      weverse_notice: 'Weverse notice',
      news_rss: 'News RSS',
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
    quickJumpLabel: '빠른 이동',
    quickJumpTitle: '다른 추적 팀',
    noOtherTeams: '다른 필터된 팀이 없습니다.',
    noSignal: '신호 없음',
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
    trackPreviewHint: '트랙 정보는 v1 placeholder입니다. 전체 디스코그래피 파이프라인에서 실제 트랙 데이터로 대체됩니다.',
    placeholderCover: '임시 커버',
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
    quickJumpLabel: 'Quick jump',
    quickJumpTitle: 'Other tracked teams',
    noOtherTeams: 'No other filtered teams available.',
    noSignal: 'No signal',
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
    trackPreviewHint: 'Track info is a v1 placeholder and will be replaced when the full discography pipeline lands.',
    placeholderCover: 'Placeholder cover',
    drawerCopy:
      'Album detail stays inside the team page so users can inspect the release and return to comeback context immediately.',
    appleMusicNext: 'Apple Music next',
    spotifyNext: 'Spotify next',
    latestNow: 'Latest verified release right now',
  },
} as const

const releaseKindOptions = ['all', 'single', 'album', 'ep'] as const
const actTypeOptions = ['all', 'group', 'solo', 'unit'] as const
const unitGroups = new Set(['ARTMS', 'NCT DREAM', 'NCT WISH', 'VIVIZ'])
const MUSIC_HANDOFF_SERVICES: MusicService[] = ['spotify', 'youtube_music']
const TEAM_BADGE_IMAGE_URLS: Partial<Record<string, string>> = {}

const releaseCatalog = releaseRows as ReleaseRow[]
const releases = releaseCatalog
  .flatMap((row) => expandReleaseRow(row))
  .sort((left, right) => right.dateValue.getTime() - left.dateValue.getTime())

const unresolved = unresolvedRows as UnresolvedRow[]
const watchlist = watchlistRows as WatchlistRow[]
const upcomingCandidates = upcomingCandidateRows as UpcomingCandidateRow[]

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const watchStatusCounts = watchlist.reduce<Record<string, number>>((counts, row) => {
  counts[row.tracking_status] = (counts[row.tracking_status] ?? 0) + 1
  return counts
}, {})

const releaseCatalogByGroup = new Map(releaseCatalog.map((row) => [row.group, row]))
const releaseGroups = groupReleasesByGroup(releases)
const watchlistByGroup = new Map(watchlist.map((row) => [row.group, row]))
const upcomingByGroup = groupUpcomingCandidatesByGroup(upcomingCandidates)
const teamProfiles = buildTeamProfiles()
const teamProfileMap = new Map(teamProfiles.map((team) => [team.group, team]))

function App() {
  const latestMonthKey = getLatestMonthKey(releases)
  const [selectedMonthKey, setSelectedMonthKey] = useState(latestMonthKey)
  const [selectedDayIso, setSelectedDayIso] = useState('')
  const [search, setSearch] = useState('')
  const [selectedReleaseKind, setSelectedReleaseKind] = useState<(typeof releaseKindOptions)[number]>('all')
  const [selectedActType, setSelectedActType] = useState<(typeof actTypeOptions)[number]>('all')
  const [language, setLanguage] = useState<Language>(readInitialLanguage)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(readSelectedGroupFromLocation)
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null)

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
      document.title = selectedGroup ? `${selectedGroup} | Idol Song App` : 'Idol Song App'
    }
  }, [selectedGroup])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handlePopState = () => {
      setSelectedGroup(readSelectedGroupFromLocation())
      setSelectedAlbumKey(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextPath = selectedGroup ? getArtistPath(selectedGroup) : '/'
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ group: selectedGroup }, '', nextPath)
    }
  }, [selectedGroup])

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

  const filteredReleases = releases.filter((item) => {
    const needle = search.trim().toLowerCase()
    const matchesSearch =
      !needle || item.group.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle)
    const matchesReleaseKind =
      selectedReleaseKind === 'all' || item.release_kind === selectedReleaseKind
    const matchesActType = selectedActType === 'all' || item.actType === selectedActType
    return matchesSearch && matchesReleaseKind && matchesActType
  })

  const filteredUpcoming = upcomingCandidates.filter((item) => {
    const needle = search.trim().toLowerCase()
    if (!needle) {
      return true
    }

    return (
      item.group.toLowerCase().includes(needle) ||
      item.headline.toLowerCase().includes(needle)
    )
  })
  const filteredTeams = teamProfiles.filter((team) => matchesTeamSearch(team, search.trim().toLowerCase()))
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
  const monthActiveDayIsos = Array.from(
    new Set([...monthReleases.map((item) => item.isoDate), ...monthUpcomingSignals.map((item) => item.isoDate)]),
  ).sort()
  const filteredActiveDayIsos = Array.from(
    new Set([
      ...filteredReleases.map((item) => item.isoDate),
      ...filteredUpcomingSignals.map((item) => item.isoDate),
    ]),
  ).sort()
  const isSelectedDayInMonth =
    selectedDayIso.slice(0, 7) === effectiveMonthKey &&
    (releasesByDate.has(selectedDayIso) || upcomingByDate.has(selectedDayIso))
  const hasNoReleaseMatches = filteredReleases.length === 0

  const effectiveSelectedDayIso =
    isSelectedDayInMonth
      ? selectedDayIso
      : monthActiveDayIsos[0] ?? filteredActiveDayIsos[0] ?? ''

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
  const selectedTeam = selectedGroup ? teamProfileMap.get(selectedGroup) ?? null : null
  const selectedAlbum =
    selectedTeam && selectedAlbumKey
      ? selectedTeam.recentAlbums.find((item) => getAlbumKey(item) === selectedAlbumKey) ?? null
      : null
  const relatedTeams = filteredTeams.filter((team) => team.group !== selectedTeam?.group).slice(0, 8)

  function openTeamPage(group: string) {
    setSelectedGroup(group)
    setSelectedAlbumKey(null)
  }

  function closeTeamPage() {
    setSelectedGroup(null)
    setSelectedAlbumKey(null)
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">{copy.eyebrow}</p>
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
          <h1>{copy.heroTitle}</h1>
          <p className="hero-text">{copy.heroText}</p>
        </div>
        <div className="hero-stats">
          <StatCard label={copy.stats.verifiedReleases} value={String(filteredReleases.length)} />
          <StatCard label={copy.stats.watchTargets} value={String(watchlist.length)} />
          <StatCard label={copy.stats.upcomingSignals} value={String(filteredUpcoming.length)} />
          <StatCard label={copy.stats.needsReview} value={String(unresolved.length)} />
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
                  {getTeamMonogram(selectedTeam.group)}
                </div>
                <div>
                  <p className="panel-label">{teamCopy.panelLabel}</p>
                  <h2>{selectedTeam.group}</h2>
                  <p className="hero-text team-summary-copy">{teamCopy.intro}</p>
                </div>
              </div>

              <div className="team-facts-grid">
                <TeamFact label={teamCopy.agencyHint} value={selectedTeam.agency} />
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
                <TeamFact label={teamCopy.representativeImage} value={teamCopy.generatedMark} />
              </div>
            </div>

            <div className="team-links-row">
              {selectedTeam.xUrl ? (
                <a href={selectedTeam.xUrl} target="_blank" rel="noreferrer">
                  X
                </a>
              ) : null}
              {selectedTeam.instagramUrl ? (
                <a href={selectedTeam.instagramUrl} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              ) : null}
              <a href={selectedTeam.youtubeUrl} target="_blank" rel="noreferrer">
                {teamCopy.youtubeSearch}
              </a>
              {selectedTeam.artistSource ? (
                <a href={selectedTeam.artistSource} target="_blank" rel="noreferrer">
                  {copy.artistSource}
                </a>
              ) : null}
            </div>
            <p className="team-footnote">{teamCopy.footnote}</p>
          </section>

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
                            </div>
                          </div>
                          <h3>{item.headline}</h3>
                          <p className="signal-meta">
                            {formatSourceType(item.source_type, language)} · {item.source_domain || copy.sourceTypeLabels.pending} ·{' '}
                            {formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}
                          </p>
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
              </section>

              <section className="panel">
                <p className="panel-label">{teamCopy.latestLabel}</p>
                <h2>{selectedTeam.latestRelease?.title ?? teamCopy.latestEmptyTitle}</h2>
                {selectedTeam.latestRelease ? (
                  <article className="detail-card detail-card-feature">
                    <div>
                      <div className="signal-head">
                        <TeamIdentity group={selectedTeam.group} variant="list" />
                        <span className="signal-badge">
                          {selectedTeam.latestRelease.streamLabel} · {selectedTeam.latestRelease.releaseKind}
                        </span>
                      </div>
                      <h3>{selectedTeam.latestRelease.title}</h3>
                      <p className="signal-meta">
                        {selectedTeam.latestRelease.verified ? teamCopy.verifiedRelease : teamCopy.watchlistFallback} ·{' '}
                        {formatOptionalDate(selectedTeam.latestRelease.date, displayDateFormatter, copy.none)}
                      </p>
                    </div>
                    <div className="detail-links detail-links-stack">
                      {selectedTeam.latestRelease.source ? (
                        <a href={selectedTeam.latestRelease.source} target="_blank" rel="noreferrer">
                          {copy.releaseSource}
                        </a>
                      ) : (
                        <span className="signal-link-muted">{teamCopy.releaseSourcePending}</span>
                      )}
                      {selectedTeam.latestRelease.artistSource ? (
                        <a href={selectedTeam.latestRelease.artistSource} target="_blank" rel="noreferrer">
                          {copy.artistSource}
                        </a>
                      ) : null}
                    </div>
                    <MusicHandoffRow
                      group={selectedTeam.group}
                      title={selectedTeam.latestRelease.title}
                      canonicalUrls={selectedTeam.latestRelease.musicHandoffs}
                      language={language}
                      showHint
                    />
                  </article>
                ) : (
                  <p className="empty-copy">{teamCopy.latestEmptyTitle}</p>
                )}
              </section>

              <section className="panel">
                <p className="panel-label">{teamCopy.recentAlbumsLabel}</p>
                <h2>{selectedTeam.recentAlbums.length ? teamCopy.recentAlbumsTitle : teamCopy.recentAlbumsEmptyTitle}</h2>
                {selectedTeam.recentAlbums.length ? (
                  <div className="album-grid">
                    {selectedTeam.recentAlbums.map((item) => (
                      <article key={getAlbumKey(item)} className="album-card-shell">
                        <button
                          type="button"
                          className="album-card"
                          onClick={() => setSelectedAlbumKey(getAlbumKey(item))}
                        >
                          <span className="album-card-kicker">{item.release_kind}</span>
                          <strong>{item.title}</strong>
                          <span>{formatOptionalDate(item.date, displayDateFormatter, copy.none)}</span>
                          <span className="album-card-meta">{teamCopy.openAlbumDetail}</span>
                        </button>
                        <MusicHandoffRow
                          group={selectedTeam.group}
                          title={item.title}
                          canonicalUrls={item.music_handoffs}
                          language={language}
                          compact
                        />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">{teamCopy.recentAlbumsEmpty}</p>
                )}
              </section>
            </div>

            <aside className="sidebar team-aside">
              <section className="panel">
                <p className="panel-label">{teamCopy.quickJumpLabel}</p>
                <h2>{teamCopy.quickJumpTitle}</h2>
                <div className="team-directory">
                  {relatedTeams.length ? (
                    relatedTeams.map((team) => (
                      <button
                        type="button"
                        key={team.group}
                        className="team-directory-button"
                        onClick={() => openTeamPage(team.group)}
                      >
                        <span>{team.group}</span>
                        <strong>
                          {team.nextUpcomingSignal
                            ? describeUpcomingSignal(team.nextUpcomingSignal, language, displayDateFormatter, copy.none)
                            : teamCopy.noSignal}
                        </strong>
                      </button>
                    ))
                  ) : (
                    <p className="empty-copy">{teamCopy.noOtherTeams}</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </main>
      ) : (
        <main className="layout">
        <section className="panel panel-calendar">
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

          <div className="toolbar">
            <label className="search-field">
              <span>{copy.searchLabel}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
              />
            </label>
            <div className="summary-pill">
              <span>{monthReleases.length} {copy.monthSummaryVerified}</span>
              <span>{monthUpcomingSignals.length} {copy.monthSummaryScheduled}</span>
            </div>
          </div>

          <div className="filter-stack">
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
          </div>

          <div className="coverage-strip">
            <StatusPill label={copy.statusLabels.recent_release} value={watchStatusCounts.recent_release ?? 0} tone="fresh" />
            <StatusPill label={copy.statusLabels.filtered_out} value={watchStatusCounts.filtered_out ?? 0} tone="muted" />
            <StatusPill label={copy.statusLabels.needs_manual_review} value={watchStatusCounts.needs_manual_review ?? 0} tone="warn" />
            <StatusPill label={copy.statusLabels.watch_only} value={watchStatusCounts.watch_only ?? 0} tone="accent" />
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
                    className={[
                      'calendar-cell',
                      day.inMonth ? '' : 'calendar-cell-muted',
                      hasCalendarItems ? 'calendar-cell-active' : '',
                      isSelected ? 'calendar-cell-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedDayIso(day.iso)}
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

        <aside className="sidebar">
          <section className="panel">
            <p className="panel-label">{copy.upcomingScan}</p>
            <h2>{copy.upcomingTitle}</h2>
            <div className="feed-list">
              {filteredUpcoming.length ? (
                filteredUpcoming.slice(0, 10).map((item) => (
                  <article key={`${item.group}-${item.scheduled_date}-${item.headline}`} className="signal-row">
                    <div>
                      <div className="signal-head">
                        <TeamIdentity group={item.group} variant="list" />
                        <div className="signal-tags">
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
                        </div>
                      </div>
                      <h3>{item.headline}</h3>
                      <p className="signal-meta">
                        {formatSourceType(item.source_type, language)} · {item.source_domain || copy.sourceTypeLabels.pending} ·{' '}
                        {formatOptionalDate(item.scheduled_date, displayDateFormatter, copy.none)}
                      </p>
                      {item.evidence_summary ? (
                        <p className="signal-evidence">{item.evidence_summary}</p>
                      ) : null}
                      <div className="row-actions">
                        <button type="button" className="inline-button" onClick={() => openTeamPage(item.group)}>
                          {teamCopy.action}
                        </button>
                      </div>
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
                <p className="empty-copy">{copy.noUpcomingCandidates}</p>
              )}
            </div>
          </section>

          <section className="panel">
            <p className="panel-label">{copy.selectedDay}</p>
            <h2>{selectedDayLabel}</h2>
            <div className="detail-list">
              {selectedDayReleases.length || selectedDayUpcomingSignals.length ? (
                [...selectedDayReleases, ...selectedDayUpcomingSignals].map((item) =>
                  'stream' in item ? (
                  <article key={`${item.group}-${item.stream}-${item.title}`} className="detail-card">
                    <div>
                      <div className="signal-head">
                        <TeamIdentity group={item.group} variant="list" />
                        <span className="signal-badge">{describeRelease(item, language)}</span>
                      </div>
                      <h3>{item.title}</h3>
                    </div>
                    <div className="detail-links">
                      <a href={item.source} target="_blank" rel="noreferrer">
                        {copy.releaseSource}
                      </a>
                      <a href={item.artist_source} target="_blank" rel="noreferrer">
                        {copy.artistSource}
                      </a>
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
                  </article>
                  ) : (
                  <article
                    key={`${item.group}-${item.scheduled_date}-${item.headline}`}
                    className={`detail-card detail-card-signal detail-card-signal-${item.date_status}`}
                  >
                    <div>
                      <div className="signal-head">
                        <TeamIdentity group={item.group} variant="list" />
                        <div className="signal-tags">
                          <span className={`signal-badge signal-badge-date-${item.date_status}`}>
                            {formatDateStatus(item.date_status, language)}
                          </span>
                          <span
                            className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}
                          >
                            {formatConfidenceTone(getConfidenceTone(item.confidence), language)}
                          </span>
                        </div>
                      </div>
                      <h3>{item.headline}</h3>
                      <p className="signal-meta">
                        {formatSourceType(item.source_type, language)} · {item.source_domain || copy.sourceTypeLabels.pending}
                      </p>
                      {item.evidence_summary ? (
                        <p className="signal-evidence">{item.evidence_summary}</p>
                      ) : null}
                    </div>
                    <div className="detail-links">
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          {copy.sourceLink}
                        </a>
                      ) : (
                        <span className="signal-link-muted">{copy.noSourceLink}</span>
                      )}
                      <button type="button" className="inline-button" onClick={() => openTeamPage(item.group)}>
                        {teamCopy.action}
                      </button>
                    </div>
                  </article>
                  ),
                )
              ) : (
                <p className="empty-copy">{copy.noVerifiedRelease}</p>
              )}
            </div>
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
                    <span>{team.group}</span>
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
                  latestRelease ? `${latestRelease.group} · ${formatDisplayDate(latestRelease.date, displayDateFormatter)}` : copy.none
                }
              />
              <MetaItem
                label={copy.earliestInRange}
                value={
                  earliestRelease ? `${earliestRelease.group} · ${formatDisplayDate(earliestRelease.date, displayDateFormatter)}` : copy.none
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
  const previewTracks = buildAlbumPreviewTracks(album, group, language)

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
          <div className="album-drawer-art" aria-hidden="true">
            {getTeamMonogram(group)}
          </div>
          <div>
            <p className="panel-label">{teamCopy.placeholderCover}</p>
            <h3>{group}</h3>
            <p className="signal-meta">
              {copy.releaseKindLabels[album.release_kind]} ·{' '}
              {formatOptionalDate(album.date, displayDateFormatter, copy.none)}
            </p>
          </div>
        </div>

        <div className="meta-grid">
          <MetaItem label={teamCopy.team} value={group} />
          <MetaItem label={teamCopy.releaseKind} value={copy.releaseKindLabels[album.release_kind]} />
          <MetaItem
            label={teamCopy.releaseDate}
            value={formatOptionalDate(album.date, displayDateFormatter, copy.none)}
          />
          <MetaItem label={teamCopy.stream} value={copy.streamLabels[album.stream]} />
        </div>

        <section className="track-preview">
          <p className="panel-label">{teamCopy.trackPreview}</p>
          <div className="track-list">
            {previewTracks.map((track, index) => (
              <div key={`${album.title}-${track}-${index + 1}`} className="track-row">
                <span>{`${index + 1}`.padStart(2, '0')}</span>
                <strong>{track}</strong>
              </div>
            ))}
          </div>
          <p className="hero-text drawer-copy">{teamCopy.trackPreviewHint}</p>
        </section>

        <p className="hero-text drawer-copy">{teamCopy.drawerCopy}</p>
        <div className="detail-links detail-links-stack">
          <a href={album.source} target="_blank" rel="noreferrer">
            {copy.releaseSource}
          </a>
          <a href={album.artist_source} target="_blank" rel="noreferrer">
            {copy.artistSource}
          </a>
        </div>

        <MusicHandoffRow
          group={group}
          title={album.title}
          canonicalUrls={album.music_handoffs}
          language={language}
          showHint
        />
      </aside>
    </div>
  )
}

function MusicHandoffRow({
  group,
  title,
  canonicalUrls,
  language,
  compact = false,
  showHint = false,
}: {
  group: string
  title: string
  canonicalUrls?: MusicHandoffUrls
  language: Language
  compact?: boolean
  showHint?: boolean
}) {
  const copy = TRANSLATIONS[language]
  const links = buildMusicHandoffLinks(group, title, canonicalUrls)

  return (
    <>
      <div className={`handoff-row ${compact ? 'handoff-row-compact' : ''}`}>
        {links.map((link) => (
          <a
            key={`${group}-${title}-${link.service}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className={`handoff-link handoff-link-${link.mode}`}
            aria-label={`${copy.musicServices[link.service]} · ${copy.handoffModeLabels[link.mode]}`}
          >
            <span>{copy.musicServices[link.service]}</span>
            <strong>{copy.handoffModeLabels[link.mode]}</strong>
          </a>
        ))}
      </div>
      {showHint ? <p className="handoff-note">{copy.handoffHint}</p> : null}
    </>
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
  const label = variant === 'chip' ? getCompactTeamLabel(group) : group

  return (
    <span
      className={`team-identity team-identity-${variant}`}
      title={group}
      aria-label={group}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'fresh' | 'muted' | 'warn' | 'accent'
}) {
  return (
    <div className={`status-pill status-pill-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
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

function formatSourceType(sourceType: string, language: Language) {
  return TRANSLATIONS[language].sourceTypeLabels[sourceType as keyof typeof TRANSLATIONS.ko.sourceTypeLabels] ?? TRANSLATIONS[language].sourceTypeLabels.pending
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
  return `${copy.streamLabels[item.stream]} · ${copy.releaseKindLabels[item.release_kind]}`
}

function formatFilterOption(option: string, language: Language) {
  return TRANSLATIONS[language].filterOptions[option as keyof typeof TRANSLATIONS.ko.filterOptions] ?? option
}

function formatTrackingStatus(status: string, language: Language) {
  return TRANSLATIONS[language].statusLabels[status as keyof typeof TRANSLATIONS.ko.statusLabels] ?? status
}

function formatConfidenceTone(tone: ReturnType<typeof getConfidenceTone>, language: Language) {
  return TRANSLATIONS[language].confidenceToneLabels[tone]
}

function buildMusicHandoffLinks(
  group: string,
  title: string,
  canonicalUrls?: MusicHandoffUrls,
): MusicHandoffLink[] {
  const query = `${group} ${title}`.trim()

  return MUSIC_HANDOFF_SERVICES.map((service) => ({
    service,
    href: canonicalUrls?.[service] || buildMusicSearchUrl(service, query),
    mode: canonicalUrls?.[service] ? 'canonical' : 'search',
  }))
}

function buildMusicSearchUrl(service: MusicService, query: string) {
  const encodedQuery = encodeURIComponent(query)
  if (service === 'spotify') {
    return `https://open.spotify.com/search/${encodedQuery}`
  }

  return `https://music.youtube.com/search?q=${encodedQuery}`
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
      const groupReleases = releaseGroups.get(group) ?? []
      const upcomingSignals = [...(upcomingByGroup.get(group) ?? [])].sort(compareUpcomingSignals)
      const latestRelease = deriveLatestRelease(groupReleases, watchRow, releaseRow)

      return {
        group,
        tier: watchRow?.tier ?? 'tracked',
        trackingStatus: watchRow?.tracking_status ?? 'watch_only',
        artistSource: releaseRow?.artist_source ?? latestRelease?.artistSource ?? '',
        xUrl: watchRow?.x_url ?? '',
        instagramUrl: watchRow?.instagram_url ?? '',
        youtubeUrl: getYouTubeSearchUrl(group),
        agency: inferAgency(group, watchRow?.x_url ?? '', watchRow?.instagram_url ?? ''),
        latestRelease,
        recentAlbums: groupReleases.filter((item) => item.stream === 'album'),
        upcomingSignals,
        nextUpcomingSignal: upcomingSignals[0] ?? null,
      }
    })
    .sort(compareTeamProfiles)
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
      streamLabel: latestVerified.stream,
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
    streamLabel: 'watchlist',
    source: '',
    artistSource: releaseRow?.artist_source ?? '',
    verified: false,
  }
}

function matchesTeamSearch(team: TeamProfile, needle: string) {
  if (!needle) {
    return true
  }

  return (
    team.group.toLowerCase().includes(needle) ||
    team.latestRelease?.title.toLowerCase().includes(needle) ||
    team.upcomingSignals.some((item) => item.headline.toLowerCase().includes(needle))
  )
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
  return TEAM_BADGE_IMAGE_URLS[group] ?? null
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

function inferAgency(group: string, xUrl: string, instagramUrl: string) {
  const source = `${xUrl} ${instagramUrl} ${group}`.toLowerCase()

  if (
    source.includes('yg') ||
    ['blackpink', 'babymonster', 'treasure', 'meovv'].includes(group.toLowerCase())
  ) {
    return 'YG-linked act'
  }
  if (
    source.includes('jype') ||
    ['twice', 'itzy', 'nmixx', 'stray kids', 'day6', 'nexz', 'kickflip'].includes(
      group.toLowerCase(),
    )
  ) {
    return 'JYP-linked act'
  }
  if (
    source.includes('smtown') ||
    [
      'aespa',
      'red velvet',
      'exo',
      'shinee',
      'nct 127',
      'nct dream',
      'wayv',
      'riize',
      'hearts2hearts',
    ].includes(group.toLowerCase())
  ) {
    return 'SM-linked act'
  }
  if (
    source.includes('bighit') ||
    source.includes('pledis') ||
    source.includes('koz') ||
    [
      'bts',
      'seventeen',
      'tws',
      'tomorrow x together',
      '&team',
      'le sserafim',
      'boynextdoor',
    ].includes(group.toLowerCase())
  ) {
    return 'HYBE-linked act'
  }

  return 'Agency data pending'
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

function getAlbumKey(item: VerifiedRelease) {
  return `${item.group}-${item.stream}-${item.title}-${item.date}`
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

function getGroupFromPath(pathname: string) {
  const match = pathname.match(/^\/artists\/([^/]+)\/?$/)
  if (!match) {
    return null
  }

  const slug = decodeURIComponent(match[1]).toLowerCase()
  return teamProfiles.find((team) => slugifyGroup(team.group) === slug)?.group ?? null
}

function getArtistPath(group: string) {
  return `/artists/${slugifyGroup(group)}`
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
