import type { FastifyInstance } from 'fastify';

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
    featured_upcoming: isRecord(payload.featured_upcoming) ? payload.featured_upcoming : null,
    weekly_upcoming: normalizeRecordArray(payload.weekly_upcoming),
    change_feed: normalizeRecordArray(payload.change_feed),
    long_gap: normalizeRecordArray(payload.long_gap),
    rookie: normalizeRecordArray(payload.rookie),
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
  app.get('/v1/radar', async () => {
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

    return {
      meta: {
        generated_at: toIsoString(row?.generated_at),
        timezone: context.config.appTimezone,
      },
      data: normalizeRadarPayload(row?.payload),
    };
  });
}
