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
const releaseHistory = await readPreferredBridgeJson(repoRoot, 'releaseHistory.json')
const upcomingCandidates = await readPreferredBridgeJson(repoRoot, 'upcomingCandidates.json')
const watchlist = await readPreferredBridgeJson(repoRoot, 'watchlist.json')

const artistProfileByGroup = new Map(artistProfiles.map((row) => [row.group, row]))
const releaseRowByGroup = new Map(releaseRows.map((row) => [row.group, row]))
const releaseHistoryByGroup = new Map(releaseHistory.map((row) => [row.group, row]))
const watchlistByGroup = new Map(watchlist.map((row) => [row.group, row]))
const bestReleaseDetailRows = selectBestReleaseDetailRows(releaseDetails)
const bridgeReleaseDetailRows = buildBridgeReleaseDetailRows({
  explicitRows: bestReleaseDetailRows,
  releaseRows,
  releaseHistoryRows: releaseHistory,
})
const releaseDetailByKey = new Map(
  bridgeReleaseDetailRows.map((row) => [
    getReleaseKey(row.group, row.release_title, row.release_date, normalizeReleaseStream(row.stream, row.release_kind)),
    row,
  ]),
)
const artworkByReleaseKey = new Map(
  releaseArtwork.map((row) => [
    getReleaseKey(row.group, row.release_title, row.release_date, normalizeReleaseStream(row.stream, row.release_kind)),
    row,
  ]),
)

