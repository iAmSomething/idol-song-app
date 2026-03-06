import { useState } from 'react'
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

type VerifiedRelease = ReleaseFact & {
  group: string
  artist_name_mb: string
  artist_mbid: string
  artist_source: string
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

const releases = (releaseRows as ReleaseRow[])
  .flatMap((row) => expandReleaseRow(row))
  .sort((left, right) => right.dateValue.getTime() - left.dateValue.getTime())

const unresolved = unresolvedRows as UnresolvedRow[]
const watchlist = watchlistRows as WatchlistRow[]
const upcomingCandidates = upcomingCandidateRows as UpcomingCandidateRow[]

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
})

const weekdays = Array.from({ length: 7 }, (_, index) => {
  const reference = new Date(Date.UTC(2026, 0, 4 + index))
  return weekdayFormatter.format(reference)
})

const monthKeys = Array.from(
  new Set(
    releases.map((item) => {
      return getMonthKey(item.dateValue)
    }),
  ),
).sort()

const watchStatusCounts = watchlist.reduce<Record<string, number>>((counts, row) => {
  counts[row.tracking_status] = (counts[row.tracking_status] ?? 0) + 1
  return counts
}, {})

function App() {
  const latestMonthKey = monthKeys.at(-1) ?? getMonthKey(new Date())
  const [selectedMonthKey, setSelectedMonthKey] = useState(latestMonthKey)
  const [selectedDayIso, setSelectedDayIso] = useState('')
  const [search, setSearch] = useState('')

  const filteredReleases = releases.filter((item) => {
    const needle = search.trim().toLowerCase()
    if (!needle) {
      return true
    }

    return item.group.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle)
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

  const selectedMonthDate = monthKeyToDate(selectedMonthKey)
  const monthDays = buildCalendarDays(selectedMonthDate)
  const releasesByDate = groupByDate(filteredReleases)
  const monthReleases = filteredReleases.filter((item) => getMonthKey(item.dateValue) === selectedMonthKey)

  const effectiveSelectedDayIso =
    selectedDayIso && releasesByDate.has(selectedDayIso)
      ? selectedDayIso
      : monthReleases[0]?.isoDate ?? filteredReleases[0]?.isoDate ?? ''

  const selectedDayReleases = effectiveSelectedDayIso
    ? releasesByDate.get(effectiveSelectedDayIso) ?? []
    : []

  const latestRelease = filteredReleases[0]
  const earliestRelease = filteredReleases.at(-1)
  const monthIndex = monthKeys.indexOf(selectedMonthKey)

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">K-pop Release Calendar</p>
          <h1>Calendar UI plus a weekly comeback-intelligence cycle.</h1>
          <p className="hero-text">
            Verified releases stay in the calendar. A wider watchlist keeps filtered
            and dormant teams in circulation, then a weekly scan looks for future
            comeback signals from news and official source trails.
          </p>
        </div>
        <div className="hero-stats">
          <StatCard label="Verified releases" value={String(filteredReleases.length)} />
          <StatCard label="Watch targets" value={String(watchlist.length)} />
          <StatCard label="Upcoming signals" value={String(filteredUpcoming.length)} />
          <StatCard label="Needs review" value={String(unresolved.length)} />
        </div>
      </header>

      <main className="layout">
        <section className="panel panel-calendar">
          <div className="panel-top">
            <div>
              <p className="panel-label">Monthly grid</p>
              <h2>{monthFormatter.format(selectedMonthDate)}</h2>
            </div>
            <div className="calendar-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setSelectedMonthKey(monthKeys[Math.max(monthIndex - 1, 0)] ?? selectedMonthKey)}
                disabled={monthIndex <= 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setSelectedMonthKey(
                    monthKeys[Math.min(monthIndex + 1, monthKeys.length - 1)] ?? selectedMonthKey,
                  )
                }
                disabled={monthIndex === -1 || monthIndex >= monthKeys.length - 1}
              >
                Next
              </button>
            </div>
          </div>

          <div className="toolbar">
            <label className="search-field">
              <span>Search group, song, or album</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="BLACKPINK, Hearts2Hearts, DEADLINE, RUDE!..."
              />
            </label>
            <div className="summary-pill">
              <span>{monthReleases.length}</span>
              <span>verified events in this month</span>
            </div>
          </div>

          <div className="coverage-strip">
            <StatusPill label="Recent release" value={watchStatusCounts.recent_release ?? 0} tone="fresh" />
            <StatusPill label="Filtered but watched" value={watchStatusCounts.filtered_out ?? 0} tone="muted" />
            <StatusPill label="Needs manual review" value={watchStatusCounts.needs_manual_review ?? 0} tone="warn" />
            <StatusPill label="Manual watch-only" value={watchStatusCounts.watch_only ?? 0} tone="accent" />
          </div>

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
                const isSelected = day.iso === effectiveSelectedDayIso

                return (
                  <button
                    type="button"
                    key={day.iso}
                    className={[
                      'calendar-cell',
                      day.inMonth ? '' : 'calendar-cell-muted',
                      dayReleases.length ? 'calendar-cell-active' : '',
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
                      {dayReleases.length > 2 ? (
                        <span className="release-chip release-chip-more">+{dayReleases.length - 2}</span>
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
            <p className="panel-label">Upcoming scan</p>
            <h2>Future comeback signals</h2>
            <div className="feed-list">
              {filteredUpcoming.length ? (
                filteredUpcoming.slice(0, 10).map((item) => (
                  <article key={`${item.group}-${item.scheduled_date}-${item.headline}`} className="signal-row">
                    <div>
                      <div className="signal-head">
                        <p className="feed-group">{item.group}</p>
                        <div className="signal-tags">
                          <span className={`signal-badge signal-badge-${item.tracking_status}`}>
                            {item.tracking_status.replaceAll('_', ' ')}
                          </span>
                          <span className={`signal-badge signal-badge-date-${item.date_status || 'rumor'}`}>
                            {formatDateStatus(item.date_status)}
                          </span>
                          <span
                            className={`signal-badge signal-badge-confidence-${getConfidenceTone(item.confidence)}`}
                          >
                            {getConfidenceTone(item.confidence)} confidence
                          </span>
                        </div>
                      </div>
                      <h3>{item.headline}</h3>
                      <p className="signal-meta">
                        {formatSourceType(item.source_type)} · {item.source_domain || 'source pending'} ·{' '}
                        {item.scheduled_date || 'TBD'}
                      </p>
                      {item.evidence_summary ? (
                        <p className="signal-evidence">{item.evidence_summary}</p>
                      ) : null}
                    </div>
                    <div className="signal-date-wrap">
                      <time>{item.scheduled_date || 'TBD'}</time>
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        <span className="signal-link-muted">No source link</span>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-copy">No upcoming candidates captured yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <p className="panel-label">Selected day</p>
            <h2>{effectiveSelectedDayIso || 'No release selected'}</h2>
            <div className="detail-list">
              {selectedDayReleases.length ? (
                selectedDayReleases.map((item) => (
                  <article key={`${item.group}-${item.stream}-${item.title}`} className="detail-card">
                    <div>
                      <div className="signal-head">
                        <p className="detail-group">{item.group}</p>
                        <span className="signal-badge">{describeRelease(item)}</span>
                      </div>
                      <h3>{item.title}</h3>
                    </div>
                    <div className="detail-links">
                      <a href={item.source} target="_blank" rel="noreferrer">
                        Release source
                      </a>
                      <a href={item.artist_source} target="_blank" rel="noreferrer">
                        Artist source
                      </a>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-copy">No verified release on this date.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <p className="panel-label">Recent feed</p>
            <h2>Newest releases first</h2>
            <div className="feed-list">
              {filteredReleases.slice(0, 10).map((item) => (
                <article key={`${item.group}-${item.stream}-${item.title}`} className="feed-row">
                  <div>
                    <div className="signal-head">
                      <p className="feed-group">{item.group}</p>
                      <span className="signal-badge">{describeRelease(item)}</span>
                    </div>
                    <h3>{item.title}</h3>
                  </div>
                  <time>{shortDateFormatter.format(item.dateValue)}</time>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="panel-label">Data state</p>
            <h2>Pipeline notes</h2>
            <div className="meta-grid">
              <MetaItem
                label="Latest verified"
                value={latestRelease ? `${latestRelease.group} · ${latestRelease.date}` : 'n/a'}
              />
              <MetaItem
                label="Earliest in range"
                value={earliestRelease ? `${earliestRelease.group} · ${earliestRelease.date}` : 'n/a'}
              />
              <MetaItem label="Open questions" value={unresolved.map((item) => item.group).join(', ')} />
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

function formatSourceType(sourceType: string) {
  switch (sourceType) {
    case 'agency_notice':
      return 'Agency notice'
    case 'weverse_notice':
      return 'Weverse notice'
    case 'news_rss':
      return 'News RSS'
    default:
      return 'Source pending'
  }
}

function formatDateStatus(dateStatus: UpcomingCandidateRow['date_status']) {
  switch (dateStatus) {
    case 'confirmed':
      return 'confirmed'
    case 'scheduled':
      return 'scheduled'
    default:
      return 'rumor'
  }
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
          stream: key === 'latest_song' ? 'song' : 'album',
          dateValue: new Date(`${release.date}T00:00:00`),
          isoDate: release.date,
        },
      ]
    })
}

function describeRelease(item: VerifiedRelease) {
  return `${item.stream} · ${item.release_kind}`
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

export default App
