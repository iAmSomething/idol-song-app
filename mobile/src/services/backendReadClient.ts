import { getRuntimeConfig, type MobileRuntimeConfig } from '../config/runtime';

const DEFAULT_BACKEND_TIMEOUT_MS = 4500;
const DEFAULT_BACKEND_RETRY_COUNT = 1;
const DEFAULT_BACKEND_RETRY_DELAY_MS = 350;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BackendReadEnvelope<T> = {
  meta?: {
    generatedAt?: string | null;
    [key: string]: unknown;
  };
  data: T;
};

export type BackendCalendarRelease = {
  release_id: string;
  entity_slug: string;
  display_name: string;
  badge_image_url?: string | null;
  representative_image_url?: string | null;
  release_title: string;
  release_date?: string;
  stream: string;
  release_kind?: string | null;
};

export type BackendCalendarUpcoming = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
  badge_image_url?: string | null;
  representative_image_url?: string | null;
  headline: string;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision: string;
  date_status: string;
  confidence_score?: number | null;
  release_format?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  source_domain?: string | null;
  evidence_summary?: string | null;
  source_count?: number | null;
};

export type BackendCalendarMonthData = {
  summary: {
    verified_count: number;
    exact_upcoming_count: number;
    month_only_upcoming_count: number;
  };
  nearest_upcoming: BackendCalendarUpcoming | null;
  days: {
    date: string;
    verified_releases: BackendCalendarRelease[];
    exact_upcoming: BackendCalendarUpcoming[];
  }[];
  month_only_upcoming: BackendCalendarUpcoming[];
  verified_list: BackendCalendarRelease[];
  scheduled_list: BackendCalendarUpcoming[];
};

export type BackendSearchEntity = {
  entity_slug: string;
  display_name: string;
  canonical_name: string;
  entity_type: string;
  agency_name?: string | null;
  aliases?: string[];
  latest_release?: {
    release_id: string;
    release_title: string;
    release_date: string;
    stream: string;
    release_kind?: string | null;
  } | null;
  next_upcoming?: {
    headline: string;
    scheduled_date?: string | null;
    scheduled_month?: string | null;
    date_precision: string;
    date_status: string;
    release_format?: string | null;
    confidence_score?: number | null;
  } | null;
  match_reason: string;
  matched_alias?: string | null;
};

export type BackendSearchRelease = {
  release_id: string;
  entity_slug: string;
  display_name: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind?: string | null;
  release_format?: string | null;
  match_reason: string;
  matched_alias?: string | null;
};

export type BackendSearchUpcoming = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
  headline: string;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision: string;
  date_status: string;
  release_format?: string | null;
  confidence_score?: number | null;
  source_type?: string | null;
  source_url?: string | null;
  evidence_summary?: string | null;
  match_reason: string;
  matched_alias?: string | null;
};

export type BackendSearchData = {
  query: string;
  entities: BackendSearchEntity[];
  releases: BackendSearchRelease[];
  upcoming: BackendSearchUpcoming[];
};

export type BackendRadarUpcoming = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
  headline: string;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision: string;
  date_status: string;
  confidence_score?: number | null;
  release_format?: string | null;
  source_url?: string | null;
};

export type BackendRadarChangeFeedItem = {
  kind: 'verified_release' | 'upcoming_signal' | string;
  entity_slug: string;
  display_name: string;
  occurred_at?: string | null;
  release_id?: string | null;
  release_title?: string | null;
  release_date?: string | null;
  stream?: string | null;
  release_kind?: string | null;
  upcoming_signal_id?: string | null;
  headline?: string | null;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision?: string | null;
  date_status?: string | null;
  confidence_score?: number | null;
};

export type BackendRadarReleaseSummary = {
  release_id: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind?: string | null;
};

export type BackendRadarGapOrRookieItem = {
  entity_slug: string;
  display_name: string;
  watch_reason?: string | null;
  latest_release?: BackendRadarReleaseSummary | null;
  gap_days?: number | null;
  has_upcoming_signal: boolean;
  debut_year?: number | null;
  latest_signal?: BackendRadarUpcoming | null;
};

