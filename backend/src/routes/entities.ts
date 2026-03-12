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

type ReleaseDetailProjectionRow = {
  release_id: string;
  payload: unknown;
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
  badge_source_url: string | null;
  badge_source_label: string | null;
  badge_kind: string | null;
  representative_image_url: string | null;
  representative_image_source: string | null;
  field_metadata: Record<string, MetadataFieldSummary>;
};

type TrackingStateBlock = {
  tier: string | null;
  watch_reason: string | null;
  tracking_status: string | null;
};

type ArtworkSummary = {
  cover_image_url: string | null;
  thumbnail_image_url: string | null;
  artwork_source_type: string | null;
  artwork_source_url: string | null;
  artwork_status: string | null;
  artwork_provenance: string | null;
  is_placeholder: boolean;
};

type MetadataFieldSummary = {
  value: unknown;
  status: string | null;
  provenance: string | null;
  source_url: string | null;
  review_notes: string | null;
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
  source_type: string | null;
  source_url: string | null;
  source_domain: string | null;
  evidence_summary: string | null;
  source_count: number | null;
};

type ReleaseSummary = {
  release_id: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind: string | null;
  release_format: string | null;
  representative_song_title: string | null;
  spotify_url: string | null;
  youtube_music_url: string | null;
  youtube_mv_url: string | null;
  source_url: string | null;
  artwork: ArtworkSummary | null;
};

type SourceTimelineItem = {
  event_type: string;
  headline: string;
  occurred_at: string;
  summary: string | null;
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
  evidence_summary: string | null;
  source_count: number | null;
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

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deriveScheduledMonth(scheduledDate: string | null, scheduledMonth: string | null): string | null {
  if (scheduledMonth) {
    return scheduledMonth;
  }

  if (scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return scheduledDate.slice(0, 7);
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

function resolveTodayIsoDate(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeArtworkSummary(value: unknown): ArtworkSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const coverImageUrl = asNullableString(value.cover_image_url);
  const thumbnailImageUrl = asNullableString(value.thumbnail_image_url);
  const artworkSourceType = asNullableString(value.artwork_source_type);
  const artworkSourceUrl = asNullableString(value.artwork_source_url);
  const artworkStatus = asNullableString(value.artwork_status);
  const artworkProvenance = asNullableString(value.artwork_provenance);
  const isPlaceholder =
    asNullableBoolean(value.is_placeholder) === true || artworkStatus === 'placeholder';

  if (
    !coverImageUrl &&
    !thumbnailImageUrl &&
    !artworkSourceType &&
    !artworkSourceUrl &&
    !artworkStatus &&
    !artworkProvenance &&
    !isPlaceholder
  ) {
    return null;
  }

  return {
    cover_image_url: coverImageUrl,
    thumbnail_image_url: thumbnailImageUrl,
    artwork_source_type: artworkSourceType,
    artwork_source_url: artworkSourceUrl,
    artwork_status: artworkStatus,
    artwork_provenance: artworkProvenance,
    is_placeholder: isPlaceholder,
  };
}

function normalizeMetadataFieldSummary(value: unknown): MetadataFieldSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const hasValue = Object.prototype.hasOwnProperty.call(value, 'value');
  const status = asNullableString(value.status);
  const provenance = asNullableString(value.provenance);
  const sourceUrl = asNullableString(value.source_url);
  const reviewNotes = asNullableString(value.review_notes);

  if (!hasValue && !status && !provenance && !sourceUrl && !reviewNotes) {
    return null;
  }

  return {
    value: hasValue ? value.value ?? null : null,
    status,
    provenance,
    source_url: sourceUrl,
    review_notes: reviewNotes,
  };
}

function normalizeMetadataFieldMap(value: unknown): Record<string, MetadataFieldSummary> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, fieldValue]) => [key, normalizeMetadataFieldSummary(fieldValue)] as const)
      .filter((entry): entry is [string, MetadataFieldSummary] => entry[1] !== null)
  );
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
    release_format: asNullableString(value.release_format),
    representative_song_title: asNullableString(value.representative_song_title),
    spotify_url: asNullableString(value.spotify_url),
    youtube_music_url: asNullableString(value.youtube_music_url),
    youtube_mv_url: asNullableString(value.youtube_mv_url),
    source_url: asNullableString(value.source_url),
    artwork: normalizeArtworkSummary(value.artwork),
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

function normalizeComparableTitle(value: string | null): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getReleaseSummarySortScore(release: ReleaseSummary): number {
  let score = 0;

  if (release.release_kind) {
    score += 4;
  }

  if (release.release_format) {
    score += 2;
  }

  if (release.artwork?.is_placeholder === false && (release.artwork.cover_image_url || release.artwork.thumbnail_image_url)) {
    score += 1;
  }

  return score;
}

