import type { FastifyInstance } from 'fastify';

import { buildReadDataEnvelope, routeError } from '../lib/api.js';
import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';
import { buildReleaseLookupKey } from '../lib/normalization.js';

type ReleaseRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type ReleaseDetailProjectionRow = {
  release_id: string;
  entity_slug: string;
  normalized_release_title: string;
  release_date: string;
  stream: string;
  payload: unknown;
  generated_at: Date | string;
};

type ReleaseLookupQuery = {
  entity_slug?: string;
  title?: string;
  date?: string;
  stream?: string;
};

type ReleaseParams = {
  id: string;
};

type ReleaseCore = {
  release_id: string;
  entity_slug: string;
  display_name: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind: string | null;
};

type ServiceLink = {
  url?: string | null;
  status?: string | null;
  provenance?: string | null;
};

type TrackServiceLink = {
  url?: string | null;
  status?: string | null;
  provenance?: string | null;
};

type ReleaseTrack = {
  track_id: string;
  order: number;
  title: string;
  is_title_track: boolean;
  spotify: TrackServiceLink | null;
  youtube_music: TrackServiceLink | null;
};

type ReleaseDetailData = {
  release: ReleaseCore;
  artwork: Record<string, unknown> | null;
  service_links: {
    spotify: ServiceLink | null;
    youtube_music: ServiceLink | null;
  };
  tracks: ReleaseTrack[];
  mv: {
    url: string | null;
    video_id: string | null;
    status: string | null;
    provenance: string | null;
  };
  credits: Record<string, unknown>[];
  charts: Record<string, unknown>[];
  notes: unknown;
};

type ReleaseLookupData = {
  release_id: string;
  canonical_path: string;
  release: ReleaseCore;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STREAMS = new Set(['album', 'song']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function normalizeServiceLink(value: unknown): ServiceLink | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    url: asNullableString(value.url),
    status: asNullableString(value.status),
    provenance: asNullableString(value.provenance),
  };
}

function normalizeTrack(value: unknown): ReleaseTrack | null {
  if (!isRecord(value)) {
    return null;
  }

  const trackId = asNullableString(value.track_id);
  const order = asNullableNumber(value.order);
  const title = asNullableString(value.title);

  if (trackId === null || order === null || title === null) {
    return null;
  }

  return {
    track_id: trackId,
    order,
    title,
    is_title_track: value.is_title_track === true,
    spotify: normalizeServiceLink(value.spotify),
    youtube_music: normalizeServiceLink(value.youtube_music),
  };
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function normalizeTracks(value: unknown): ReleaseTrack[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeTrack).filter((track): track is ReleaseTrack => track !== null);
}

function normalizeReleaseCore(value: unknown): ReleaseCore | null {
  if (!isRecord(value)) {
    return null;
  }

  const releaseId = asNullableString(value.release_id);
  const entitySlug = asNullableString(value.entity_slug);
  const displayName = asNullableString(value.display_name);
  const releaseTitle = asNullableString(value.release_title);
  const releaseDate = asNullableString(value.release_date);
  const stream = asNullableString(value.stream);

  if (
    releaseId === null ||
    entitySlug === null ||
    displayName === null ||
    releaseTitle === null ||
    releaseDate === null ||
    stream === null
  ) {
    return null;
  }

  return {
    release_id: releaseId,
    entity_slug: entitySlug,
    display_name: displayName,
    release_title: releaseTitle,
    release_date: releaseDate,
    stream,
    release_kind: asNullableString(value.release_kind),
  };
}