export type BackendRadarData = {
  featured_upcoming: BackendRadarUpcoming | null;
  weekly_upcoming: BackendRadarUpcoming[];
  change_feed: BackendRadarChangeFeedItem[];
  long_gap: BackendRadarGapOrRookieItem[];
  rookie: BackendRadarGapOrRookieItem[];
};

export type BackendEntityReleaseSummary = {
  release_id: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind?: string | null;
  release_format?: string | null;
  badge_image_url?: string | null;
  representative_image_url?: string | null;
  representative_song_title?: string | null;
  spotify_url?: string | null;
  youtube_music_url?: string | null;
  youtube_mv_url?: string | null;
  source_url?: string | null;
  artwork?: {
    cover_image_url?: string | null;
    thumbnail_image_url?: string | null;
  } | null;
};

export type BackendEntityUpcomingSummary = {
  upcoming_signal_id: string;
  headline: string;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision: string;
  date_status: string;
  release_format?: string | null;
  confidence_score?: number | null;
  latest_seen_at?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  source_domain?: string | null;
  evidence_summary?: string | null;
  source_count?: number | null;
};

export type BackendEntityDetailData = {
  identity: {
    entity_slug: string;
    display_name: string;
    canonical_name?: string | null;
    entity_type: string;
    agency_name?: string | null;
    debut_year?: number | null;
    badge_image_url?: string | null;
    badge_source_url?: string | null;
    badge_source_label?: string | null;
    badge_kind?: string | null;
    representative_image_url?: string | null;
    representative_image_source?: string | null;
  };
  official_links: {
    youtube?: string | null;
    x?: string | null;
    instagram?: string | null;
  };
  youtube_channels: {
    primary_team_channel_url?: string | null;
    mv_allowlist_urls?: string[];
  };
  tracking_state: {
    tier?: string | null;
    watch_reason?: string | null;
    tracking_status?: string | null;
  };
  next_upcoming: BackendEntityUpcomingSummary | null;
  latest_release: BackendEntityReleaseSummary | null;
  recent_albums: BackendEntityReleaseSummary[];
  source_timeline: {
    event_type?: string | null;
    headline: string;
    occurred_at?: string | null;
    summary?: string | null;
    source_url?: string | null;
    source_type?: string | null;
    source_domain?: string | null;
    published_at?: string | null;
    scheduled_date?: string | null;
    scheduled_month?: string | null;
    date_precision?: string | null;
    date_status?: string | null;
    release_format?: string | null;
    confidence_score?: number | null;
    evidence_summary?: string | null;
    source_count?: number | null;
  }[];
  artist_source_url?: string | null;
};

export type BackendReleaseLookupData = {
  release_id: string;
  canonical_path: string;
  release: {
    release_id: string;
    entity_slug: string;
    display_name: string;
    release_title: string;
    release_date: string;
    stream: string;
    release_kind?: string | null;
  };
};

export type BackendReleaseDetailData = {
  release: {
    release_id: string;
    entity_slug: string;
    display_name: string;
    badge_image_url?: string | null;
    representative_image_url?: string | null;
    release_title: string;
    release_date: string;
    stream: string;
    release_kind?: string | null;
  };
  detail_metadata?: {
    status?: string | null;
    provenance?: string | null;
  } | null;
  title_track_metadata?: {
    status?: string | null;
    provenance?: string | null;
  } | null;
  artwork?: {
    image_url?: string | null;
    cover_image_url?: string | null;
    thumbnail_image_url?: string | null;
    source_url?: string | null;
    is_placeholder?: boolean | null;
  } | null;
  service_links?: {
    spotify?: {
      url?: string | null;
      status?: string | null;
      provenance?: string | null;
    } | null;
    youtube_music?: {
      url?: string | null;
      status?: string | null;
      provenance?: string | null;
    } | null;
  } | null;
  tracks?: {
    track_id: string;
    order: number;
    title: string;
    is_title_track?: boolean;
    spotify?: {
      url?: string | null;
    } | null;
    youtube_music?: {
      url?: string | null;
    } | null;
  }[] | null;
  mv?: {
    url?: string | null;
    video_id?: string | null;
    status?: string | null;
    provenance?: string | null;
  } | null;
  notes?: unknown;
};

