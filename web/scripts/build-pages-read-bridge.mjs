import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { suppressReleasedExactUpcoming } from './lib/pagesReadBridgeCalendar.mjs'
import { readPreferredBridgeJson } from './lib/pagesReadBridgeSources.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')
const bridgeBaseRoot = path.join(webRoot, 'public', '__bridge')
const bridgeRoot = path.join(bridgeBaseRoot, 'v1')
const normalizedApiBaseUrl = normalizeApiBaseUrl(process.env.VITE_API_BASE_URL ?? '')
const declaredTargetEnvironment = normalizeTargetEnvironment(process.env.VITE_BACKEND_TARGET_ENV ?? '')
const runtimeMode = normalizedApiBaseUrl ? 'api' : 'bridge'
const targetClassification = classifyBackendTarget(normalizedApiBaseUrl)
const targetEnvironment = declaredTargetEnvironment || (runtimeMode === 'bridge' ? 'bridge' : targetClassification)
const effectiveTarget = normalizedApiBaseUrl || '/__bridge/v1'

const artistProfiles = await readPreferredBridgeJson(repoRoot, 'artistProfiles.json')
const releaseRows = await readPreferredBridgeJson(repoRoot, 'releases.json')
const releaseDetails = await readPreferredBridgeJson(repoRoot, 'releaseDetails.json')
const releaseArtwork = await readPreferredBridgeJson(repoRoot, 'releaseArtwork.json')
const upcomingCandidates = await readPreferredBridgeJson(repoRoot, 'upcomingCandidates.json')
const watchlist = await readPreferredBridgeJson(repoRoot, 'watchlist.json')

const artistProfileByGroup = new Map(artistProfiles.map((row) => [row.group, row]))
const artworkByReleaseKey = new Map(
  releaseArtwork.map((row) => [
    getReleaseKey(row.group, row.release_title, row.release_date, normalizeReleaseStream(row.stream, row.release_kind)),
    row,
  ]),
)

