import type {
  CalendarMonthSnapshotModel,
  EntityDetailSnapshotModel,
  EntityTimelineItemModel,
  RadarChangeFeedItemModel,
  RadarLongGapItemModel,
  RadarRookieItemModel,
  RadarSnapshotModel,
  RadarUpcomingCardModel,
  ReleaseDetailModel,
  ReleaseSummaryModel,
  SearchReleaseResultModel,
  SearchResultsModel,
  SearchTeamResultModel,
  SearchUpcomingResultModel,
  TeamSummaryModel,
  TrackModel,
  UpcomingEventModel,
} from '../types';
import type {
  BackendCalendarMonthData,
  BackendCalendarRelease,
  BackendCalendarUpcoming,
  BackendEntityDetailData,
  BackendEntityReleaseSummary,
  BackendEntityUpcomingSummary,
  BackendRadarChangeFeedItem,
  BackendRadarData,
  BackendRadarGapOrRookieItem,
  BackendRadarUpcoming,
  BackendReleaseDetailData,
  BackendSearchData,
  BackendSearchEntity,
  BackendSearchRelease,
  BackendSearchUpcoming,
} from './backendReadClient';
import {
  MOBILE_COPY,
  formatMonthOnlyDateLabel,
  resolveUpcomingStatusWithFallback,
} from '../copy/mobileCopy';
import {
  buildMonogram,
  normalizeReleaseKind,
  normalizeReleaseStream,
  normalizeUpcomingConfidence,
  normalizeUpcomingDatePrecision,
  normalizeUpcomingSourceType,
  normalizeUpcomingStatus,
} from '../selectors/normalize';

function resolveActType(value?: string | null): TeamSummaryModel['actType'] {
  if (value === 'solo' || value === 'unit' || value === 'project' || value === 'group') {
    return value;
  }

  return 'group';
}

function buildTeamSummary(input: {
  slug: string;
  displayName: string;
  canonicalName?: string | null;
  entityType?: string | null;
  agencyName?: string | null;
  debutYear?: number | null;
  badgeImageUrl?: string | null;
  representativeImageUrl?: string | null;
  officialYoutubeUrl?: string | null;
  officialXUrl?: string | null;
  officialInstagramUrl?: string | null;
  youtubeChannelUrls?: string[];
  artistSourceUrl?: string | null;
  aliases?: string[];
}): TeamSummaryModel {
  const displayName = input.displayName;

  return {
    slug: input.slug,
    group: input.canonicalName?.trim() || displayName,
    displayName,
    actType: resolveActType(input.entityType),
    debutYear: input.debutYear ?? undefined,
    agency: input.agencyName ?? undefined,
    badge: input.badgeImageUrl || input.representativeImageUrl
      ? {
          imageUrl: input.badgeImageUrl ?? input.representativeImageUrl ?? undefined,
          label: displayName,
        }
      : {
          monogram: buildMonogram(displayName),
          label: displayName,
        },
    representativeImageUrl: input.representativeImageUrl ?? undefined,
    officialYoutubeUrl: input.officialYoutubeUrl ?? undefined,
    officialXUrl: input.officialXUrl ?? undefined,
    officialInstagramUrl: input.officialInstagramUrl ?? undefined,
    youtubeChannelUrls: input.youtubeChannelUrls ?? [],
    artistSourceUrl: input.artistSourceUrl ?? undefined,
    searchTokens: [
      displayName,
      input.canonicalName,
      ...(input.aliases ?? []),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0),
  };
}

function adaptReleaseSummary(
  input: BackendCalendarRelease | BackendSearchRelease | BackendEntityReleaseSummary,
  entitySlug: string,
  displayName: string,
): ReleaseSummaryModel {
  return {
    id: input.release_id,
    group: entitySlug,
    displayGroup: displayName,
    releaseTitle: input.release_title,
    releaseDate: input.release_date ?? '',
    releaseKind: normalizeReleaseKind(input.release_kind ?? null),
    stream: normalizeReleaseStream(input.stream),
    representativeSongTitle:
      'representative_song_title' in input ? input.representative_song_title ?? undefined : undefined,
    spotifyUrl: 'spotify_url' in input ? input.spotify_url ?? undefined : undefined,
    youtubeMusicUrl: 'youtube_music_url' in input ? input.youtube_music_url ?? undefined : undefined,
    youtubeMvUrl: 'youtube_mv_url' in input ? input.youtube_mv_url ?? undefined : undefined,
    sourceUrl: 'source_url' in input ? input.source_url ?? undefined : undefined,
    coverImageUrl:
      'artwork' in input
        ? input.artwork?.cover_image_url ?? input.artwork?.thumbnail_image_url ?? undefined
        : undefined,
    contextTags:
      'release_format' in input && typeof input.release_format === 'string' && input.release_format.length > 0
        ? [input.release_format]
        : [],
  };
}

