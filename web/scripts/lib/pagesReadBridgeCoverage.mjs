import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export async function auditPagesReadBridge({ webRoot }) {
  const bridgeRoot = path.join(webRoot, 'public', '__bridge', 'v1')
  const entitiesDir = path.join(bridgeRoot, 'entities')
  const releaseDetailsDir = path.join(bridgeRoot, 'releases', 'details')
  const releaseLookupsDir = path.join(bridgeRoot, 'releases', 'lookups')
  const calendarMonthsDir = path.join(bridgeRoot, 'calendar', 'months')

  const entityFiles = (await readdir(entitiesDir)).filter((name) => name.endsWith('.json')).sort()
  const releaseDetailFiles = (await readdir(releaseDetailsDir)).filter((name) => name.endsWith('.json')).sort()
  const releaseLookupFiles = (await readdir(releaseLookupsDir)).filter((name) => name.endsWith('.json')).sort()
  const calendarMonthFiles = (await readdir(calendarMonthsDir)).filter((name) => name.endsWith('.json')).sort()

  const entityFileSlugs = new Set(entityFiles.map((name) => name.replace(/\.json$/u, '')))
  const releaseDetailIds = new Set(releaseDetailFiles.map((name) => name.replace(/\.json$/u, '')))
  const releaseLookupIds = new Set(releaseLookupFiles.map((name) => name.replace(/\.json$/u, '')))

  const entityPayloadEntries = await Promise.all(
    entityFiles.map(async (name) => {
      const slug = name.replace(/\.json$/u, '')
      return [slug, await readJson(path.join(entitiesDir, name))]
    }),
  )
  const entityPayloadBySlug = new Map(entityPayloadEntries)

  const searchIndex = await readJson(path.join(bridgeRoot, 'search', 'index.json'))
  const radar = await readJson(path.join(bridgeRoot, 'radar.json'))
  const backendTarget = await readJson(path.join(bridgeRoot, 'meta', 'backend-target.json'))
  const calendarMonths = await Promise.all(
    calendarMonthFiles.map(async (name) => ({
      monthKey: name.replace(/\.json$/u, ''),
      payload: await readJson(path.join(calendarMonthsDir, name)),
    })),
  )

  const errors = []

  for (const [entitySlug, payload] of entityPayloadBySlug) {
    const identitySlug = readString(payload?.data?.identity?.entity_slug)
    if (identitySlug !== entitySlug) {
      pushError(
        errors,
        'entity_slug_mismatch',
        `Bridge entity asset ${entitySlug} must expose the same identity.entity_slug.`,
        { entitySlug, identitySlug },
      )
    }

    validateOptionalUrl(errors, payload?.data?.official_links?.youtube, 'entity_official_youtube_invalid', {
      entitySlug,
      field: 'official_links.youtube',
    })
    validateOptionalUrl(errors, payload?.data?.official_links?.x, 'entity_official_x_invalid', {
      entitySlug,
      field: 'official_links.x',
    })
    validateOptionalUrl(errors, payload?.data?.official_links?.instagram, 'entity_official_instagram_invalid', {
      entitySlug,
      field: 'official_links.instagram',
    })
    validateOptionalUrl(errors, payload?.data?.youtube_channels?.primary_team_channel_url, 'entity_primary_channel_invalid', {
      entitySlug,
      field: 'youtube_channels.primary_team_channel_url',
    })

    ensureReleaseReference(
      errors,
      releaseDetailIds,
      payload?.data?.latest_release,
      'entity_latest_release_missing_detail',
      { entitySlug },
    )

    for (const recentRelease of ensureArray(payload?.data?.recent_albums)) {
      ensureReleaseReference(errors, releaseDetailIds, recentRelease, 'entity_recent_release_missing_detail', {
        entitySlug,
      })
    }

    for (const timelineEntry of ensureArray(payload?.data?.source_timeline)) {
      validateOptionalUrl(errors, timelineEntry?.source_url, 'entity_timeline_source_invalid', {
        entitySlug,
        headline: readString(timelineEntry?.headline) ?? null,
      })
    }
  }

  const searchEntities = ensureArray(searchIndex?.data?.entities)
  for (const entry of searchEntities) {
    const entitySlug = readString(entry?.entity_slug)
    if (!entitySlug) {
      pushError(errors, 'search_entity_missing_slug', 'Bridge search entity rows must expose entity_slug.', {
        row: entry ?? null,
      })
      continue
    }

    ensureEntityReference(errors, entityFileSlugs, entitySlug, 'search_entity_missing_asset', { entitySlug })
    ensureEntitySearchTerms(errors, entry, 'search_entity_missing_exact_terms')
    ensureReleaseReference(errors, releaseDetailIds, entry?.latest_release, 'search_entity_latest_release_missing_detail', {
      entitySlug,
    })
  }

  const searchReleases = ensureArray(searchIndex?.data?.releases)
  for (const entry of searchReleases) {
    const entitySlug = readString(entry?.entity_slug)
    const releaseTitle = readString(entry?.release_title)
    const releaseDate = readString(entry?.release_date)
    const stream = normalizeReleaseStream(readString(entry?.stream), readString(entry?.release_kind))
    if (!entitySlug || !releaseTitle || !releaseDate || !stream) {
      pushError(errors, 'search_release_missing_fields', 'Bridge search release rows must expose slug/title/date/stream.', {
        entitySlug,
        releaseTitle,
        releaseDate,
        stream,
      })
      continue
    }

    ensureEntityReference(errors, entityFileSlugs, entitySlug, 'search_release_missing_entity_asset', { entitySlug })
    ensureLookupReference(
      errors,
      releaseLookupIds,
      entitySlug,
      releaseTitle,
      releaseDate,
      stream,
      'search_release_missing_lookup',
    )
    ensureReleaseReference(errors, releaseDetailIds, entry, 'search_release_missing_detail', { entitySlug })
  }

  const searchUpcoming = ensureArray(searchIndex?.data?.upcoming)
  for (const entry of searchUpcoming) {
    const entitySlug = readString(entry?.entity_slug)
    if (!entitySlug) {
      pushError(errors, 'search_upcoming_missing_slug', 'Bridge search upcoming rows must expose entity_slug.', {
        row: entry ?? null,
      })
      continue
    }

    ensureEntityReference(errors, entityFileSlugs, entitySlug, 'search_upcoming_missing_entity_asset', { entitySlug })
    validateOptionalUrl(errors, entry?.source_url, 'search_upcoming_source_invalid', {
      entitySlug,
      headline: readString(entry?.headline) ?? null,
    })
    const entityPayload = entityPayloadBySlug.get(entitySlug)
    const latestReleaseDate = readString(entityPayload?.data?.latest_release?.release_date)
    const scheduledDate = readString(entry?.scheduled_date)
    if (latestReleaseDate && scheduledDate && latestReleaseDate === scheduledDate) {
      pushError(
        errors,
        'search_upcoming_stale_same_day',
        'Bridge search upcoming rows must not keep same-day exact upcoming rows when a verified release exists for the same entity/date.',
        {
          entitySlug,
          scheduledDate,
          latestReleaseDate,
        },
      )
    }
  }

  for (const { monthKey, payload } of calendarMonths) {
    const days = ensureArray(payload?.data?.days)
    const scheduledList = ensureArray(payload?.data?.scheduled_list)
    const monthOnlyUpcoming = ensureArray(payload?.data?.month_only_upcoming)

    for (const day of days) {
      const dayDate = readString(day?.date)
      const verifiedRows = ensureArray(day?.verified_releases)
      const exactUpcomingRows = ensureArray(day?.exact_upcoming)
      const verifiedEntityDateKeys = new Set()

      for (const verified of verifiedRows) {
        const entitySlug = readString(verified?.entity_slug)
        const releaseDate = readString(verified?.release_date)
        if (entitySlug && releaseDate) {
          verifiedEntityDateKeys.add(`${entitySlug}::${releaseDate}`)
        }

        if (entitySlug) {
          ensureEntityReference(errors, entityFileSlugs, entitySlug, 'calendar_verified_missing_entity_asset', {
            monthKey,
            date: dayDate,
            entitySlug,
          })
        }
        ensureReleaseReference(errors, releaseDetailIds, verified, 'calendar_verified_missing_detail', {
          monthKey,
          date: dayDate,
          entitySlug,
        })
      }

      for (const upcoming of exactUpcomingRows) {
        const entitySlug = readString(upcoming?.entity_slug)
        const scheduledDate = readString(upcoming?.scheduled_date)
        if (entitySlug) {
          ensureEntityReference(errors, entityFileSlugs, entitySlug, 'calendar_exact_upcoming_missing_entity_asset', {
            monthKey,
            date: dayDate,
            entitySlug,
          })
        }
        validateOptionalUrl(errors, upcoming?.source_url, 'calendar_exact_upcoming_source_invalid', {
          monthKey,
          date: dayDate,
          entitySlug,
        })
        if (entitySlug && scheduledDate && verifiedEntityDateKeys.has(`${entitySlug}::${scheduledDate}`)) {
          pushError(
            errors,
            'calendar_stale_same_day_upcoming',
            'Bridge calendar must not keep same-day exact upcoming rows when a verified release exists for the same entity/date.',
            { monthKey, date: dayDate, entitySlug, scheduledDate },
          )
        }
      }
    }

    for (const upcoming of [...scheduledList, ...monthOnlyUpcoming]) {
      const entitySlug = readString(upcoming?.entity_slug)
      if (!entitySlug) {
        pushError(errors, 'calendar_scheduled_missing_slug', 'Bridge scheduled rows must expose entity_slug.', {
          monthKey,
          row: upcoming ?? null,
        })
        continue
      }

      ensureEntityReference(errors, entityFileSlugs, entitySlug, 'calendar_scheduled_missing_entity_asset', {
        monthKey,
        entitySlug,
      })
    }
  }

  for (const entry of ensureArray(radar?.data?.long_gap)) {
    const entitySlug = readString(entry?.entity_slug)
    if (!entitySlug) {
      pushError(errors, 'radar_long_gap_missing_slug', 'Radar long-gap rows must expose entity_slug.', { row: entry ?? null })
      continue
    }

    ensureEntityReference(errors, entityFileSlugs, entitySlug, 'radar_long_gap_missing_entity_asset', { entitySlug })
  }

  for (const entry of ensureArray(radar?.data?.rookie)) {
    const entitySlug = readString(entry?.entity_slug)
    if (!entitySlug) {
      pushError(errors, 'radar_rookie_missing_slug', 'Radar rookie rows must expose entity_slug.', { row: entry ?? null })
      continue
    }

    ensureEntityReference(errors, entityFileSlugs, entitySlug, 'radar_rookie_missing_entity_asset', { entitySlug })
  }

  for (const releaseId of releaseDetailIds) {
    const detail = await readJson(path.join(releaseDetailsDir, `${releaseId}.json`))
    validateOptionalUrl(errors, detail?.data?.artwork?.cover_image_url, 'release_artwork_invalid', {
      releaseId,
      field: 'artwork.cover_image_url',
    })
    validateOptionalUrl(errors, detail?.data?.service_links?.spotify?.url, 'release_spotify_invalid', {
      releaseId,
      field: 'service_links.spotify.url',
    })
    validateOptionalUrl(errors, detail?.data?.service_links?.youtube_music?.url, 'release_youtube_music_invalid', {
      releaseId,
      field: 'service_links.youtube_music.url',
    })
    validateOptionalUrl(errors, detail?.data?.mv?.url, 'release_mv_url_invalid', {
      releaseId,
      field: 'mv.url',
    })
  }

  return {
    summary: {
      runtimeMode: readString(backendTarget?.data?.runtime_mode) ?? null,
      targetEnvironment: readString(backendTarget?.data?.target_environment) ?? null,
      entityAssets: entityFiles.length,
      releaseDetailAssets: releaseDetailFiles.length,
      releaseLookupAssets: releaseLookupFiles.length,
      calendarMonths: calendarMonthFiles.length,
      searchEntities: searchEntities.length,
      searchReleases: searchReleases.length,
      searchUpcoming: searchUpcoming.length,
      radarLongGap: ensureArray(radar?.data?.long_gap).length,
      radarRookie: ensureArray(radar?.data?.rookie).length,
      errorCount: errors.length,
    },
    errors,
  }
}

