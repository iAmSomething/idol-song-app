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

type CalendarSummary = {
  verified_count: number;
  exact_upcoming_count: number;
  month_only_upcoming_count: number;
};

type CalendarNearestUpcoming = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
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
  release_title: string;
  stream: string;
  release_kind: string | null;
  release_date?: string;
};

type CalendarUpcomingItem = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
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
    release_title: releaseTitle,
    stream,
    release_kind: asNullableString(value.release_kind),
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

    return buildReadDataEnvelope(request, context.config.appTimezone, data, { month: row.month_key }, toIsoString(row.generated_at));
  });
}