function dedupeRecentAlbumSummaries(releases: ReleaseSummary[]): ReleaseSummary[] {
  const deduped: ReleaseSummary[] = [];

  for (const release of releases) {
    const releaseTitle = normalizeComparableTitle(release.release_title);
    const releaseTime = Date.parse(`${release.release_date}T00:00:00Z`);

    const duplicateIndex = deduped.findIndex((existing) => {
      if (normalizeComparableTitle(existing.release_title) !== releaseTitle) {
        return false;
      }

      const existingTime = Date.parse(`${existing.release_date}T00:00:00Z`);
      if (!Number.isFinite(releaseTime) || !Number.isFinite(existingTime)) {
        return false;
      }

      return Math.abs(releaseTime - existingTime) <= 7 * 24 * 60 * 60 * 1000;
    });

    if (duplicateIndex === -1) {
      deduped.push(release);
      continue;
    }

    const existing = deduped[duplicateIndex];
    const existingScore = getReleaseSummarySortScore(existing);
    const releaseScore = getReleaseSummarySortScore(release);

    if (
      releaseScore > existingScore ||
      (releaseScore === existingScore && release.release_date > existing.release_date)
    ) {
      deduped[duplicateIndex] = release;
    }
  }

  return deduped;
}

function extractRepresentativeSongTitle(tracks: unknown): string | null {
  if (!Array.isArray(tracks)) {
    return null;
  }

  const titleTrack = tracks.find((track) => {
    if (!isRecord(track)) {
      return false;
    }

    return track.is_title_track === true && typeof track.title === 'string' && track.title.length > 0;
  });

  if (!isRecord(titleTrack)) {
    return null;
  }

  return asNullableString(titleTrack.title);
}

function mergeReleaseSummaryWithDetail(
  release: ReleaseSummary,
  detailPayload: unknown,
): ReleaseSummary {
  if (!isRecord(detailPayload)) {
    return release;
  }

  const serviceLinks = isRecord(detailPayload.service_links) ? detailPayload.service_links : null;
  const spotify = serviceLinks && isRecord(serviceLinks.spotify) ? serviceLinks.spotify : null;
  const youtubeMusic =
    serviceLinks && isRecord(serviceLinks.youtube_music) ? serviceLinks.youtube_music : null;
  const mv = isRecord(detailPayload.mv) ? detailPayload.mv : null;
  const artwork = normalizeArtworkSummary(detailPayload.artwork);

  return {
    ...release,
    representative_song_title:
      extractRepresentativeSongTitle(detailPayload.tracks) ?? release.representative_song_title,
    spotify_url: asNullableString(spotify?.url) ?? release.spotify_url,
    youtube_music_url: asNullableString(youtubeMusic?.url) ?? release.youtube_music_url,
    youtube_mv_url: asNullableString(mv?.url) ?? release.youtube_mv_url,
    artwork: artwork ?? release.artwork,
  };
}

async function hydrateReleaseSummaries(
  db: DbQueryable,
  releases: ReleaseSummary[],
): Promise<ReleaseSummary[]> {
  const releaseIds = [...new Set(releases.map((release) => release.release_id).filter(Boolean))];

  if (releaseIds.length === 0) {
    return releases;
  }

  const result = await db.query<ReleaseDetailProjectionRow>(
    `
      select release_id::text as release_id, payload
      from release_detail_projection
      where release_id = any($1::uuid[])
    `,
    [releaseIds],
  );

  const payloadByReleaseId = new Map(
    result.rows.map((row) => [row.release_id, row.payload] as const),
  );

  return releases.map((release) =>
    mergeReleaseSummaryWithDetail(release, payloadByReleaseId.get(release.release_id)),
  );
}

function normalizeSourceTimeline(value: unknown): SourceTimelineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => {
      const headline = asNullableString(item.headline) ?? '';
      const scheduledDate = asNullableString(item.scheduled_date);
      const scheduledMonth = deriveScheduledMonth(scheduledDate, asNullableString(item.scheduled_month));
      const publishedAt = asNullableString(item.published_at);
      const occurredAt = asNullableString(item.occurred_at) ?? publishedAt ?? scheduledDate ?? scheduledMonth ?? '';
      const releaseFormat = asNullableString(item.release_format);
      const dateStatus = asNullableString(item.date_status);
      const eventType =
        asNullableString(item.event_type) ??
        (headline.toLowerCase().includes('tracklist')
          ? 'tracklist_reveal'
          : scheduledDate
            ? dateStatus === 'confirmed'
              ? 'official_announcement'
              : 'date_update'
            : scheduledMonth
              ? 'date_update'
              : 'first_signal');
      const fallbackSummary = [releaseFormat, dateStatus, scheduledDate ?? scheduledMonth]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
      const summary = asNullableString(item.summary) ?? (fallbackSummary || null);

      return {
        event_type: eventType,
        headline,
        occurred_at: occurredAt,
        summary,
        source_url: asNullableString(item.source_url),
        source_type: asNullableString(item.source_type),
        source_domain: asNullableString(item.source_domain),
        published_at: publishedAt ?? occurredAt,
        scheduled_date: scheduledDate,
        scheduled_month: scheduledMonth,
        date_precision: asNullableString(item.date_precision),
        date_status: dateStatus,
        release_format: releaseFormat,
        confidence_score: asNullableNumber(item.confidence_score),
        evidence_summary: asNullableString(item.evidence_summary),
        source_count: asNullableNumber(item.source_count),
      };
    })
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
    scheduled_month: deriveScheduledMonth(asNullableString(value.scheduled_date), asNullableString(value.scheduled_month)),
    date_precision: datePrecision,
    date_status: dateStatus,
    release_format: asNullableString(value.release_format),
    confidence_score: asNullableNumber(value.confidence_score),
    latest_seen_at: asNullableString(value.latest_seen_at),
    source_type: asNullableString(value.source_type),
    source_url: asNullableString(value.source_url),
    source_domain: asNullableString(value.source_domain),
    evidence_summary: asNullableString(value.evidence_summary),
    source_count: asNullableNumber(value.source_count),
  };
}

