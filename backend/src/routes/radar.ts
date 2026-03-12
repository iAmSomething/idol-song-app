import type { FastifyInstance } from 'fastify';

import { buildReadDataEnvelope } from '../lib/api.js';
import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';

type RadarRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type RadarProjectionRow = {
  payload: unknown;
  generated_at: Date | string;
};

type RadarResponseData = {
  featured_upcoming: Record<string, unknown> | null;
  weekly_upcoming: Record<string, unknown>[];
  change_feed: Record<string, unknown>[];
  long_gap: Record<string, unknown>[];
  rookie: Record<string, unknown>[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeScheduledMonth(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized.slice(0, 7);
  }
  return normalized;
}

function resolveTodayIsoDate(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeIsoLikeString(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }
  return parsed.toISOString();
}

function normalizeRadarLatestSignal(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    scheduled_date: normalizeOptionalString(value.scheduled_date),
    scheduled_month: normalizeScheduledMonth(value.scheduled_month),
    release_format: normalizeOptionalString(value.release_format),
    source_url: normalizeOptionalString(value.source_url),
    source_type: normalizeOptionalString(value.source_type),
    source_domain: normalizeOptionalString(value.source_domain),
    evidence_summary: normalizeOptionalString(value.evidence_summary),
    latest_seen_at: normalizeIsoLikeString(value.latest_seen_at),
  };
}

function normalizeRadarReleaseSummary(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    release_date: normalizeOptionalString(value.release_date),
    release_kind: normalizeOptionalString(value.release_kind),
    release_format: normalizeOptionalString(value.release_format),
    source_url: normalizeOptionalString(value.source_url),
    artist_source_url: normalizeOptionalString(value.artist_source_url),
  };
}

function normalizeRadarLongGapOrRookieItem(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    latest_release: normalizeRadarReleaseSummary(value.latest_release),
    latest_signal: normalizeRadarLatestSignal(value.latest_signal),
  };
}

function normalizeRadarChangeFeedItem(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind === 'upcoming_signal') {
    const occurredAt =
      normalizeIsoLikeString(value.occurred_at) ??
      normalizeIsoLikeString(value.latest_seen_at) ??
      normalizeOptionalString(value.scheduled_date) ??
      normalizeScheduledMonth(value.scheduled_month);
    return {
      ...value,
      scheduled_date: normalizeOptionalString(value.scheduled_date),
      scheduled_month: normalizeScheduledMonth(value.scheduled_month),
      occurred_at: occurredAt,
    };
  }

  if (value.kind === 'verified_release') {
    return {
      ...value,
      occurred_at: normalizeIsoLikeString(value.occurred_at),
    };
  }

  return value;
}

function normalizeRadarUpcomingItem(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    scheduled_date: normalizeOptionalString(value.scheduled_date),
    scheduled_month: normalizeScheduledMonth(value.scheduled_month),
    release_format: normalizeOptionalString(value.release_format),
    source_url: normalizeOptionalString(value.source_url),
    source_type: normalizeOptionalString(value.source_type),
    source_domain: normalizeOptionalString(value.source_domain),
    evidence_summary: normalizeOptionalString(value.evidence_summary),
    latest_seen_at: normalizeIsoLikeString(value.latest_seen_at),
  };
}

function normalizeRadarPayload(payload: unknown): RadarResponseData {
  if (!isRecord(payload)) {
    return {
      featured_upcoming: null,
      weekly_upcoming: [],
      change_feed: [],
      long_gap: [],
      rookie: [],
    };
  }

  return {
    featured_upcoming: normalizeRadarUpcomingItem(payload.featured_upcoming),
    weekly_upcoming: normalizeRecordArray(payload.weekly_upcoming).map((item) => normalizeRadarUpcomingItem(item) ?? item),
    change_feed: normalizeRecordArray(payload.change_feed).map((item) => normalizeRadarChangeFeedItem(item) ?? item),
    long_gap: normalizeRecordArray(payload.long_gap).map((item) => normalizeRadarLongGapOrRookieItem(item) ?? item),
    rookie: normalizeRecordArray(payload.rookie).map((item) => normalizeRadarLongGapOrRookieItem(item) ?? item),
  };
}

function isElapsedExactUpcoming(value: Record<string, unknown> | null, todayIsoDate: string): boolean {
  return Boolean(
    value?.date_precision === 'exact' &&
      typeof value.scheduled_date === 'string' &&
      value.scheduled_date.length > 0 &&
      value.scheduled_date < todayIsoDate
  );
}

function filterElapsedRadarUpcoming(payload: RadarResponseData, todayIsoDate: string): RadarResponseData {
  return {
    ...payload,
    featured_upcoming: isElapsedExactUpcoming(payload.featured_upcoming, todayIsoDate) ? null : payload.featured_upcoming,
    weekly_upcoming: payload.weekly_upcoming.filter((item) => !isElapsedExactUpcoming(item, todayIsoDate)),
    long_gap: payload.long_gap.map((item) =>
      isRecord(item) && isElapsedExactUpcoming(item.latest_signal as Record<string, unknown> | null, todayIsoDate)
        ? { ...item, latest_signal: null, has_upcoming_signal: false }
        : item
    ),
    rookie: payload.rookie.map((item) =>
      isRecord(item) && isElapsedExactUpcoming(item.latest_signal as Record<string, unknown> | null, todayIsoDate)
        ? { ...item, latest_signal: null, has_upcoming_signal: false }
        : item
    ),
  };
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

export function registerRadarRoutes(app: FastifyInstance, context: RadarRouteContext): void {
  app.get('/v1/radar', async (request) => {
    const result = await context.db.query<RadarProjectionRow>(
      `
        select payload, generated_at
        from radar_projection
        where projection_key = $1
        limit 1
      `,
      ['default']
    );

    const row = result.rows[0];

    const payload = filterElapsedRadarUpcoming(normalizeRadarPayload(row?.payload), resolveTodayIsoDate(context.config.appTimezone));

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      payload,
      {},
      toIsoString(row?.generated_at),
    );
  });
}
