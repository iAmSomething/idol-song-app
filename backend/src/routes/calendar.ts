import type { FastifyInstance } from 'fastify';

import { buildReadDataEnvelope, routeError } from '../lib/api.js';
import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';

type CalendarRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type CalendarMonthQuery = {
  month?: string;
};

type CalendarMonthProjectionRow = {
  month_key: string;
  payload: unknown;
  generated_at: Date | string;
};

type CalendarVerifiedReleaseHydrationRow = {
  release_id: string;
  source_url: string | null;
  artist_source_url: string | null;
  release_format: string | null;
  entity_type: string | null;
  agency_name: string | null;
};

type CalendarSummary = {
  verified_count: number;
  exact_upcoming_count: number;
  month_only_upcoming_count: number;
};

type CalendarNearestUpcoming = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
  entity_type: string | null;
  agency_name: string | null;
  tracking_status: string | null;
  headline: string;
  scheduled_date: string;
  scheduled_month: string;
  date_precision: string;
  date_status: string;
  confidence_score: number | null;
  release_format: string | null;
  source_url: string | null;
  source_type: string | null;
  source_domain: string | null;
  evidence_summary: string | null;
  source_count: number | null;
};

type CalendarVerifiedRelease = {
  release_id: string;
  entity_slug: string;
  display_name: string;
  entity_type: string | null;
  agency_name: string | null;
  release_title: string;
  stream: string;
  release_kind: string | null;
  release_format: string | null;
  source_url: string | null;
  artist_source_url: string | null;
  release_date?: string;
};

type CalendarUpcomingItem = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
  entity_type: string | null;
  agency_name: string | null;
  tracking_status: string | null;
  headline: string;
  scheduled_date: string | null;
  scheduled_month: string;
  date_precision: string;
  date_status: string;
  confidence_score: number | null;
  release_format: string | null;
  source_url: string | null;
  source_type: string | null;
  source_domain: string | null;
  evidence_summary: string | null;
  source_count: number | null;
};

type CalendarDay = {
  date: string;
  verified_releases: CalendarVerifiedRelease[];
  exact_upcoming: CalendarUpcomingItem[];
};

type CalendarMonthData = {
  summary: CalendarSummary;
  nearest_upcoming: CalendarNearestUpcoming | null;
  days: CalendarDay[];
  month_only_upcoming: CalendarUpcomingItem[];
  verified_list: CalendarVerifiedRelease[];
  scheduled_list: CalendarUpcomingItem[];
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asYearMonth(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    if (/^\d{4}-\d{2}$/.test(value)) {
      return value;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value.slice(0, 7);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 7);
    }
  }

  return null;
}

function toIsoString(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeVerifiedRelease(value: unknown): CalendarVerifiedRelease | null {
  if (!isRecord(value)) {
    return null;
  }

  const releaseId = asNullableString(value.release_id);
  const entitySlug = asNullableString(value.entity_slug);
  const displayName = asNullableString(value.display_name);
  const releaseTitle = asNullableString(value.release_title);
  const stream = asNullableString(value.stream);

  if (!releaseId || !entitySlug || !displayName || !releaseTitle || !stream) {
    return null;
  }

  return {
    release_id: releaseId,
    entity_slug: entitySlug,
    display_name: displayName,
    entity_type: asNullableString(value.entity_type),
    agency_name: asNullableString(value.agency_name),
    release_title: releaseTitle,
    stream,
    release_kind: asNullableString(value.release_kind),
    release_format: asNullableString(value.release_format),
    source_url: asNullableString(value.source_url),
    artist_source_url: asNullableString(value.artist_source_url),
    release_date: asNullableString(value.release_date) ?? undefined,
  };
}

function normalizeUpcomingItem(value: unknown): CalendarUpcomingItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const upcomingSignalId = asNullableString(value.upcoming_signal_id);
  const entitySlug = asNullableString(value.entity_slug);
  const displayName = asNullableString(value.display_name);
  const headline = asNullableString(value.headline);
  const scheduledDate = asNullableString(value.scheduled_date);
  const scheduledMonth = asYearMonth(value.scheduled_month) ?? (scheduledDate ? scheduledDate.slice(0, 7) : null);
  const datePrecision = asNullableString(value.date_precision);
  const dateStatus = asNullableString(value.date_status);

  if (
    !upcomingSignalId ||
    !entitySlug ||
    !displayName ||
    !headline ||
    !scheduledMonth ||
    !datePrecision ||
    !dateStatus
  ) {
    return null;
  }

  return {
    upcoming_signal_id: upcomingSignalId,
    entity_slug: entitySlug,
    display_name: displayName,
    entity_type: asNullableString(value.entity_type),
    agency_name: asNullableString(value.agency_name),
    tracking_status: asNullableString(value.tracking_status),
    headline,
    scheduled_date: scheduledDate,
    scheduled_month: scheduledMonth,
    date_precision: datePrecision,
    date_status: dateStatus,
    confidence_score: asNumber(value.confidence_score),
    release_format: asNullableString(value.release_format),
    source_url: asNullableString(value.source_url),
    source_type: asNullableString(value.source_type),
    source_domain: asNullableString(value.source_domain),
    evidence_summary: asNullableString(value.evidence_summary),
    source_count: asNumber(value.source_count),
  };
}