function filterElapsedExactUpcomingSummary(upcoming: UpcomingSummary | null, todayIsoDate: string): UpcomingSummary | null {
  if (!upcoming) {
    return null;
  }

  return upcoming.date_precision === 'exact' && upcoming.scheduled_date && upcoming.scheduled_date < todayIsoDate
    ? null
    : upcoming;
}

function filterElapsedOrReleasedExactUpcomingSummary(
  upcoming: UpcomingSummary | null,
  todayIsoDate: string,
  latestReleaseDate: string | null | undefined,
): UpcomingSummary | null {
  if (!upcoming) {
    return null;
  }

  if (upcoming.date_precision !== 'exact' || !upcoming.scheduled_date) {
    return upcoming;
  }

  if (upcoming.scheduled_date < todayIsoDate) {
    return null;
  }

  if (latestReleaseDate && upcoming.scheduled_date === latestReleaseDate) {
    return null;
  }

  return upcoming;
}

function normalizeTrackingStateForSurface(tier: string | null, watchReason: string | null, trackingStatus: string | null): TrackingStateBlock {
  if (tier === 'longtail' && trackingStatus === 'watch_only') {
    return {
      tier: 'tracked',
      watch_reason: watchReason === 'manual_watch' ? null : watchReason,
      tracking_status: trackingStatus,
    };
  }

  return {
    tier,
    watch_reason: watchReason,
    tracking_status: trackingStatus,
  };
}

function normalizeEntityDetailPayload(payload: unknown, slug: string, todayIsoDate: string): EntityDetailPayload | null {
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
  const officialYoutubeUrl = asNullableString(officialLinks.youtube);
  const normalizedLatestRelease = normalizeReleaseSummary(payload.latest_release);
  const normalizedTrackingState = normalizeTrackingStateForSurface(
    asNullableString(trackingState.tier),
    asNullableString(trackingState.watch_reason),
    asNullableString(trackingState.tracking_status),
  );

  return {
    identity: {
      entity_slug: identitySlug,
      display_name: displayName,
      canonical_name: canonicalName,
      entity_type: entityType,
      agency_name: asNullableString(identityValue.agency_name),
      debut_year: asNullableNumber(identityValue.debut_year),
      badge_image_url: asNullableString(identityValue.badge_image_url),
      badge_source_url: asNullableString(identityValue.badge_source_url),
      badge_source_label: asNullableString(identityValue.badge_source_label),
      badge_kind: asNullableString(identityValue.badge_kind),
      representative_image_url: asNullableString(identityValue.representative_image_url),
      representative_image_source: asNullableString(identityValue.representative_image_source),
      field_metadata: normalizeMetadataFieldMap(identityValue.field_metadata),
    },
    official_links: {
      youtube: officialYoutubeUrl,
      x: asNullableString(officialLinks.x),
      instagram: asNullableString(officialLinks.instagram),
    },
    youtube_channels: {
      primary_team_channel_url: asNullableString(youtubeChannels.primary_team_channel_url) ?? officialYoutubeUrl,
      mv_allowlist_urls: mvAllowlistUrls,
    },
    tracking_state: normalizedTrackingState,
    next_upcoming: filterElapsedOrReleasedExactUpcomingSummary(
      normalizeUpcomingSummary(payload.next_upcoming),
      todayIsoDate,
      normalizedLatestRelease?.release_date,
    ),
    latest_release: normalizedLatestRelease,
    recent_albums: dedupeRecentAlbumSummaries(normalizeReleaseSummaryArray(payload.recent_albums)),
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

    const normalized = normalizeEntityDetailPayload(row.payload, slug, resolveTodayIsoDate(context.config.appTimezone));
    if (!normalized) {
      throw routeError(500, 'stale_projection', 'entity_detail_projection returned an unexpected payload shape.', {
        entity_slug: slug,
      });
    }

    const [latestRelease] = await hydrateReleaseSummaries(
      context.db,
      normalized.latest_release ? [normalized.latest_release] : [],
    );
    const recentAlbums = await hydrateReleaseSummaries(context.db, normalized.recent_albums);
    const data: EntityDetailPayload = {
      ...normalized,
      latest_release: latestRelease ?? normalized.latest_release,
      recent_albums: recentAlbums,
    };

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      data,
      { entity_slug: slug },
      toIsoString(row.generated_at),
    );
  });
}
