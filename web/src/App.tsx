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

const releaseKindOptions = ['all', 'single', 'album', 'ep'] as const
const actTypeOptions = ['all', 'group', 'solo', 'unit'] as const
const unitGroups = new Set(['ARTMS', 'NCT DREAM', 'NCT WISH', 'VIVIZ'])

const releases = (releaseRows as ReleaseRow[])
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

function App() {
  const latestMonthKey = getLatestMonthKey(releases)
  const [selectedMonthKey, setSelectedMonthKey] = useState(latestMonthKey)
  const [selectedDayIso, setSelectedDayIso] = useState('')
  const [search, setSearch] = useState('')
  const [selectedReleaseKind, setSelectedReleaseKind] = useState<(typeof releaseKindOptions)[number]>('all')
  const [selectedActType, setSelectedActType] = useState<(typeof actTypeOptions)[number]>('all')
  const [language, setLanguage] = useState<Language>(readInitialLanguage)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const copy = TRANSLATIONS[language]
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
                          {item.group}
                        </span>
                      ))}
                      {dayUpcomingSignals
                        .slice(0, Math.max(0, 2 - dayReleases.length))
                        .map((item) => (
                          <span
                            key={`${item.group}-${item.scheduled_date}-${item.headline}`}
                            className={`release-chip release-chip-upcoming-${item.date_status}`}
                          >
                            {item.group}
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
                        <p className="feed-group">{item.group}</p>
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
                        <p className="detail-group">{item.group}</p>
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
                    </div>
                  </article>
                  ) : (
                  <article
                    key={`${item.group}-${item.scheduled_date}-${item.headline}`}
                    className={`detail-card detail-card-signal detail-card-signal-${item.date_status}`}
                  >
                    <div>
                      <div className="signal-head">
                        <p className="detail-group">{item.group}</p>
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
                      <p className="feed-group">{item.group}</p>
                      <span className="signal-badge">{describeRelease(item, language)}</span>
                    </div>
                    <h3>{item.title}</h3>
                  </div>
                  <time>{shortDateFormatter.format(item.dateValue)}</time>
                </article>
              ))}
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
    </div>
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
