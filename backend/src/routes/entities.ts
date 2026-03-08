import type { FastifyInstance } from 'fastify';

import { buildReadDataEnvelope, routeError } from '../lib/api.js';
import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';
import { normalizeSlugValue } from '../lib/normalization.js';

type EntityRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type EntityChannelRow = {
  entity_id: string;
  slug: string;
  display_name: string;
  entity_type: string;
  canonical_channel_url: string | null;
  channel_label: string | null;
  owner_type: string | null;
  display_in_team_links: boolean | null;
  allow_mv_uploads: boolean | null;
  provenance: string | null;
  channel_role: string | null;
};

type EntityDetailProjectionRow = {
  entity_slug: string;
  payload: unknown;
  generated_at: Date | string;
};

type EntitySlugParams = {
  slug: string;
};

type IdentityBlock = {
  entity_slug: string;
  display_name: string;
  canonical_name: string;
  entity_type: string;
  agency_name: string | null;
  debut_year: number | null;
  badge_image_url: string | null;
  representative_image_url: string | null;
};

type TrackingStateBlock = {
  tier: string | null;
  watch_reason: string | null;
  tracking_status: string | null;
};

type UpcomingSummary = {
  upcoming_signal_id: string;
  headline: string;
  scheduled_date: string | null;
  scheduled_month: string | null;
  date_precision: string;
  date_status: string;
  release_format: string | null;
  confidence_score: number | null;
  latest_seen_at: string | null;
};

type ReleaseSummary = {
  release_id: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind: string | null;
};

type SourceTimelineItem = {
  headline: string;
  source_url: string | null;
  source_type: string | null;
  source_domain: string | null;
  published_at: string | null;
  scheduled_date: string | null;
  scheduled_month: string | null;
  date_precision: string | null;
  date_status: string | null;
  release_format: string | null;
  confidence_score: number | null;
};

type EntityDetailPayload = {
  identity: IdentityBlock;
  official_links: {
    youtube: string | null;
    x: string | null;
    instagram: string | null;
  };
  youtube_channels: {
    primary_team_channel_url: string | null;
    mv_allowlist_urls: string[];
  };
  tracking_state: TrackingStateBlock;
  next_upcoming: UpcomingSummary | null;
  latest_release: ReleaseSummary | null;
  recent_albums: ReleaseSummary[];
  source_timeline: SourceTimelineItem[];
  artist_source_url: string | null;
};

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizeReleaseSummary(value: unknown): ReleaseSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const releaseId = asNullableString(value.release_id);
  const releaseTitle = asNullableString(value.release_title);
  const releaseDate = asNullableString(value.release_date);
  const stream = asNullableString(value.stream);

  if (!releaseId || !releaseTitle || !releaseDate || !stream) {
    return null;
  }

  return {
    release_id: releaseId,
    release_title: releaseTitle,
    release_date: releaseDate,
    stream,
    release_kind: asNullableString(value.release_kind),
  };
}

function normalizeReleaseSummaryArray(value: unknown): ReleaseSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeReleaseSummary)
    .filter((item): item is ReleaseSummary => item !== null);
}

function normalizeSourceTimeline(value: unknown): SourceTimelineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      headline: asNullableString(item.headline) ?? '',
      source_url: asNullableString(item.source_url),
      source_type: asNullableString(item.source_type),
      source_domain: asNullableString(item.source_domain),
      published_at: asNullableString(item.published_at),
      scheduled_date: asNullableString(item.scheduled_date),
      scheduled_month: asNullableString(item.scheduled_month),
      date_precision: asNullableString(item.date_precision),
      date_status: asNullableString(item.date_status),
      release_format: asNullableString(item.release_format),
      confidence_score: asNullableNumber(item.confidence_score),
    }))
    .filter((item) => item.headline.length > 0);
}

function normalizeUpcomingSummary(value: unknown): UpcomingSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const upcomingSignalId = asNullableString(value.upcoming_signal_id);
  const headline = asNullableString(value.headline);
  const datePrecision = asNullableString(value.date_precision);
  const dateStatus = asNullableString(value.date_status);

  if (!upcomingSignalId || !headline || !datePrecision || !dateStatus) {
    return null;
  }

  return {
    upcoming_signal_id: upcomingSignalId,
    headline,
    scheduled_date: asNullableString(value.scheduled_date),
    scheduled_month: asNullableString(value.scheduled_month),
    date_precision: datePrecision,
    date_status: dateStatus,
    release_format: asNullableString(value.release_format),
    confidence_score: asNullableNumber(value.confidence_score),
    latest_seen_at: asNullableString(value.latest_seen_at),
  };
}