function adaptUpcomingEvent(
  input: BackendCalendarUpcoming | BackendSearchUpcoming | BackendEntityUpcomingSummary | BackendRadarUpcoming,
  entitySlug: string,
  displayName: string,
): UpcomingEventModel {
  return {
    id: input.upcoming_signal_id,
    group: entitySlug,
    displayGroup: displayName,
    scheduledDate: input.scheduled_date ?? undefined,
    scheduledMonth: input.scheduled_month ?? undefined,
    datePrecision: normalizeUpcomingDatePrecision(input.date_precision),
    headline: input.headline,
    status: normalizeUpcomingStatus(input.date_status),
    confidence: normalizeUpcomingConfidence(input.confidence_score ?? null),
    sourceType: normalizeUpcomingSourceType(('source_type' in input ? input.source_type : null) ?? null),
    sourceUrl: ('source_url' in input ? input.source_url : null) ?? undefined,
  };
}

function adaptRadarUpcomingCard(input: BackendRadarUpcoming): RadarUpcomingCardModel {
  const upcoming = adaptUpcomingEvent(input, input.entity_slug, input.display_name);

  return {
    id: input.upcoming_signal_id,
    team: buildTeamSummary({
      slug: input.entity_slug,
      displayName: input.display_name,
    }),
    upcoming,
    dayLabel: upcoming.scheduledDate ?? upcoming.scheduledMonth ?? MOBILE_COPY.date.unknown,
    sourceLabel: input.release_format ?? resolveUpcomingStatusWithFallback(input.date_status),
    sourceUrl: input.source_url ?? undefined,
  };
}

function adaptRadarChangeFeedItem(input: BackendRadarChangeFeedItem): RadarChangeFeedItemModel {
  if (input.kind === 'verified_release') {
    return {
      id: input.release_id ?? `${input.entity_slug}-verified`,
      team: buildTeamSummary({
        slug: input.entity_slug,
        displayName: input.display_name,
      }),
      changeTypeLabel: '검증된 발매',
      previousScheduleLabel: '이전 일정 없음',
      nextScheduleLabel: [input.release_title, input.release_date].filter(Boolean).join(' · '),
      occurredAtLabel: input.occurred_at ?? undefined,
      releaseLabel: input.release_title ?? undefined,
      headline: input.release_title ?? undefined,
      sourceLabel: '검증된 발매',
    };
  }

  return {
    id: input.upcoming_signal_id ?? `${input.entity_slug}-upcoming`,
    team: buildTeamSummary({
      slug: input.entity_slug,
      displayName: input.display_name,
    }),
    changeTypeLabel: '예정 신호',
    previousScheduleLabel:
      input.scheduled_month && !input.scheduled_date
        ? formatMonthOnlyDateLabel(input.scheduled_month)
        : '일정 조정',
    nextScheduleLabel:
      input.scheduled_date ?? input.scheduled_month ?? input.headline ?? MOBILE_COPY.date.unknown,
    occurredAtLabel: input.occurred_at ?? undefined,
    releaseLabel: input.headline ?? undefined,
    headline: input.headline ?? undefined,
    sourceLabel: '예정 신호',
  };
}

function adaptRadarGapItem(input: BackendRadarGapOrRookieItem): RadarLongGapItemModel {
  return {
    id: input.entity_slug,
    team: buildTeamSummary({
      slug: input.entity_slug,
      displayName: input.display_name,
    }),
    latestRelease: input.latest_release
      ? adaptReleaseSummary(input.latest_release, input.entity_slug, input.display_name)
      : null,
    gapDays: input.gap_days ?? 0,
    gapLabel: input.gap_days ? `${input.gap_days}일 공백` : '장기 공백',
    hasUpcomingSignal: input.has_upcoming_signal,
  };
}