export type BackendResolvedReleaseDetail = {
  lookup: BackendReadEnvelope<BackendReleaseLookupData>;
  detail: BackendReadEnvelope<BackendReleaseDetailData>;
};

export class BackendReadError extends Error {
  status: number | null;
  code: string | null;
  requestId: string | null;

  constructor(
    message: string,
    options: { status?: number | null; code?: string | null; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'BackendReadError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
  }
}

export type BackendReadClientOptions = {
  retryCount?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

function buildUrl(baseUrl: string, pathname: string, searchParams?: Record<string, string | number | undefined>): string {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, '');
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) {
      continue;
    }
    query.set(key, String(value));
  }

  const queryString = query.toString();
  return `${trimmedBaseUrl}${pathname}${queryString ? `?${queryString}` : ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLegacyReleaseId(legacyReleaseId: string): {
  entitySlug: string;
  releaseTitle: string;
  releaseDate: string;
  stream: string;
} | null {
  const parts = legacyReleaseId
    .split('--')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 4) {
    return null;
  }

  const stream = parts.at(-1)?.toLowerCase() ?? '';
  const releaseDate = parts.at(-2) ?? '';
  const entitySlug = parts[0] ?? '';
  const releaseTitle = parts.slice(1, -2).join(' ');

  if (!entitySlug || !releaseTitle || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return null;
  }

  if (stream !== 'album' && stream !== 'song') {
    return null;
  }

  return {
    entitySlug,
    releaseTitle,
    releaseDate,
    stream,
  };
}

function isCanonicalReleaseId(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

async function readJsonResponse<T>(response: Response): Promise<BackendReadEnvelope<T>> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    throw new BackendReadError('Backend response was not valid JSON.', {
      status: response.status,
    });
  }

  const requestId =
    response.headers?.get?.('x-request-id') ??
    response.headers?.get?.('x-correlation-id') ??
    response.headers?.get?.('x-vercel-id') ??
    null;

  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `Backend request failed with status ${response.status}.`;
    const code =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.code === 'string'
        ? payload.error.code
        : null;
    throw new BackendReadError(message, {
      status: response.status,
      code,
      requestId,
    });
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new BackendReadError('Backend response envelope was missing data.', {
      requestId,
    });
  }

  return payload as BackendReadEnvelope<T>;
}

export type BackendReadClient = {
  getCalendarMonth(month: string): Promise<BackendReadEnvelope<BackendCalendarMonthData>>;
  getSearch(query: string, limit?: number): Promise<BackendReadEnvelope<BackendSearchData>>;
  getRadar(): Promise<BackendReadEnvelope<BackendRadarData>>;
  getEntityDetail(slug: string): Promise<BackendReadEnvelope<BackendEntityDetailData>>;
  lookupRelease(params: {
    entitySlug: string;
    releaseTitle: string;
    releaseDate: string;
    stream: string;
  }): Promise<BackendReadEnvelope<BackendReleaseLookupData>>;
  getReleaseDetail(releaseId: string): Promise<BackendReadEnvelope<BackendReleaseDetailData>>;
  getReleaseDetailForRouteId(routeReleaseId: string): Promise<BackendReadEnvelope<BackendReleaseDetailData>>;
  getReleaseDetailByLegacyId(legacyReleaseId: string): Promise<BackendResolvedReleaseDetail>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRetryableBackendError(error: BackendReadError): boolean {
  if (error.code === 'timeout' || error.code === 'network_unavailable') {
    return true;
  }

  if (error.status && RETRYABLE_STATUS_CODES.has(error.status)) {
    return true;
  }

  return false;
}

function wrapFetchError(error: unknown): BackendReadError {
  if (error instanceof BackendReadError) {
    return error;
  }

  if (isAbortError(error)) {
    return new BackendReadError('백엔드 응답이 지연되어 요청을 중단했습니다. 다시 시도해 주세요.', {
      code: 'timeout',
    });
  }

  const message =
    error instanceof Error && error.message
      ? error.message
      : '백엔드에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';

  return new BackendReadError(message, {
    code: 'network_unavailable',
  });
}

export function createBackendReadClient(
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  fetchImpl: typeof fetch = fetch,
  options: BackendReadClientOptions = {},
): BackendReadClient {
  const baseUrl = runtimeConfig.services.apiBaseUrl;

  if (!baseUrl) {
    throw new BackendReadError('Backend API base URL is not configured.');
  }

  const resolvedBaseUrl = baseUrl;
  const timeoutMs = options.timeoutMs ?? DEFAULT_BACKEND_TIMEOUT_MS;
  const retryCount = options.retryCount ?? DEFAULT_BACKEND_RETRY_COUNT;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_BACKEND_RETRY_DELAY_MS;

  async function get<T>(pathname: string, searchParams?: Record<string, string | number | undefined>) {
    const url = buildUrl(resolvedBaseUrl, pathname, searchParams);
    let lastError: BackendReadError | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller =
        typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId =
        controller && timeoutMs > 0
          ? setTimeout(() => controller.abort(), timeoutMs)
          : null;

      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller?.signal,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        return await readJsonResponse<T>(response);
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const backendError = wrapFetchError(error);
        lastError = backendError;

        if (attempt < retryCount && isRetryableBackendError(backendError)) {
          await delay(retryDelayMs);
          continue;
        }

        throw backendError;
      }
    }

    throw lastError ?? new BackendReadError('Backend request failed.');
  }

  return {
    getCalendarMonth(month) {
      return get<BackendCalendarMonthData>('/v1/calendar/month', { month });
    },
    getSearch(query, limit = 8) {
      return get<BackendSearchData>('/v1/search', { q: query, limit });
    },
    getRadar() {
      return get<BackendRadarData>('/v1/radar');
    },
    getEntityDetail(slug) {
      return get<BackendEntityDetailData>(`/v1/entities/${encodeURIComponent(slug)}`);
    },
    lookupRelease({ entitySlug, releaseTitle, releaseDate, stream }) {
      return get<BackendReleaseLookupData>('/v1/releases/lookup', {
        entity_slug: entitySlug,
        title: releaseTitle,
        date: releaseDate,
        stream,
      });
    },
    getReleaseDetail(releaseId) {
      return get<BackendReleaseDetailData>(`/v1/releases/${encodeURIComponent(releaseId)}`);
    },
    getReleaseDetailForRouteId(routeReleaseId) {
      const trimmedRouteReleaseId = routeReleaseId.trim();

      if (isCanonicalReleaseId(trimmedRouteReleaseId)) {
        return get<BackendReleaseDetailData>(
          `/v1/releases/${encodeURIComponent(trimmedRouteReleaseId)}`,
        );
      }

      return this.getReleaseDetailByLegacyId(trimmedRouteReleaseId).then((resolved) => resolved.detail);
    },
    async getReleaseDetailByLegacyId(legacyReleaseId) {
      const parsed = parseLegacyReleaseId(legacyReleaseId);
      if (!parsed) {
        throw new BackendReadError('Release detail route could not resolve the legacy release identifier.', {
          code: 'invalid_release_lookup',
        });
      }

      const lookup = await get<BackendReleaseLookupData>('/v1/releases/lookup', {
        entity_slug: parsed.entitySlug,
        title: parsed.releaseTitle,
        date: parsed.releaseDate,
        stream: parsed.stream,
      });
      const detail = await get<BackendReleaseDetailData>(
        `/v1/releases/${encodeURIComponent(lookup.data.release_id)}`,
      );

      return {
        lookup,
        detail,
      };
    },
  };
}
