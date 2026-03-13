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
  source_url?: string | null;
  artist_source_url?: string | null;
  badge_image_url?: string | null;
  representative_image_url?: string | null;
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
  badge_image_url: string | null;
  representative_image_url: string | null;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind: string | null;
  source_url: string | null;
  artist_source_url: string | null;
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

type VerificationMetadata = {
  status: string | null;
  provenance: string | null;
};

type ReleaseDetailData = {
  release: ReleaseCore;
  detail_metadata: VerificationMetadata;
  title_track_metadata: VerificationMetadata;
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

type ReleaseLookupResolution = {
  row: ReleaseDetailProjectionRow;
  data: ReleaseLookupData;
};

type ScoredReleaseLookupCandidate = {
  row: ReleaseDetailProjectionRow;
  data: ReleaseLookupData;
  detail: ReleaseDetailData;
  score: number;
  dayDistance: number;
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

function normalizeVerificationMetadata(value: unknown): VerificationMetadata {
  if (!isRecord(value)) {
    return {
      status: null,
      provenance: null,
    };
  }

  return {
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
    badge_image_url: asNullableString(value.badge_image_url),
    representative_image_url: asNullableString(value.representative_image_url),
    release_title: releaseTitle,
    release_date: releaseDate,
    stream,
    release_kind: asNullableString(value.release_kind),
    source_url: asNullableString(value.source_url),
    artist_source_url: asNullableString(value.artist_source_url),
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
    detail_metadata: normalizeVerificationMetadata(payload.detail_metadata),
    title_track_metadata: normalizeVerificationMetadata(payload.title_track_metadata),
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

function getVerificationRank(status: string | null): number {
  switch (status) {
    case 'verified':
      return 4;
    case 'manual_override':
      return 3;
    case 'relation_match':
      return 2;
    case 'inferred':
    case 'needs_review':
      return 1;
    default:
      return 0;
  }
}

function getServiceLinkRank(link: ServiceLink | null): number {
  if (link === null) {
    return 0;
  }
  return getVerificationRank(link.status ?? null);
}

function getDayDistance(lookupDate: string, candidateDate: string): number {
  const lookupTime = Date.parse(`${lookupDate}T00:00:00Z`);
  const candidateTime = Date.parse(`${candidateDate}T00:00:00Z`);
  if (!Number.isFinite(lookupTime) || !Number.isFinite(candidateTime)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(candidateTime - lookupTime) / 86_400_000;
}

function scoreReleaseLookupCandidate(candidate: ReleaseDetailData, lookupDate: string): number {
  const detailRank = getVerificationRank(candidate.detail_metadata.status);
  const titleRank = getVerificationRank(candidate.title_track_metadata.status);
  const mvRank = getVerificationRank(candidate.mv.status);
  const spotifyRank = getServiceLinkRank(candidate.service_links.spotify);
  const youtubeMusicRank = getServiceLinkRank(candidate.service_links.youtube_music);
  const trackCountBonus = Math.min(candidate.tracks.length, 12);
  const exactDateBonus = candidate.release.release_date === lookupDate ? 5 : 0;

  return detailRank * 100 + titleRank * 40 + mvRank * 15 + spotifyRank * 6 + youtubeMusicRank * 6 + trackCountBonus + exactDateBonus;
}

function resolveReleaseLookupCandidate(
  rows: ReleaseDetailProjectionRow[],
  lookupDate: string,
): ReleaseLookupResolution | null {
  const candidates = rows
    .map((row) => {
      const detail = normalizeReleaseDetailPayload(row.payload, row.release_id);
      if (detail === null) {
        return null;
      }

      const lookupData: ReleaseLookupData = {
        release_id: row.release_id,
        canonical_path: `/v1/releases/${row.release_id}`,
        release: detail.release,
      };

      return {
        row,
        data: lookupData,
        detail,
        score: scoreReleaseLookupCandidate(detail, lookupDate),
        dayDistance: getDayDistance(lookupDate, detail.release.release_date),
      };
    })
    .filter((candidate): candidate is ScoredReleaseLookupCandidate => candidate !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.dayDistance !== right.dayDistance) {
        return left.dayDistance - right.dayDistance;
      }
      return right.data.release.release_date.localeCompare(left.data.release.release_date);
    });

  if (candidates.length === 0) {
    return null;
  }

  return {
    row: candidates[0].row,
    data: candidates[0].data,
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
          rdp.release_id::text as release_id,
          rdp.entity_slug,
          rdp.normalized_release_title,
          rdp.release_date::text as release_date,
          rdp.stream,
        rdp.payload,
        rdp.generated_at,
        r.source_url,
        r.artist_source_url,
        e.badge_image_url,
        e.representative_image_url
        from release_detail_projection rdp
        left join releases r on r.id = rdp.release_id
        left join entities e on e.id = r.entity_id
        where rdp.entity_slug = $1
          and rdp.normalized_release_title = projection_normalize_text($2)
          and rdp.stream = $4
          and rdp.release_date between ($3::date - interval '1 day') and ($3::date + interval '1 day')
        order by rdp.release_date desc
        limit 5
      `,
      [lookup.entity_slug, lookup.normalized_release_title, lookup.release_date, lookup.stream]
    );

    const resolution = resolveReleaseLookupCandidate(result.rows, lookup.release_date);
    if (!resolution) {
      throw routeError(404, 'not_found', 'No release matched the supplied legacy lookup key.', {
        lookup: {
          entity_slug,
          title,
          date,
          stream,
        },
      });
    }

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      resolution.data,
      {
        lookup: {
          entity_slug,
          title,
          date,
          stream,
        },
      },
      toIsoString(resolution.row.generated_at),
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
          rdp.release_id::text as release_id,
          rdp.entity_slug,
          rdp.normalized_release_title,
          rdp.release_date::text as release_date,
          rdp.stream,
        rdp.payload,
        rdp.generated_at,
        r.source_url,
        r.artist_source_url,
        e.badge_image_url,
        e.representative_image_url
        from release_detail_projection rdp
        left join releases r on r.id = rdp.release_id
        left join entities e on e.id = r.entity_id
        where rdp.release_id = $1::uuid
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

    data.release.source_url = data.release.source_url ?? asNullableString(row.source_url);
    data.release.artist_source_url = data.release.artist_source_url ?? asNullableString(row.artist_source_url);
    data.release.badge_image_url = data.release.badge_image_url ?? asNullableString(row.badge_image_url);
    data.release.representative_image_url =
      data.release.representative_image_url ?? asNullableString(row.representative_image_url);

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      data,
      { release_id: row.release_id },
      toIsoString(row.generated_at),
    );
  });
}