await rm(bridgeBaseRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
await mkdir(path.join(bridgeRoot, 'calendar', 'months'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'releases', 'lookups'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'releases', 'details'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'meta'), { recursive: true })

const releaseLookupEntries = new Map()
let releaseDetailCount = 0

for (const row of selectBestReleaseDetailRows(releaseDetails)) {
  const stream = normalizeReleaseStream(row.stream, row.release_kind)
  const releaseKey = getReleaseKey(row.group, row.release_title, row.release_date, stream)
  const releaseId = `bridge-release-${hashBridgeKey(releaseKey)}`
  const entitySlug = artistProfileByGroup.get(row.group)?.slug ?? slugifyGroup(row.group)
  const detailPayload = buildReleaseDetailPayload(row, releaseId, artworkByReleaseKey.get(releaseKey))

  await writeBridgeJson(path.join(bridgeRoot, 'releases', 'details', `${releaseId}.json`), {
    meta: {
      request_id: `bridge-release-detail-${releaseId}`,
    },
    data: detailPayload,
  })
  releaseDetailCount += 1

  const canonicalPath = buildCanonicalReleasePath(entitySlug, row.release_title, row.release_date, stream)
  const score = getReleaseDetailScore(row)
  for (const lookupDate of expandLookupDates(row.release_date)) {
    const lookupId = buildReleaseLookupAssetId(entitySlug, row.release_title, lookupDate, stream)
    const current = releaseLookupEntries.get(lookupId)
    if (!current || score > current.score) {
      releaseLookupEntries.set(lookupId, {
        score,
        payload: {
          meta: {
            request_id: `bridge-release-lookup-${lookupId}`,
          },
          data: {
            release_id: releaseId,
            canonical_path: canonicalPath,
          },
        },
      })
    }
  }
}

for (const [lookupId, entry] of releaseLookupEntries) {
  await writeBridgeJson(path.join(bridgeRoot, 'releases', 'lookups', `${lookupId}.json`), entry.payload)
}

const calendarPayloads = buildCalendarPayloads(releaseRows, upcomingCandidates, artistProfileByGroup)
let calendarMonthCount = 0
for (const [monthKey, payload] of calendarPayloads) {
  const suppressedPayload = suppressReleasedExactUpcoming(payload)
  await writeBridgeJson(path.join(bridgeRoot, 'calendar', 'months', `${monthKey}.json`), {
    meta: {
      request_id: `bridge-calendar-${monthKey}`,
    },
    data: suppressedPayload,
  })
  calendarMonthCount += 1
}

const radarPayload = buildRadarPayload(artistProfiles, watchlist, upcomingCandidates)
await writeBridgeJson(path.join(bridgeRoot, 'radar.json'), {
  meta: {
    request_id: 'bridge-radar',
  },
  data: radarPayload,
})

await writeBridgeJson(path.join(bridgeRoot, 'meta', 'backend-target.json'), {
  meta: {
    request_id: 'bridge-backend-target',
  },
  data: {
    generated_at: new Date().toISOString(),
    runtime_mode: runtimeMode,
    target_environment: targetEnvironment,
    target_classification: targetClassification,
    configured_api_base_url: normalizedApiBaseUrl || null,
    effective_target: effectiveTarget,
    bridge_base_url: '/__bridge/v1',
    diagnostics_path: '/__bridge/v1/meta/backend-target.json',
    surfaces: {
      search: runtimeMode,
      entity_detail: runtimeMode,
      release_detail: runtimeMode,
      calendar_month: runtimeMode,
      radar: runtimeMode,
    },
  },
})

console.log(
  JSON.stringify(
    {
      bridgeRoot: path.relative(repoRoot, bridgeRoot),
      runtimeMode,
      targetEnvironment,
      targetClassification,
      effectiveTarget,
      calendarMonthCount,
      releaseDetailCount,
      releaseLookupCount: releaseLookupEntries.size,
      radarLongGapCount: radarPayload.long_gap.length,
      radarRookieCount: radarPayload.rookie.length,
    },
    null,
    2,
  ),
)

function buildCalendarPayloads(releases, upcomingRows, artistProfileMap) {
  const verifiedByMonth = new Map()
  const exactUpcomingByMonth = new Map()
  const monthOnlyByMonth = new Map()

  for (const releaseRow of releases) {
    for (const release of expandReleaseFacts(releaseRow, artistProfileMap)) {
      pushMapArray(verifiedByMonth, release.release_date.slice(0, 7), release)
    }
  }

  for (const candidate of upcomingRows) {
    const normalized = buildUpcomingItem(candidate, artistProfileMap)
    if (!normalized) {
      continue
    }

    if (normalized.date_precision === 'exact' && normalized.scheduled_date) {
      pushMapArray(exactUpcomingByMonth, normalized.scheduled_date.slice(0, 7), normalized)
      continue
    }

    if (normalized.date_precision === 'month_only' && normalized.scheduled_month) {
      pushMapArray(monthOnlyByMonth, normalized.scheduled_month, normalized)
    }
  }

  const monthKeys = Array.from(
    new Set([...verifiedByMonth.keys(), ...exactUpcomingByMonth.keys(), ...monthOnlyByMonth.keys()]),
  ).sort()
  const payloads = new Map()

  for (const monthKey of monthKeys) {
    const verifiedRows = (verifiedByMonth.get(monthKey) ?? []).sort(compareVerifiedRows)
    const exactUpcomingRows = (exactUpcomingByMonth.get(monthKey) ?? []).sort(compareUpcomingRows)
    const monthOnlyRows = (monthOnlyByMonth.get(monthKey) ?? []).sort(compareUpcomingRows)
    const dayMap = new Map()

    for (const release of verifiedRows) {
      const day = readCalendarDay(dayMap, release.release_date)
      day.verified_releases.push(release)
    }

    for (const signal of exactUpcomingRows) {
      const day = readCalendarDay(dayMap, signal.scheduled_date)
      day.exact_upcoming.push(signal)
    }

    payloads.set(monthKey, {
      summary: {
        verified_count: verifiedRows.length,
        exact_upcoming_count: exactUpcomingRows.length,
        month_only_upcoming_count: monthOnlyRows.length,
      },
      nearest_upcoming: exactUpcomingRows[0] ?? null,
      days: Array.from(dayMap.values()).sort((left, right) => left.date.localeCompare(right.date)),
      month_only_upcoming: monthOnlyRows,
      verified_list: verifiedRows,
      scheduled_list: [...exactUpcomingRows, ...monthOnlyRows],
    })
  }

  return payloads
}

function buildRadarPayload(artistProfilesRows, watchlistRows, upcomingRows) {
  const latestSignalByGroup = new Map()

  for (const row of upcomingRows) {
    const current = latestSignalByGroup.get(row.group)
    if (!current || compareUpcomingRows(row, current) < 0) {
      latestSignalByGroup.set(row.group, row)
    }
  }

  const longGap = watchlistRows
    .filter((row) => row.watch_reason === 'long_gap')
    .map((row) => {
      const profile = artistProfilesRows.find((item) => item.group === row.group) ?? null
      const latestSignal = latestSignalByGroup.get(row.group) ?? null
      return {
        entity_slug: profile?.slug ?? slugifyGroup(row.group),
        display_name: profile?.display_name ?? row.group,
        watch_reason: 'long_gap',
        latest_release: {
          release_title: row.latest_release_title,
          release_date: row.latest_release_date,
          stream: normalizeReleaseStream('watchlist', row.latest_release_kind),
          release_kind: row.latest_release_kind,
        },
        gap_days: getGapDays(row.latest_release_date),
        has_upcoming_signal: Boolean(latestSignal),
        latest_signal: latestSignal
          ? buildRadarUpcomingSummary(latestSignal, profile?.slug ?? slugifyGroup(row.group), profile?.display_name ?? row.group)
          : null,
      }
    })
    .sort((left, right) => {
      if ((right.gap_days ?? 0) !== (left.gap_days ?? 0)) {
        return (right.gap_days ?? 0) - (left.gap_days ?? 0)
      }
      return left.display_name.localeCompare(right.display_name)
    })

  const rookie = artistProfilesRows
    .filter((row) => Number.isFinite(row.debut_year))
    .sort((left, right) => {
      if ((right.debut_year ?? 0) !== (left.debut_year ?? 0)) {
        return (right.debut_year ?? 0) - (left.debut_year ?? 0)
      }
      return left.group.localeCompare(right.group)
    })
    .map((row) => {
      const latestWatchRow = watchlistRows.find((item) => item.group === row.group) ?? null
      const latestSignal = latestSignalByGroup.get(row.group) ?? null
      return {
        entity_slug: row.slug,
        display_name: row.display_name ?? row.group,
        debut_year: row.debut_year,
        latest_release: latestWatchRow
          ? {
              release_title: latestWatchRow.latest_release_title,
              release_date: latestWatchRow.latest_release_date,
              stream: normalizeReleaseStream('watchlist', latestWatchRow.latest_release_kind),
              release_kind: latestWatchRow.latest_release_kind,
            }
          : null,
        has_upcoming_signal: Boolean(latestSignal),
        latest_signal: latestSignal ? buildRadarUpcomingSummary(latestSignal, row.slug, row.display_name ?? row.group) : null,
      }
    })

  return {
    long_gap: longGap,
    rookie,
  }
}

function buildRadarUpcomingSummary(row, entitySlug, displayName) {
  return {
    upcoming_signal_id: row.event_key ?? null,
    entity_slug: entitySlug,
    display_name: displayName,
    headline: row.headline,
    scheduled_date: row.scheduled_date || null,
    scheduled_month: row.scheduled_month || null,
    date_precision: row.date_precision,
    date_status: row.date_status || 'rumor',
    confidence_score: Number.isFinite(row.confidence) ? row.confidence : null,
    release_format: row.release_format || null,
  }
}

function expandReleaseFacts(row, artistProfileMap) {
  const entitySlug = artistProfileMap.get(row.group)?.slug ?? slugifyGroup(row.group)
  const displayName = artistProfileMap.get(row.group)?.display_name ?? row.group
  const releases = []

  for (const [stream, fact] of [
    ['song', row.latest_song],
    ['album', row.latest_album],
  ]) {
    if (!fact || !fact.title || !fact.date) {
      continue
    }

    releases.push({
      release_id: `bridge-release-${hashBridgeKey(getReleaseKey(row.group, fact.title, fact.date, normalizeReleaseStream(stream, fact.release_kind)))}`,
      entity_slug: entitySlug,
      display_name: displayName,
      release_title: fact.title,
      stream: normalizeReleaseStream(stream, fact.release_kind),
      release_kind: fact.release_kind ?? null,
      release_date: fact.date,
    })
  }

  return releases
}

function buildUpcomingItem(row, artistProfileMap) {
  const entitySlug = artistProfileMap.get(row.group)?.slug ?? slugifyGroup(row.group)
  const displayName = artistProfileMap.get(row.group)?.display_name ?? row.group
  const datePrecision =
    row.date_precision === 'exact' || row.date_precision === 'month_only' || row.date_precision === 'unknown'
      ? row.date_precision
      : row.scheduled_date
        ? 'exact'
        : row.scheduled_month
          ? 'month_only'
          : 'unknown'

  return {
    upcoming_signal_id: row.event_key ?? null,
    entity_slug: entitySlug,
    display_name: displayName,
    headline: row.headline,
    scheduled_date: row.scheduled_date || null,
    scheduled_month: row.scheduled_month || null,
    date_precision: datePrecision,
    date_status: row.date_status || 'rumor',
    confidence_score: Number.isFinite(row.confidence) ? row.confidence : null,
    release_format: row.release_format || null,
  }
}

function buildReleaseDetailPayload(row, releaseId, artwork) {
  return {
    release: {
      release_id: releaseId,
      release_title: row.release_title,
      release_date: row.release_date,
      stream: normalizeReleaseStream(row.stream, row.release_kind),
      release_kind: row.release_kind ?? null,
    },
    artwork: artwork
      ? {
          cover_image_url: readString(artwork.cover_image_url) || null,
          thumbnail_image_url: readString(artwork.thumbnail_image_url) || null,
          artwork_source_type: readString(artwork.artwork_source_type) || null,
          artwork_source_url: readString(artwork.artwork_source_url) || null,
        }
      : null,
    service_links: {
      spotify: {
        url: readString(row.spotify_url) || null,
      },
      youtube_music: {
        url: readString(row.youtube_music_url) || null,
      },
    },
    tracks: Array.isArray(row.tracks)
      ? row.tracks.map((track, index) => ({
          order: Number.isFinite(track.order) ? track.order : index + 1,
          title: track.title,
          is_title_track: Boolean(track.is_title_track),
        }))
      : [],
    mv:
      row.youtube_video_url || row.youtube_video_id || row.youtube_video_status || row.youtube_video_provenance
        ? {
            url: readString(row.youtube_video_url) || null,
            video_id: readString(row.youtube_video_id) || null,
            status: readString(row.youtube_video_status) || null,
            provenance: readString(row.youtube_video_provenance) || null,
          }
        : null,
    notes: readString(row.notes) || null,
  }
}

function selectBestReleaseDetailRows(rows) {
  const bestRows = new Map()

  for (const row of rows) {
    const stream = normalizeReleaseStream(row.stream, row.release_kind)
    const key = getReleaseKey(row.group, row.release_title, row.release_date, stream)
    const current = bestRows.get(key)

    if (!current || getReleaseDetailScore(row) > getReleaseDetailScore(current)) {
      bestRows.set(key, row)
    }
  }

  return Array.from(bestRows.values())
}

function getReleaseDetailScore(row) {
  const detailWeight =
    row.detail_status === 'verified'
      ? 5
      : row.detail_status === 'manual_override'
        ? 4
        : row.detail_status === 'inferred'
          ? 3
          : 1
  const titleWeight =
    row.title_track_status === 'verified'
      ? 4
      : row.title_track_status === 'manual_override'
        ? 3
        : row.title_track_status === 'review_needed'
          ? 2
          : 0
  const mvWeight =
    row.youtube_video_status === 'manual_override'
      ? 4
      : row.youtube_video_status === 'relation_match'
        ? 3
        : row.youtube_video_status === 'needs_review'
          ? 2
          : 0
  const serviceWeight = (row.spotify_url ? 1 : 0) + (row.youtube_music_url ? 1 : 0)
  const trackWeight = Array.isArray(row.tracks) ? row.tracks.length : 0
  return detailWeight * 100 + titleWeight * 25 + mvWeight * 10 + serviceWeight * 4 + trackWeight
}

function compareVerifiedRows(left, right) {
  const dateCompare = left.release_date.localeCompare(right.release_date)
  if (dateCompare !== 0) {
    return dateCompare
  }

  return left.release_title.localeCompare(right.release_title)
}

function compareUpcomingRows(left, right) {
  const leftDate = left.scheduled_date || `${left.scheduled_month || ''}-99`
  const rightDate = right.scheduled_date || `${right.scheduled_month || ''}-99`
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate)
  }

  return right.headline.localeCompare(left.headline)
}