function normalizeEntityDetailPayload(payload: unknown, slug: string): EntityDetailPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const identityValue = isRecord(payload.identity) ? payload.identity : null;
  if (!identityValue) {
    return null;
  }

  const identitySlug = asNullableString(identityValue.entity_slug);
  const displayName = asNullableString(identityValue.display_name);
  const canonicalName = asNullableString(identityValue.canonical_name);
  const entityType = asNullableString(identityValue.entity_type);

  if (!identitySlug || !displayName || !canonicalName || !entityType || identitySlug !== slug) {
    return null;
  }

  const officialLinks = isRecord(payload.official_links) ? payload.official_links : {};
  const youtubeChannels = isRecord(payload.youtube_channels) ? payload.youtube_channels : {};
  const trackingState = isRecord(payload.tracking_state) ? payload.tracking_state : {};

  const mvAllowlistUrls = Array.isArray(youtubeChannels.mv_allowlist_urls)
    ? youtubeChannels.mv_allowlist_urls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];

  return {
    identity: {
      entity_slug: identitySlug,
      display_name: displayName,
      canonical_name: canonicalName,
      entity_type: entityType,
      agency_name: asNullableString(identityValue.agency_name),
      debut_year: asNullableNumber(identityValue.debut_year),
      badge_image_url: asNullableString(identityValue.badge_image_url),
      representative_image_url: asNullableString(identityValue.representative_image_url),
    },
    official_links: {
      youtube: asNullableString(officialLinks.youtube),
      x: asNullableString(officialLinks.x),
      instagram: asNullableString(officialLinks.instagram),
    },
    youtube_channels: {
      primary_team_channel_url: asNullableString(youtubeChannels.primary_team_channel_url),
      mv_allowlist_urls: mvAllowlistUrls,
    },
    tracking_state: {
      tier: asNullableString(trackingState.tier),
      watch_reason: asNullableString(trackingState.watch_reason),
      tracking_status: asNullableString(trackingState.tracking_status),
    },
    next_upcoming: normalizeUpcomingSummary(payload.next_upcoming),
    latest_release: normalizeReleaseSummary(payload.latest_release),
    recent_albums: normalizeReleaseSummaryArray(payload.recent_albums),
    source_timeline: normalizeSourceTimeline(payload.source_timeline),
    artist_source_url: asNullableString(payload.artist_source_url),
  };
}

export function registerEntityRoutes(app: FastifyInstance, context: EntityRouteContext): void {
  app.get('/v1/entities/:slug/channels', async (request) => {
    const { slug: rawSlug } = request.params as EntitySlugParams;
    const slug = normalizeSlugValue(rawSlug);

    if (!slug) {
      throw routeError(400, 'invalid_request', 'slug path parameter must contain a valid entity slug.', {
        slug: rawSlug,
      });
    }

    const result = await context.db.query<EntityChannelRow>(
      `
        select
          e.id::text as entity_id,
          e.slug,
          e.display_name,
          e.entity_type,
          yc.canonical_channel_url,
          yc.channel_label,
          yc.owner_type,
          yc.display_in_team_links,
          yc.allow_mv_uploads,
          yc.provenance,
          eyc.channel_role
        from entities e
        left join entity_youtube_channels eyc on eyc.entity_id = e.id
        left join youtube_channels yc on yc.id = eyc.youtube_channel_id
        where e.slug = $1
        order by
          case eyc.channel_role
            when 'both' then 0
            when 'primary_team_channel' then 1
            when 'mv_allowlist' then 2
            else 3
          end,
          yc.channel_label nulls last
      `,
      [slug]
    );

    const entity = result.rows[0];
    if (!entity) {
      throw routeError(404, 'not_found', 'No entity matched the supplied slug.', { slug });
    }

    return buildReadDataEnvelope(request, context.config.appTimezone, {
        entity: {
          entity_id: entity.entity_id,
          slug: entity.slug,
          display_name: entity.display_name,
          entity_type: entity.entity_type,
        },
        channels: result.rows
          .filter((row) => row.canonical_channel_url !== null)
          .map((row) => ({
            canonical_channel_url: row.canonical_channel_url,
            channel_label: row.channel_label,
            owner_type: row.owner_type,
            display_in_team_links: row.display_in_team_links === true,
            allow_mv_uploads: row.allow_mv_uploads === true,
            provenance: row.provenance,
            channel_role: row.channel_role,
          })),
        summary: {
          official_youtube_url:
            result.rows.find((row) => row.display_in_team_links === true)?.canonical_channel_url ?? null,
          mv_allowlist_urls: result.rows
            .filter((row) => row.allow_mv_uploads === true)
            .map((row) => asNullableString(row.canonical_channel_url))
            .filter((url): url is string => url !== null),
        },
      },
      { slug },
    );
  });

  app.get('/v1/entities/:slug', async (request) => {
    const { slug: rawSlug } = request.params as EntitySlugParams;
    const slug = normalizeSlugValue(rawSlug);

    if (!slug) {
      throw routeError(400, 'invalid_request', 'slug path parameter must contain a valid entity slug.', {
        slug: rawSlug,
      });
    }

    const result = await context.db.query<EntityDetailProjectionRow>(
      `
        select entity_slug, payload, generated_at
        from entity_detail_projection
        where entity_slug = $1
        limit 1
      `,
      [slug]
    );

    const row = result.rows[0];
    if (!row) {
      throw routeError(404, 'not_found', 'No entity matched the supplied slug.', { entity_slug: slug });
    }

    const data = normalizeEntityDetailPayload(row.payload, slug);
    if (!data) {
      throw routeError(500, 'stale_projection', 'entity_detail_projection returned an unexpected payload shape.', {
        entity_slug: slug,
      });
    }

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      data,
      { entity_slug: slug },
      toIsoString(row.generated_at),
    );
  });
}
