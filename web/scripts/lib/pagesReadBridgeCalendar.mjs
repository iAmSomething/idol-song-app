function buildEntityDateKey(entitySlug, isoDate) {
  return entitySlug && isoDate ? `${entitySlug}::${isoDate}` : null
}

function collectVerifiedReleaseKeys(payload) {
  const keys = new Set()
  for (const release of payload.verified_list ?? []) {
    const key = buildEntityDateKey(release.entity_slug, release.release_date)
    if (key) {
      keys.add(key)
    }
  }

  for (const day of payload.days ?? []) {
    for (const release of day.verified_releases ?? []) {
      const key = buildEntityDateKey(release.entity_slug, release.release_date ?? day.date)
      if (key) {
        keys.add(key)
      }
    }
  }

  return keys
}

function isSameDayReleasedUpcoming(item, verifiedReleaseKeys) {
  if (item?.date_precision !== 'exact' || !item.scheduled_date) {
    return false
  }

  const key = buildEntityDateKey(item.entity_slug, item.scheduled_date)
  return key ? verifiedReleaseKeys.has(key) : false
}

function findNearestExactUpcoming(items) {
  return (
    items.find((item) => item?.date_precision === 'exact' && item?.scheduled_date) ??
    null
  )
}

export function suppressReleasedExactUpcoming(payload) {
  const verifiedReleaseKeys = collectVerifiedReleaseKeys(payload)
  const days = (payload.days ?? []).map((day) => ({
    ...day,
    exact_upcoming: (day.exact_upcoming ?? []).filter((item) => !isSameDayReleasedUpcoming(item, verifiedReleaseKeys)),
  }))
  const scheduledList = (payload.scheduled_list ?? []).filter(
    (item) => !isSameDayReleasedUpcoming(item, verifiedReleaseKeys),
  )

  return {
    ...payload,
    summary: {
      ...(payload.summary ?? {}),
      exact_upcoming_count: days.reduce((count, day) => count + day.exact_upcoming.length, 0),
      month_only_upcoming_count: payload.summary?.month_only_upcoming_count ?? (payload.month_only_upcoming ?? []).length,
      verified_count: payload.summary?.verified_count ?? (payload.verified_list ?? []).length,
    },
    nearest_upcoming:
      payload.nearest_upcoming && !isSameDayReleasedUpcoming(payload.nearest_upcoming, verifiedReleaseKeys)
        ? payload.nearest_upcoming
        : findNearestExactUpcoming(scheduledList),
    days,
    scheduled_list: scheduledList,
  }
}