await rm(bridgeBaseRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
await mkdir(path.join(bridgeRoot, 'calendar', 'months'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'entities'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'releases', 'lookups'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'releases', 'details'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'meta'), { recursive: true })
await mkdir(path.join(bridgeRoot, 'search'), { recursive: true })

const releaseLookupEntries = new Map()
let releaseDetailCount = 0

for (const row of bridgeReleaseDetailRows) {
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

const entityPayloads = buildEntityPayloads({
  artistProfilesRows: artistProfiles,
  releaseRows,
  releaseRowByGroup,
  releaseHistoryByGroup,
  upcomingRows: upcomingCandidates,
  watchlistByGroup,
  releaseDetailByKey,
  artworkByReleaseKey,
})
let entityDetailCount = 0
for (const [entitySlug, payload] of entityPayloads) {
  await writeBridgeJson(path.join(bridgeRoot, 'entities', `${entitySlug}.json`), {
    meta: {
      request_id: `bridge-entity-${entitySlug}`,
    },
    data: payload,
  })
  entityDetailCount += 1
}

const searchIndexPayload = buildBridgeSearchIndex({
  entityPayloads,
  releaseDetailRows: bridgeReleaseDetailRows,
  upcomingRows: upcomingCandidates,
  artistProfileByGroup,
  suppressedUpcomingState: collectSuppressedUpcomingState(releaseRows),
})
await writeBridgeJson(path.join(bridgeRoot, 'search', 'index.json'), {
  meta: {
    request_id: 'bridge-search-index',
  },
  data: searchIndexPayload,
})

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
      entityDetailCount,
      releaseDetailCount,
      releaseLookupCount: releaseLookupEntries.size,
      searchEntityCount: searchIndexPayload.entities.length,
      searchReleaseCount: searchIndexPayload.releases.length,
      searchUpcomingCount: searchIndexPayload.upcoming.length,
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

function buildEntityPayloads({
  artistProfilesRows,
  releaseRows,
  releaseRowByGroup,
  releaseHistoryByGroup,
  upcomingRows,
  watchlistByGroup,
  releaseDetailByKey,
  artworkByReleaseKey,
}) {
  const payloads = new Map()
  const groups = Array.from(
    new Set([
      ...artistProfilesRows.map((row) => row.group),
      ...releaseRows.map((row) => row.group),
      ...Array.from(releaseHistoryByGroup.keys()),
      ...upcomingRows.map((row) => row.group),
      ...Array.from(watchlistByGroup.keys()),
    ]),
  ).sort()
  const suppressedUpcomingState = collectSuppressedUpcomingState(releaseRows)
  const upcomingByGroup = groupRowsByKey(upcomingRows, (row) => row.group)

  for (const group of groups) {
    const profile = artistProfileByGroup.get(group) ?? null
    const releaseRow = releaseRowByGroup.get(group) ?? null
    const releaseHistoryRow = releaseHistoryByGroup.get(group) ?? null
    const watchlistRow = watchlistByGroup.get(group) ?? null
    const entitySlug = profile?.slug ?? slugifyGroup(group)
    const displayName = profile?.display_name ?? group
    const upcomingForGroup = (upcomingByGroup.get(group) ?? [])
      .filter((row) => !isSuppressedUpcomingRow(row, suppressedUpcomingState, entitySlug))
      .sort(compareUpcomingRows)
    const nextUpcoming = buildEntityUpcomingSummary(upcomingForGroup[0], entitySlug, displayName)
    const sourceTimeline = upcomingForGroup.slice(0, 8).map((row) => buildEntityTimelineEntry(row))
    const recentAlbums = buildEntityRecentAlbums(group, releaseHistoryRow, releaseDetailByKey, artworkByReleaseKey)
    const latestRelease = buildEntityLatestReleaseSummary(
      group,
      releaseRow,
      releaseDetailByKey,
      artworkByReleaseKey,
      recentAlbums,
    )

    payloads.set(entitySlug, {
      identity: {
        entity_slug: entitySlug,
        display_name: displayName,
        canonical_name: group,
        agency_name: profile?.agency ?? null,
        badge_image_url: profile?.representative_image_url ?? null,
        representative_image_url: profile?.representative_image_url ?? null,
      },
      official_links: {
        youtube: profile?.official_youtube_url ?? null,
        x: profile?.official_x_url ?? null,
        instagram: profile?.official_instagram_url ?? null,
      },
      youtube_channels: {
        primary_team_channel_url: profile?.official_youtube_url ?? null,
        mv_allowlist_urls: [],
      },
      tracking_state: {
        tier: watchlistRow?.tier ?? null,
        tracking_status: watchlistRow?.tracking_status ?? null,
      },
      next_upcoming: nextUpcoming,
      latest_release: latestRelease,
      recent_albums: recentAlbums,
      source_timeline: sourceTimeline,
      artist_source_url: releaseRow?.artist_source ?? releaseHistoryRow?.artist_source ?? null,
    })
  }

  return payloads
}

function buildBridgeSearchIndex({
  entityPayloads,
  releaseDetailRows,
  upcomingRows,
  artistProfileByGroup,
  suppressedUpcomingState,
}) {
  const entities = Array.from(entityPayloads.values()).map((payload) => {
    const entitySlug = payload.identity?.entity_slug ?? ''
    const group = payload.identity?.canonical_name ?? payload.identity?.display_name ?? entitySlug
    const profile = artistProfileByGroup.get(group) ?? null

    return {
      entity_slug: entitySlug,
      canonical_path: `/artists/${entitySlug}`,
      display_name: payload.identity?.display_name ?? group,
      canonical_name: payload.identity?.canonical_name ?? group,
      entity_type: 'group',
      agency_name: payload.identity?.agency_name ?? null,
      latest_release: payload.latest_release ?? null,
      next_upcoming: payload.next_upcoming ?? null,
      search_terms: dedupeSearchTerms([
        payload.identity?.display_name,
        payload.identity?.canonical_name,
        group,
        ...(Array.isArray(profile?.aliases) ? profile.aliases : []),
        ...(Array.isArray(profile?.search_aliases) ? profile.search_aliases : []),
      ]),
    }
  })

  const releases = releaseDetailRows.map((row) => {
    const stream = normalizeReleaseStream(row.stream, row.release_kind)
    const releaseKey = getReleaseKey(row.group, row.release_title, row.release_date, stream)
    const releaseId = `bridge-release-${hashBridgeKey(releaseKey)}`
    const profile = artistProfileByGroup.get(row.group) ?? null
    const entitySlug = profile?.slug ?? slugifyGroup(row.group)
    return {
      release_id: releaseId,
      detail_path: buildCanonicalReleasePath(entitySlug, row.release_title, row.release_date, stream),
      entity_path: `/artists/${entitySlug}`,
      entity_slug: entitySlug,
      display_name: profile?.display_name ?? row.group,
      release_title: row.release_title,
      release_date: row.release_date,
      stream,
      release_kind: row.release_kind ?? null,
      release_format: row.release_kind ?? null,
      search_terms: dedupeSearchTerms([
        row.release_title,
        `${row.group} ${row.release_title}`,
        `${profile?.display_name ?? row.group} ${row.release_title}`,
        ...(Array.isArray(profile?.search_aliases) ? profile.search_aliases.map((alias) => `${alias} ${row.release_title}`) : []),
      ]),
    }
  })

  const upcoming = upcomingRows
    .filter((row) => !isSuppressedUpcomingRow(row, suppressedUpcomingState))
    .map((row) => {
      const profile = artistProfileByGroup.get(row.group) ?? null
      const entitySlug = profile?.slug ?? slugifyGroup(row.group)
      return {
        upcoming_signal_id: row.event_key ?? `bridge-upcoming-${hashBridgeKey([row.group, row.headline, row.scheduled_date ?? row.scheduled_month ?? ''].join('::'))}`,
        entity_path: `/artists/${entitySlug}`,
        entity_slug: entitySlug,
        display_name: profile?.display_name ?? row.group,
        headline: row.headline,
        scheduled_date: row.scheduled_date ?? null,
        scheduled_month: row.scheduled_month ?? null,
        date_precision: row.date_precision ?? 'unknown',
        date_status: row.date_status ?? 'rumor',
        release_format: row.release_format ?? null,
        confidence_score: Number.isFinite(row.confidence) ? row.confidence : null,
        source_type: row.source_type ?? null,
        source_url: row.source_url ?? null,
        source_domain: row.source_domain ?? null,
        evidence_summary: row.evidence_summary ?? null,
        search_terms: dedupeSearchTerms([
          row.headline,
          row.group,
          profile?.display_name ?? row.group,
          ...(Array.isArray(profile?.search_aliases) ? profile.search_aliases : []),
        ]),
      }
    })

  return {
    entities,
    releases,
    upcoming,
  }
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

function buildEntityUpcomingSummary(row, entitySlug, displayName) {
  if (!row) {
    return null
  }

  const summary = buildRadarUpcomingSummary(row, entitySlug, displayName)
  return {
    ...summary,
    latest_seen_at: readString(row.published_at) || null,
    source_type: readString(row.source_type) || null,
    source_url: readString(row.source_url) || null,
    source_domain: readString(row.source_domain) || null,
    evidence_summary: readString(row.evidence_summary) || null,
    source_count: Number.isFinite(row.source_count) ? row.source_count : null,
  }
}

function buildEntityTimelineEntry(row) {
  return {
    headline: row.headline,
    source_url: readString(row.source_url) || null,
    source_type: readString(row.source_type) || null,
    source_domain: readString(row.source_domain) || null,
    published_at: readString(row.published_at) || null,
    scheduled_date: readString(row.scheduled_date) || null,
    scheduled_month: readString(row.scheduled_month) || null,
    date_precision: readString(row.date_precision) || null,
    date_status: readString(row.date_status) || null,
    release_format: readString(row.release_format) || null,
    confidence_score: Number.isFinite(row.confidence) ? row.confidence : null,
  }
}

function buildEntityLatestReleaseSummary(group, releaseRow, releaseDetailByKey, artworkByReleaseKey, recentAlbums) {
  if (!releaseRow) {
    return recentAlbums[0] ?? null
  }

  const candidates = []
  for (const [stream, fact] of [
    ['song', releaseRow.latest_song],
    ['album', releaseRow.latest_album],
  ]) {
    const summary = buildEntityReleaseSummary(group, fact, stream, releaseDetailByKey, artworkByReleaseKey)
    if (summary) {
      candidates.push(summary)
    }
  }

  candidates.sort(compareEntityReleaseSummaries)
  return candidates[0] ?? recentAlbums[0] ?? null
}

function buildEntityRecentAlbums(group, releaseHistoryRow, releaseDetailByKey, artworkByReleaseKey) {
  if (!Array.isArray(releaseHistoryRow?.releases)) {
    return []
  }

  return releaseHistoryRow.releases
    .filter((row) => normalizeReleaseStream(row.stream, row.release_kind) === 'album')
    .map((row) => buildEntityReleaseSummary(group, row, row.stream, releaseDetailByKey, artworkByReleaseKey))
    .filter(Boolean)
    .sort(compareEntityReleaseSummaries)
    .slice(0, 8)
}

function buildEntityReleaseSummary(group, fact, stream, releaseDetailByKey, artworkByReleaseKey) {
  if (!fact?.title || !fact?.date) {
    return null
  }

  const normalizedStream = normalizeReleaseStream(stream, fact.release_kind)
  const releaseKey = getReleaseKey(group, fact.title, fact.date, normalizedStream)
  const detailRow = releaseDetailByKey.get(releaseKey) ?? null
  const artwork = artworkByReleaseKey.get(releaseKey) ?? null
  return {
    release_id: `bridge-release-${hashBridgeKey(releaseKey)}`,
    release_title: fact.title,
    release_date: fact.date,
    stream: normalizedStream,
    release_kind: fact.release_kind ?? null,
    release_format: fact.release_format ?? fact.release_kind ?? null,
    representative_song_title: findRepresentativeSongTitle(detailRow),
    spotify_url: readString(detailRow?.spotify_url) || null,
    youtube_music_url: readString(detailRow?.youtube_music_url) || null,
    youtube_mv_url: readString(detailRow?.youtube_video_url) || null,
    source_url: readString(fact.source) || null,
    artwork: buildEntitySummaryArtwork(artwork),
  }
}

function buildEntitySummaryArtwork(artwork) {
  if (!artwork) {
    return null
  }

  return {
    cover_image_url: readString(artwork.cover_image_url) || null,
    thumbnail_image_url: readString(artwork.thumbnail_image_url) || null,
    artwork_source_type: readString(artwork.artwork_source_type) || null,
    artwork_source_url: readString(artwork.artwork_source_url) || null,
    artwork_status: readString(artwork.artwork_status) || null,
  }
}

function findRepresentativeSongTitle(detailRow) {
  if (!detailRow || !Array.isArray(detailRow.tracks)) {
    return null
  }

  return (
    detailRow.tracks.find((track) => Boolean(track?.is_title_track) && readString(track?.title))?.title ??
    readString(detailRow.tracks[0]?.title) ??
    null
  )
}

function compareEntityReleaseSummaries(left, right) {
  const dateCompare = String(right?.release_date ?? '').localeCompare(String(left?.release_date ?? ''))
  if (dateCompare !== 0) {
    return dateCompare
  }

  const streamCompare = String(right?.stream ?? '').localeCompare(String(left?.stream ?? ''))
  if (streamCompare !== 0) {
    return streamCompare
  }

  return String(left?.release_title ?? '').localeCompare(String(right?.release_title ?? ''))
}

function collectSuppressedUpcomingState(releases) {
  const exactDateKeys = new Set()
  const monthKeys = new Set()
  const titleTermsByEntity = new Map()

  for (const releaseRow of releases) {
    for (const fact of expandReleaseFacts(releaseRow, artistProfileByGroup)) {
      const releaseDate = readString(fact.release_date)
      const releaseTitle = normalizeComparableText(readString(fact.release_title))
      if (!releaseDate) {
        continue
      }

      exactDateKeys.add(`${fact.entity_slug}::${releaseDate}`)
      monthKeys.add(`${fact.entity_slug}::${releaseDate.slice(0, 7)}`)
      if (releaseTitle) {
        const currentTerms = titleTermsByEntity.get(fact.entity_slug)
        if (currentTerms) {
          currentTerms.add(releaseTitle)
        } else {
          titleTermsByEntity.set(fact.entity_slug, new Set([releaseTitle]))
        }
      }
    }
  }

  return {
    exactDateKeys,
    monthKeys,
    titleTermsByEntity,
  }
}

function isSuppressedUpcomingRow(row, suppressedUpcomingState, entitySlug = slugifyGroup(row.group)) {
  if (row?.date_precision === 'exact' && row?.scheduled_date) {
    return suppressedUpcomingState.exactDateKeys.has(`${entitySlug}::${row.scheduled_date}`)
  }

  if (row?.date_precision === 'month_only' && row?.scheduled_month) {
    return suppressedUpcomingState.monthKeys.has(`${entitySlug}::${row.scheduled_month}`)
  }

  if (row?.date_precision === 'unknown') {
    const headline = normalizeComparableText(readString(row?.headline))
    const titleTerms = suppressedUpcomingState.titleTermsByEntity.get(entitySlug)
    if (headline && titleTerms && Array.from(titleTerms).some((term) => headline.includes(term))) {
      return true
    }
  }

  return false
}

function normalizeComparableText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_./'"“”‘’`]+/g, '')
    .trim()
}

function groupRowsByKey(rows, readKey) {
  const grouped = new Map()

  for (const row of rows) {
    const key = readKey(row)
    if (!key) {
      continue
    }

    const current = grouped.get(key)
    if (current) {
      current.push(row)
      continue
    }

    grouped.set(key, [row])
  }

  return grouped
}

function dedupeSearchTerms(values) {
  return Array.from(
    new Set(
      values
        .map((value) => readString(value))
        .filter(Boolean),
    ),
  )
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

function buildBridgeReleaseDetailRows({ explicitRows, releaseRows, releaseHistoryRows }) {
  const rowsByKey = new Map()

  for (const row of explicitRows) {
    const key = getReleaseKey(row.group, row.release_title, row.release_date, normalizeReleaseStream(row.stream, row.release_kind))
    rowsByKey.set(key, row)
  }

  for (const historyRow of releaseHistoryRows) {
    const group = historyRow.group
    const releases = Array.isArray(historyRow.releases) ? historyRow.releases : []
    for (const release of releases) {
      const synthetic = buildSyntheticReleaseDetailRow(group, release, release.stream)
      if (!synthetic) {
        continue
      }

      const key = getReleaseKey(
        synthetic.group,
        synthetic.release_title,
        synthetic.release_date,
        normalizeReleaseStream(synthetic.stream, synthetic.release_kind),
      )
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, synthetic)
      }
    }
  }

  for (const releaseRow of releaseRows) {
    for (const [stream, fact] of [
      ['song', releaseRow.latest_song],
      ['album', releaseRow.latest_album],
    ]) {
      const synthetic = buildSyntheticReleaseDetailRow(releaseRow.group, fact, stream)
      if (!synthetic) {
        continue
      }

      const key = getReleaseKey(
        synthetic.group,
        synthetic.release_title,
        synthetic.release_date,
        normalizeReleaseStream(synthetic.stream, synthetic.release_kind),
      )
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, synthetic)
      }
    }
  }

  return Array.from(rowsByKey.values())
}

function buildSyntheticReleaseDetailRow(group, fact, stream) {
  if (!fact || !readString(fact.title) || !readString(fact.date)) {
    return null
  }

  const normalizedStream = normalizeReleaseStream(stream, fact.release_kind)
  return {
    group,
    release_title: readString(fact.title),
    release_date: readString(fact.date),
    stream: normalizedStream,
    release_kind: readString(fact.release_kind) || (normalizedStream === 'album' ? 'album' : 'single'),
    detail_status: 'bridge_summary_fallback',
    detail_provenance: 'bridge.release_summary_fallback',
    title_track_status: 'unresolved',
    title_track_provenance: 'bridge.release_summary_fallback',
    tracks: [],
    spotify_url: null,
    youtube_music_url: null,
    youtube_video_url: null,
    youtube_video_id: null,
    youtube_video_status: 'unresolved',
    youtube_video_provenance: 'bridge.release_summary_fallback',
    notes: 'Bridge summary fallback generated from verified release summary.',
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