function normalizeVerifiedReleaseArray(value: unknown): CalendarVerifiedRelease[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeVerifiedRelease)
    .filter((item): item is CalendarVerifiedRelease => item !== null);
}

function normalizeUpcomingArray(value: unknown): CalendarUpcomingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeUpcomingItem).filter((item): item is CalendarUpcomingItem => item !== null);
}

function resolveTodayIsoDate(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isElapsedExactUpcoming(
  item: Pick<CalendarUpcomingItem, 'date_precision' | 'scheduled_date'> | null,
  todayIsoDate: string,
): boolean {
  return Boolean(item?.date_precision === 'exact' && item.scheduled_date && item.scheduled_date < todayIsoDate);
}

function buildEntityDateKey(entitySlug: string | null | undefined, isoDate: string | null | undefined): string | null {
  return entitySlug && isoDate ? `${entitySlug}::${isoDate}` : null;
}

function isSameDayReleasedUpcoming(
  item: Pick<CalendarUpcomingItem, 'entity_slug' | 'date_precision' | 'scheduled_date'> | null,
  verifiedReleaseKeys: ReadonlySet<string>,
): boolean {
  if (item?.date_precision !== 'exact' || !item.scheduled_date) {
    return false;
  }

  const key = buildEntityDateKey(item.entity_slug, item.scheduled_date);
  return key ? verifiedReleaseKeys.has(key) : false;
}

function collectVerifiedReleaseKeys(data: CalendarMonthData): Set<string> {
  const keys = new Set<string>();

  for (const release of data.verified_list) {
    const key = buildEntityDateKey(release.entity_slug, release.release_date);
    if (key) {
      keys.add(key);
    }
  }

  for (const day of data.days) {
    for (const release of day.verified_releases) {
      const key = buildEntityDateKey(release.entity_slug, release.release_date ?? day.date);
      if (key) {
        keys.add(key);
      }
    }
  }

  return keys;
}

function hydrateVerifiedRelease(
  release: CalendarVerifiedRelease,
  row: CalendarVerifiedReleaseHydrationRow | undefined,
): CalendarVerifiedRelease {
  if (!row) {
    return release;
  }

  return {
    ...release,
    entity_type: release.entity_type ?? row.entity_type,
    agency_name: release.agency_name ?? row.agency_name,
    release_format: release.release_format ?? row.release_format,
    source_url: release.source_url ?? row.source_url,
    artist_source_url: release.artist_source_url ?? row.artist_source_url,
  };
}

async function hydrateVerifiedReleaseArray(
  db: DbQueryable,
  releases: CalendarVerifiedRelease[],
): Promise<CalendarVerifiedRelease[]> {
  const releaseIds = [...new Set(releases.map((release) => release.release_id).filter(Boolean))];

  if (releaseIds.length === 0) {
    return releases;
  }

  const result = await db.query<CalendarVerifiedReleaseHydrationRow>(
    `
      select
        r.id::text as release_id,
        r.source_url,
        r.artist_source_url,
        r.release_format,
        e.entity_type,
        e.agency_name
      from releases r
      left join entities e on e.id = r.entity_id
      where r.id = any($1::uuid[])
    `,
    [releaseIds],
  );

  const rowsByReleaseId = new Map(
    result.rows.map((row) => [row.release_id, row] as const),
  );

  return releases.map((release) => hydrateVerifiedRelease(release, rowsByReleaseId.get(release.release_id)));
}

async function hydrateCalendarMonthData(db: DbQueryable, data: CalendarMonthData): Promise<CalendarMonthData> {
  const allVerified = [
    ...data.verified_list,
    ...data.days.flatMap((day) => day.verified_releases),
  ];
  const hydratedAllVerified = await hydrateVerifiedReleaseArray(db, allVerified);
  const hydratedByKey = new Map(
    hydratedAllVerified.map((release) => [release.release_id, release]),
  );
  const pickHydratedRelease = (release: CalendarVerifiedRelease) => hydratedByKey.get(release.release_id) ?? release;

  const verifiedRows = data.verified_list.map(pickHydratedRelease);
  const dayRows = data.days.map((day) => ({
    ...day,
    verified_releases: day.verified_releases.map(pickHydratedRelease),
  }));

  return {
    ...data,
    verified_list: verifiedRows,
    days: dayRows,
  };
}

function toNearestUpcoming(item: CalendarUpcomingItem | null): CalendarNearestUpcoming | null {
  if (!item || item.date_precision !== 'exact' || !item.scheduled_date) {
    return null;
  }

  return {
    upcoming_signal_id: item.upcoming_signal_id,
    entity_slug: item.entity_slug,
    display_name: item.display_name,
    entity_type: item.entity_type,
    agency_name: item.agency_name,
    tracking_status: item.tracking_status,
    headline: item.headline,
    scheduled_date: item.scheduled_date,
    scheduled_month: item.scheduled_month,
    date_precision: item.date_precision,
    date_status: item.date_status,
    confidence_score: item.confidence_score,
    release_format: item.release_format,
    source_url: item.source_url,
    source_type: item.source_type,
    source_domain: item.source_domain,
    evidence_summary: item.evidence_summary,
    source_count: item.source_count,
  };
}

function normalizeCalendarMonthPayload(payload: unknown): CalendarMonthData | null {
  if (!isRecord(payload) || !isRecord(payload.summary)) {
    return null;
  }

  const summary = payload.summary;

  const days = Array.isArray(payload.days)
    ? payload.days
        .filter(isRecord)
        .map((day) => {
          const date = asNullableString(day.date);
          if (!date) {
            return null;
          }

          return {
            date,
            verified_releases: normalizeVerifiedReleaseArray(day.verified_releases),
            exact_upcoming: normalizeUpcomingArray(day.exact_upcoming),
          };
        })
        .filter((item): item is CalendarDay => item !== null)
    : [];

  const nearestUpcoming = normalizeUpcomingItem(payload.nearest_upcoming);

  if (
    typeof summary.verified_count !== 'number' ||
    typeof summary.exact_upcoming_count !== 'number' ||
    typeof summary.month_only_upcoming_count !== 'number'
  ) {
    return null;
  }

  return {
    summary: {
      verified_count: summary.verified_count,
      exact_upcoming_count: summary.exact_upcoming_count,
      month_only_upcoming_count: summary.month_only_upcoming_count,
    },
    nearest_upcoming:
      nearestUpcoming &&
      nearestUpcoming.scheduled_date &&
      nearestUpcoming.date_precision === 'exact'
        ? {
            upcoming_signal_id: nearestUpcoming.upcoming_signal_id,
            entity_slug: nearestUpcoming.entity_slug,
            display_name: nearestUpcoming.display_name,
            entity_type: nearestUpcoming.entity_type,
            agency_name: nearestUpcoming.agency_name,
            tracking_status: nearestUpcoming.tracking_status,
            headline: nearestUpcoming.headline,
            scheduled_date: nearestUpcoming.scheduled_date,
            scheduled_month: nearestUpcoming.scheduled_month,
            date_precision: nearestUpcoming.date_precision,
            date_status: nearestUpcoming.date_status,
            confidence_score: nearestUpcoming.confidence_score,
            release_format: nearestUpcoming.release_format,
            source_url: nearestUpcoming.source_url,
            source_type: nearestUpcoming.source_type,
            source_domain: nearestUpcoming.source_domain,
            evidence_summary: nearestUpcoming.evidence_summary,
            source_count: nearestUpcoming.source_count,
          }
        : null,
    days,
    month_only_upcoming: normalizeUpcomingArray(payload.month_only_upcoming).filter(
      (item) => item.date_precision === 'month_only',
    ),
    verified_list: normalizeVerifiedReleaseArray(payload.verified_list),
    scheduled_list: normalizeUpcomingArray(payload.scheduled_list),
  };
}

function filterElapsedExactUpcomingRows(data: CalendarMonthData, todayIsoDate: string): CalendarMonthData {
  const verifiedReleaseKeys = collectVerifiedReleaseKeys(data);
  const days = data.days.map((day) => ({
    ...day,
    exact_upcoming: day.exact_upcoming.filter(
      (item) => !isElapsedExactUpcoming(item, todayIsoDate) && !isSameDayReleasedUpcoming(item, verifiedReleaseKeys),
    ),
  }));
  const scheduledList = data.scheduled_list.filter(
    (item) => !isElapsedExactUpcoming(item, todayIsoDate) && !isSameDayReleasedUpcoming(item, verifiedReleaseKeys),
  );
  const filteredNearestUpcoming =
    data.nearest_upcoming &&
    !isElapsedExactUpcoming(data.nearest_upcoming, todayIsoDate) &&
    !isSameDayReleasedUpcoming(data.nearest_upcoming, verifiedReleaseKeys)
      ? data.nearest_upcoming
      : toNearestUpcoming(
          scheduledList.find((item) => item.date_precision === 'exact' && item.scheduled_date) ?? null,
        );

  return {
    ...data,
    summary: {
      verified_count: data.summary.verified_count,
      exact_upcoming_count: days.reduce((count, day) => count + day.exact_upcoming.length, 0),
      month_only_upcoming_count: data.month_only_upcoming.length,
    },
    nearest_upcoming: filteredNearestUpcoming,
    days,
    scheduled_list: scheduledList,
  };
}

export function registerCalendarRoutes(app: FastifyInstance, context: CalendarRouteContext): void {
  app.get('/v1/calendar/month', async (request) => {
    const { month } = request.query as CalendarMonthQuery;

    if (!month) {
      throw routeError(400, 'invalid_request', 'month query parameter is required (YYYY-MM).');
    }

    if (!MONTH_KEY_PATTERN.test(month)) {
      throw routeError(400, 'invalid_request', 'month query parameter must use YYYY-MM format.', { month });
    }

    const result = await context.db.query<CalendarMonthProjectionRow>(
      `
        select month_key, payload, generated_at
        from calendar_month_projection
        where month_key = $1
        limit 1
      `,
      [month]
    );

    const row = result.rows[0];
    if (!row) {
      throw routeError(404, 'not_found', 'No calendar projection matched the supplied month.', { month });
    }

    const data = normalizeCalendarMonthPayload(row.payload);
    if (!data) {
      throw routeError(500, 'stale_projection', 'calendar_month_projection returned an unexpected payload shape.', {
        month,
      });
    }

    const todayIsoDate = resolveTodayIsoDate(context.config.appTimezone);
    const filteredData = filterElapsedExactUpcomingRows(data, todayIsoDate);
    const hydratedData = await hydrateCalendarMonthData(context.db, filteredData);

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      hydratedData,
      { month: row.month_key },
      toIsoString(row.generated_at)
    );
  });
}