function ensureEntitySearchTerms(errors, entry, code) {
  const entitySlug = readString(entry?.entity_slug)
  const displayName = readString(entry?.display_name)
  const canonicalName = readString(entry?.canonical_name)
  const searchTerms = new Set(ensureArray(entry?.search_terms).map((term) => normalizeSearchTerm(term)).filter(Boolean))

  for (const expectedTerm of [displayName, canonicalName]) {
    const normalized = normalizeSearchTerm(expectedTerm)
    if (!normalized) {
      continue
    }

    if (!searchTerms.has(normalized)) {
      pushError(errors, code, 'Bridge search entity rows must include exact-match terms for display and canonical names.', {
        entitySlug,
        missingTerm: expectedTerm,
      })
    }
  }
}

function ensureEntityReference(errors, entityFileSlugs, entitySlug, code, context) {
  if (!entityFileSlugs.has(entitySlug)) {
    pushError(errors, code, 'Bridge route points at an entity detail asset that does not exist.', context)
  }
}

function ensureReleaseReference(errors, releaseDetailIds, releaseSummary, code, context) {
  if (!releaseSummary) {
    return
  }

  const releaseId = readString(releaseSummary?.release_id)
  if (!releaseId) {
    pushError(errors, code, 'Bridge route points at a release detail asset without a release_id.', context)
    return
  }

  if (!releaseDetailIds.has(releaseId)) {
    pushError(errors, code, 'Bridge route points at a release detail asset that does not exist.', {
      ...context,
      releaseId,
    })
  }
}