function adaptRadarRookieItem(input: BackendRadarGapOrRookieItem): RadarRookieItemModel {
  return {
    id: input.entity_slug,
    team: buildTeamSummary({
      slug: input.entity_slug,
      displayName: input.display_name,
    }),
    debutYear: input.debut_year ?? new Date().getFullYear(),
    latestRelease: input.latest_release
      ? adaptReleaseSummary(input.latest_release, input.entity_slug, input.display_name)
      : null,
    hasUpcomingSignal: input.has_upcoming_signal,
  };
}

function resolveEntityTimelineKind(eventType?: string | null): EntityTimelineItemModel['kind'] {
  if (eventType === 'release_verified') {
    return 'release_source';
  }

  if (eventType === 'artist_source') {
    return 'artist_source';
  }

  return 'upcoming_source';
}

function resolveEntityTimelineMeta(item: BackendEntityDetailData['source_timeline'][number]): string {
  return (
    item.summary ??
    [
      item.release_format,
      item.date_status,
      item.scheduled_date ?? item.scheduled_month ?? item.published_at ?? item.occurred_at,
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' · ')
  );
}

function resolveMatchKind(value: string): SearchTeamResultModel['matchKind'] {
  if (value === 'display_name_exact' || value === 'alias_exact' || value === 'alias_partial' || value === 'partial') {
    return value;
  }

  return 'partial';
}

function resolveReleaseMatchKind(value: string): SearchReleaseResultModel['matchKind'] {
  if (value === 'release_title_exact' || value === 'entity_exact_latest_release' || value === 'partial') {
    return value;
  }

  return 'partial';
}

function resolveUpcomingMatchKind(value: string): SearchUpcomingResultModel['matchKind'] {
  if (value === 'entity_exact' || value === 'headline_exact' || value === 'partial') {
    return value;
  }

  return 'partial';
}

function stringifyNote(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'summary' in value && typeof value.summary === 'string') {
    return value.summary;
  }

  return undefined;
}

export function adaptBackendCalendarMonth(
  month: string,
  data: BackendCalendarMonthData,
): CalendarMonthSnapshotModel {
  const releases = data.verified_list.map((release) =>
    adaptReleaseSummary(release, release.entity_slug, release.display_name),
  );
  const exactUpcoming = data.scheduled_list
    .filter((item) => item.date_precision === 'exact')
    .map((item) => adaptUpcomingEvent(item, item.entity_slug, item.display_name));
  const monthOnlyUpcoming = data.month_only_upcoming.map((item) =>
    adaptUpcomingEvent(item, item.entity_slug, item.display_name),
  );

  return {
    month,
    releaseCount: releases.length,
    upcomingCount: exactUpcoming.length + monthOnlyUpcoming.length,
    nearestUpcoming: data.nearest_upcoming
      ? adaptUpcomingEvent(
          data.nearest_upcoming,
          data.nearest_upcoming.entity_slug,
          data.nearest_upcoming.display_name,
        )
      : null,
    releases,
    exactUpcoming,
    monthOnlyUpcoming,
  };
}

export function adaptBackendSearchResults(query: string, data: BackendSearchData): SearchResultsModel {
  return {
    query,
    entities: data.entities.map((entity: BackendSearchEntity): SearchTeamResultModel => ({
      team: buildTeamSummary({
        slug: entity.entity_slug,
        displayName: entity.display_name,
        canonicalName: entity.canonical_name,
        entityType: entity.entity_type,
        agencyName: entity.agency_name ?? null,
        aliases: entity.aliases ?? [],
      }),
      latestRelease: entity.latest_release
        ? adaptReleaseSummary(entity.latest_release, entity.entity_slug, entity.display_name)
        : null,
      matchKind: resolveMatchKind(entity.match_reason),
    })),
    releases: data.releases.map((release: BackendSearchRelease): SearchReleaseResultModel => ({
      release: adaptReleaseSummary(release, release.entity_slug, release.display_name),
      matchKind: resolveReleaseMatchKind(release.match_reason),
    })),
    upcoming: data.upcoming.map((upcoming: BackendSearchUpcoming): SearchUpcomingResultModel => ({
      upcoming: adaptUpcomingEvent(upcoming, upcoming.entity_slug, upcoming.display_name),
      matchKind: resolveUpcomingMatchKind(upcoming.match_reason),
    })),
  };
}