function readCalendarDay(dayMap, isoDate) {
  const existing = dayMap.get(isoDate)
  if (existing) {
    return existing
  }

  const next = {
    date: isoDate,
    verified_releases: [],
    exact_upcoming: [],
  }
  dayMap.set(isoDate, next)
  return next
}

function expandLookupDates(isoDate) {
  const dates = [isoDate]
  const previous = shiftIsoDate(isoDate, -1)
  const next = shiftIsoDate(isoDate, 1)

  if (previous) {
    dates.push(previous)
  }
  if (next) {
    dates.push(next)
  }

  return dates
}

function shiftIsoDate(isoDate, offsetDays) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) {
    return null
  }

  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays))
  return next.toISOString().slice(0, 10)
}

function buildCanonicalReleasePath(entitySlug, releaseTitle, releaseDate, stream) {
  const releaseSlug = slugifyPathSegment(releaseTitle) || 'release'
  const params = new URLSearchParams()
  params.set('date', releaseDate)
  params.set('stream', stream)
  return `/artists/${entitySlug}/releases/${releaseSlug}?${params.toString()}`
}

function buildReleaseLookupAssetId(entitySlug, releaseTitle, releaseDate, stream) {
  return `lookup-${hashBridgeKey([entitySlug, releaseTitle, releaseDate, stream].join('::'))}`
}