function ensureLookupReference(errors, releaseLookupIds, entitySlug, releaseTitle, releaseDate, stream, code) {
  const lookupId = buildReleaseLookupAssetId(entitySlug, releaseTitle, releaseDate, stream)
  if (!releaseLookupIds.has(lookupId)) {
    pushError(errors, code, 'Bridge route points at a release lookup asset that does not exist.', {
      entitySlug,
      releaseTitle,
      releaseDate,
      stream,
      lookupId,
    })
  }
}

function validateOptionalUrl(errors, url, code, context) {
  const normalized = readString(url)
  if (!normalized) {
    return
  }

  try {
    const target = new URL(normalized)
    if (target.protocol !== 'https:') {
      pushError(errors, code, 'Bridge/runtime links must use https URLs when present.', {
        ...context,
        url: normalized,
      })
    }
  } catch {
    pushError(errors, code, 'Bridge/runtime links must be valid absolute URLs when present.', {
      ...context,
      url: normalized,
    })
  }
}

function buildReleaseLookupAssetId(entitySlug, releaseTitle, releaseDate, stream) {
  return `lookup-${hashBridgeKey([entitySlug, releaseTitle, releaseDate, stream].join('::'))}`
}

function hashBridgeKey(value) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeReleaseStream(stream, releaseKind) {
  if (stream === 'album' || releaseKind === 'album' || releaseKind === 'ep') {
    return 'album'
  }

  return 'song'
}

function normalizeSearchTerm(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_./]+/gu, '')
    .trim()
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function pushError(errors, code, message, context) {
  errors.push({
    code,
    message,
    context,
  })
}

async function readJson(targetPath) {
  const contents = await readFile(targetPath, 'utf8')
  return JSON.parse(contents)
}