export function adaptBackendRadarSnapshot(data: BackendRadarData): RadarSnapshotModel {
  const futureUpcoming = data.featured_upcoming ? [adaptRadarUpcomingCard(data.featured_upcoming)] : [];

  return {
    futureUpcoming,
    featuredUpcoming: futureUpcoming[0] ?? null,
    weeklyUpcoming: data.weekly_upcoming.map(adaptRadarUpcomingCard),
    changeFeed: data.change_feed.map(adaptRadarChangeFeedItem),
    longGap: data.long_gap.map(adaptRadarGapItem),
    rookie: data.rookie.map(adaptRadarRookieItem),
  };
}

export function adaptBackendEntityDetail(data: BackendEntityDetailData): EntityDetailSnapshotModel {
  const team = buildTeamSummary({
    slug: data.identity.entity_slug,
    displayName: data.identity.display_name,
    canonicalName: data.identity.canonical_name ?? data.identity.display_name,
    entityType: data.identity.entity_type,
    agencyName: data.identity.agency_name ?? null,
    debutYear: data.identity.debut_year ?? null,
    badgeImageUrl: data.identity.badge_image_url ?? null,
    representativeImageUrl: data.identity.representative_image_url ?? null,
    officialYoutubeUrl: data.official_links.youtube ?? data.youtube_channels.primary_team_channel_url ?? null,
    officialXUrl: data.official_links.x ?? null,
    officialInstagramUrl: data.official_links.instagram ?? null,
    youtubeChannelUrls: [
      data.youtube_channels.primary_team_channel_url,
      ...(data.youtube_channels.mv_allowlist_urls ?? []),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0),
    artistSourceUrl: data.artist_source_url ?? null,
  });

  return {
    team,
    nextUpcoming: data.next_upcoming
      ? adaptUpcomingEvent(data.next_upcoming, data.identity.entity_slug, data.identity.display_name)
      : null,
    latestRelease: data.latest_release
      ? adaptReleaseSummary(data.latest_release, data.identity.entity_slug, data.identity.display_name)
      : null,
    recentAlbums: data.recent_albums.map((release) =>
      adaptReleaseSummary(release, data.identity.entity_slug, data.identity.display_name),
    ),
    sourceTimeline: data.source_timeline.map(
      (item): EntityTimelineItemModel => ({
        id: `${item.event_type ?? 'source'}-${item.occurred_at ?? item.headline}`,
        kind: resolveEntityTimelineKind(item.event_type),
        title: item.headline,
        meta: resolveEntityTimelineMeta(item),
        sourceUrl: item.source_url ?? undefined,
      }),
    ),
  };
}

export function adaptBackendReleaseDetail(data: BackendReleaseDetailData): ReleaseDetailModel {
  const tracks: TrackModel[] = (data.tracks ?? []).map((track) => ({
    order: track.order,
    title: track.title,
    isTitleTrack: track.is_title_track ?? undefined,
    spotifyUrl: track.spotify?.url ?? undefined,
    youtubeMusicUrl: track.youtube_music?.url ?? undefined,
  }));

  return {
    id: data.release.release_id,
    group: data.release.entity_slug,
    displayGroup: data.release.display_name,
    releaseTitle: data.release.release_title,
    releaseDate: data.release.release_date,
    releaseKind: data.release.release_kind ?? undefined,
    stream: normalizeReleaseStream(data.release.stream),
    coverImageUrl:
      data.artwork?.image_url ??
      data.artwork?.cover_image_url ??
      data.artwork?.thumbnail_image_url ??
      undefined,
    spotifyUrl: data.service_links?.spotify?.url ?? undefined,
    youtubeMusicUrl: data.service_links?.youtube_music?.url ?? undefined,
    youtubeVideoId: data.mv?.video_id ?? undefined,
    youtubeVideoUrl: data.mv?.url ?? undefined,
    youtubeVideoStatus:
      data.mv?.status === 'relation_match' ||
      data.mv?.status === 'manual_override' ||
      data.mv?.status === 'needs_review' ||
      data.mv?.status === 'no_link' ||
      data.mv?.status === 'no_mv' ||
      data.mv?.status === 'unresolved'
        ? data.mv.status
        : undefined,
    youtubeVideoProvenance: data.mv?.provenance ?? undefined,
    notes: stringifyNote(data.notes),
    tracks,
  };
}