function getReleaseKey(group, releaseTitle, releaseDate, stream) {
  return [group, releaseTitle, releaseDate, stream].join('::')
}

function hashBridgeKey(value) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeApiBaseUrl(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return ''
  }

  return normalized.replace(/\/+$/, '')
}

function normalizeTargetEnvironment(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'production' || normalized === 'preview' || normalized === 'local' || normalized === 'bridge'
    ? normalized
    : ''
}

function classifyBackendTarget(apiBaseUrl) {
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

function normalizeReleaseStream(stream, releaseKind) {
  if (stream === 'album' || releaseKind === 'album' || releaseKind === 'ep') {
    return 'album'
  }
  return 'song'
}

function slugifyPathSegment(value) {
  return String(value)
    .normalize('NFKC')
    .replace(/[×✕]/g, 'x')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugifyGroup(group) {
  return String(group)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getGapDays(isoDate) {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  const today = Date.UTC(2026, 2, 9)
  return Math.max(0, Math.floor((today - parsed) / 86_400_000))
}

function pushMapArray(map, key, value) {
  const rows = map.get(key)
  if (rows) {
    rows.push(value)
    return
  }

  map.set(key, [value])
}

function readString(value) {
  return typeof value === 'string' ? value : ''
}

async function writeBridgeJson(targetPath, payload) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`)
}

async function readJson(targetPath) {
  const contents = await readFile(targetPath, 'utf8')
  return JSON.parse(contents)
}