function normalizeReleaseDetailPayload(payload: unknown, releaseId: string): ReleaseDetailData | null {
  if (!isRecord(payload)) {
    return null;
  }

  const release = normalizeReleaseCore(payload.release);
  if (release === null || release.release_id !== releaseId) {
    return null;
  }

  return {
    release,
    artwork: isRecord(payload.artwork) ? payload.artwork : null,
    service_links: {
      spotify: normalizeServiceLink(isRecord(payload.service_links) ? payload.service_links.spotify : null),
      youtube_music: normalizeServiceLink(isRecord(payload.service_links) ? payload.service_links.youtube_music : null),
    },
    tracks: normalizeTracks(payload.tracks),
    mv: {
      url: asNullableString(isRecord(payload.mv) ? payload.mv.url : null),
      video_id: asNullableString(isRecord(payload.mv) ? payload.mv.video_id : null),
      status: asNullableString(isRecord(payload.mv) ? payload.mv.status : null),
      provenance: asNullableString(isRecord(payload.mv) ? payload.mv.provenance : null),
    },
    credits: normalizeRecordArray(payload.credits),
    charts: normalizeRecordArray(payload.charts),
    notes: payload.notes ?? null,
  };
}

function buildLookupData(row: ReleaseDetailProjectionRow): ReleaseLookupData | null {
  const payload = normalizeReleaseDetailPayload(row.payload, row.release_id);
  if (payload === null) {
    return null;
  }

  return {
    release_id: row.release_id,
    canonical_path: `/v1/releases/${row.release_id}`,
    release: payload.release,
  };
}

export function registerReleaseRoutes(app: FastifyInstance, context: ReleaseRouteContext): void {
  app.get('/v1/releases/lookup', async (request) => {
    const { entity_slug, title, date, stream } = request.query as ReleaseLookupQuery;

    if (!entity_slug || !title || !date || !stream) {
      throw routeError(400, 'invalid_request', 'entity_slug, title, date, and stream query parameters are required.');
    }

    const lookup = buildReleaseLookupKey(entity_slug, title, date, stream);
    if (!ISO_DATE_PATTERN.test(lookup.release_date) || !VALID_STREAMS.has(lookup.stream) || lookup.entity_slug.length === 0 || lookup.normalized_release_title.length === 0) {
      throw routeError(
        400,
        'invalid_request',
        'lookup requires a non-empty title, YYYY-MM-DD date, and stream of album or song.',
        {
          lookup: {
            entity_slug,
            title,
            date,
            stream,
          },
        },
      );
    }

    const result = await context.db.query<ReleaseDetailProjectionRow>(
      `
        select
          release_id::text as release_id,
          entity_slug,
          normalized_release_title,
          release_date::text as release_date,
          stream,
          payload,
          generated_at
        from release_detail_projection
        where entity_slug = $1
          and normalized_release_title = projection_normalize_text($2)
          and release_date = $3::date
          and stream = $4
        limit 1
      `,
      [lookup.entity_slug, lookup.normalized_release_title, lookup.release_date, lookup.stream]
    );

    const row = result.rows[0];
    if (!row) {
      throw routeError(404, 'not_found', 'No release matched the supplied legacy lookup key.', {
        lookup: {
          entity_slug,
          title,
          date,
          stream,
        },
      });
    }

    const data = buildLookupData(row);
    if (data === null) {
      throw routeError(500, 'stale_projection', 'release_detail_projection returned an unexpected payload shape.');
    }

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      data,
      {
        lookup: {
          entity_slug,
          title,
          date,
          stream,
        },
      },
      toIsoString(row.generated_at),
    );
  });

  app.get('/v1/releases/:id', async (request) => {
    const { id } = request.params as ReleaseParams;

    if (!UUID_PATTERN.test(id)) {
      throw routeError(400, 'invalid_request', 'release_id must be a UUID.', { release_id: id });
    }

    const result = await context.db.query<ReleaseDetailProjectionRow>(
      `
        select
          release_id::text as release_id,
          entity_slug,
          normalized_release_title,
          release_date::text as release_date,
          stream,
          payload,
          generated_at
        from release_detail_projection
        where release_id = $1::uuid
        limit 1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      throw routeError(404, 'not_found', 'No release detail matched the supplied release_id.', { release_id: id });
    }

    const data = normalizeReleaseDetailPayload(row.payload, row.release_id);
    if (data === null) {
      throw routeError(500, 'stale_projection', 'release_detail_projection returned an unexpected payload shape.', {
        release_id: row.release_id,
      });
    }

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      data,
      { release_id: row.release_id },
      toIsoString(row.generated_at),
    );
  });
}
