import type {
  ArtistProfileRaw,
  ReleaseArtworkRaw,
  ReleaseDetailRaw,
  ReleaseHistoryEntryRaw,
  TeamBadge,
  TeamSummaryModel,
  ReleaseSummaryModel,
  UpcomingEventModel,
  UpcomingCandidateRaw,
  YoutubeChannelAllowlistRaw,
  ReleaseDetailModel,
  TrackModel,
  ReleaseStreamCollectionRaw,
} from '../types';

import {
  buildMonogram,
  buildReleaseId,
  normalizeReleaseKind,
  normalizeReleaseStream,
  normalizeSearchToken,
  normalizeUpcomingConfidence,
  normalizeUpcomingDatePrecision,
  normalizeUpcomingSourceType,
  normalizeUpcomingStatus,
} from './normalize';

function resolveDisplayName(profile: ArtistProfileRaw): string {
  return profile.display_name?.trim() || profile.group;
}

function resolveArtistSourceUrl(profile: ArtistProfileRaw): string | undefined {
  return profile.artist_source_url ?? profile.artist_source ?? undefined;
}

function resolveActType(profile: ArtistProfileRaw): TeamSummaryModel['actType'] {
  if (
    profile.act_type === 'group' ||
    profile.act_type === 'solo' ||
    profile.act_type === 'unit' ||
    profile.act_type === 'project'
  ) {
    return profile.act_type;
  }

  return 'group';
}

export function adaptTeamBadge(profile: ArtistProfileRaw): TeamBadge | undefined {
  const displayName = resolveDisplayName(profile);
  const imageUrl = profile.badge_image_url ?? profile.representative_image_url ?? undefined;

  if (imageUrl) {
    return {
      imageUrl,
      label: displayName,
    };
  }

  return {
    monogram: buildMonogram(displayName),
    label: displayName,
  };
}

export function buildTeamSearchTokens(profile: ArtistProfileRaw): string[] {
  const candidates = [
    profile.group,
    profile.display_name,
    ...(profile.aliases ?? []),
    ...(profile.search_aliases ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  return Array.from(new Set(candidates.map(normalizeSearchToken).filter(Boolean)));
}

export function adaptTeamSummary(
  profile: ArtistProfileRaw,
  allowlist?: YoutubeChannelAllowlistRaw,
): TeamSummaryModel {
  const displayName = resolveDisplayName(profile);
  const youtubeChannelUrls = Array.from(
    new Set(
      [
        allowlist?.primary_team_channel_url,
        profile.official_youtube_url,
        ...(allowlist?.channels
          ?.filter((channel) => channel.display_in_team_links)
          .map((channel) => channel.channel_url) ?? []),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    slug: profile.slug,
    group: profile.group,
    displayName,
    actType: resolveActType(profile),
    debutYear: profile.debut_year ?? undefined,
    agency: profile.agency ?? undefined,
    badge: adaptTeamBadge(profile),
    representativeImageUrl: profile.representative_image_url ?? undefined,
    officialYoutubeUrl: youtubeChannelUrls[0],
    officialXUrl: profile.official_x_url ?? undefined,
    officialInstagramUrl: profile.official_instagram_url ?? undefined,
    youtubeChannelUrls,
    artistSourceUrl: resolveArtistSourceUrl(profile),
    searchTokens: buildTeamSearchTokens(profile),
  };
}

type ReleaseAdapterInput = {
  group: string;
  displayGroup: string;
  releaseTitle: string;
  releaseDate: string;
  releaseKind?: string | null;
  stream?: string | null;
  sourceUrl?: string | null;
  contextTags?: string[] | null;
  artwork?: ReleaseArtworkRaw;
  detail?: ReleaseDetailRaw;
  representativeSongTitle?: string | null;
};

export function adaptReleaseSummary(input: ReleaseAdapterInput): ReleaseSummaryModel {
  const stream = normalizeReleaseStream(input.stream);
  const id = buildReleaseId(input.group, input.releaseTitle, input.releaseDate, stream);

  return {
    id,
    group: input.group,
    displayGroup: input.displayGroup,
    releaseTitle: input.releaseTitle,
    releaseDate: input.releaseDate,
    releaseKind: normalizeReleaseKind(input.releaseKind),
    stream,
    representativeSongTitle: input.representativeSongTitle ?? undefined,
    spotifyUrl: input.detail?.spotify_url ?? undefined,
    youtubeMusicUrl: input.detail?.youtube_music_url ?? undefined,
    youtubeMvUrl: input.detail?.youtube_video_url ?? undefined,
    coverImageUrl: input.artwork?.cover_image_url ?? undefined,
    sourceUrl: input.sourceUrl ?? undefined,
    contextTags: input.contextTags ?? [],
  };
}

export function adaptReleaseHistoryEntry(
  group: string,
  displayGroup: string,
  release: ReleaseHistoryEntryRaw,
  artwork?: ReleaseArtworkRaw,
  detail?: ReleaseDetailRaw,
): ReleaseSummaryModel {
  return adaptReleaseSummary({
    group,
    displayGroup,
    releaseTitle: release.title,
    releaseDate: release.date,
    releaseKind: release.release_kind ?? release.release_format,
    stream: release.stream,
    sourceUrl: release.source,
    contextTags: release.context_tags,
    artwork,
    detail,
    representativeSongTitle: detail?.tracks?.find((track) => track.is_title_track)?.title ?? null,
  });
}

export function adaptLatestReleaseStreams(
  group: string,
  displayGroup: string,
  collection: ReleaseStreamCollectionRaw,
  artworkByReleaseId: Map<string, ReleaseArtworkRaw>,
  detailByReleaseId: Map<string, ReleaseDetailRaw>,
): ReleaseSummaryModel[] {
  const candidates = [
    collection.latest_song
      ? {
          stream: 'song',
          release: collection.latest_song,
          representativeSongTitle: collection.latest_song.title,
        }
      : null,
    collection.latest_album
      ? {
          stream: 'album',
          release: collection.latest_album,
          representativeSongTitle: null,
        }
      : null,
  ].filter(Boolean) as {
    stream: 'song' | 'album';
    release: NonNullable<ReleaseStreamCollectionRaw['latest_song']>;
    representativeSongTitle: string | null;
  }[];

  return candidates.map(({ stream, release, representativeSongTitle }) => {
    const releaseId = buildReleaseId(group, release.title, release.date, stream);
    return adaptReleaseSummary({
      group,
      displayGroup,
      releaseTitle: release.title,
      releaseDate: release.date,
      releaseKind: release.release_kind ?? release.release_format,
      stream,
      sourceUrl: release.source,
      contextTags: release.context_tags,
      artwork: artworkByReleaseId.get(releaseId),
      detail: detailByReleaseId.get(releaseId),
      representativeSongTitle,
    });
  });
}

export function adaptUpcomingEvent(
  group: string,
  displayGroup: string,
  upcoming: UpcomingCandidateRaw,
): UpcomingEventModel {
  const datePrecision = normalizeUpcomingDatePrecision(upcoming.date_precision);
  const scheduledDate = upcoming.scheduled_date ?? undefined;
  const scheduledMonth = upcoming.scheduled_month ?? undefined;

  return {
    id: buildReleaseId(group, upcoming.headline, scheduledDate ?? scheduledMonth ?? 'unknown', 'album'),
    group,
    displayGroup,
    scheduledDate,
    scheduledMonth,
    datePrecision,
    headline: upcoming.headline,
    releaseLabel: upcoming.release_label ?? undefined,
    status: normalizeUpcomingStatus(upcoming.date_status),
    confidence: normalizeUpcomingConfidence(upcoming.confidence),
    sourceType: normalizeUpcomingSourceType(upcoming.source_type),
    sourceUrl: upcoming.source_url ?? undefined,
  };
}

export function adaptTrack(track: NonNullable<ReleaseDetailRaw['tracks']>[number]): TrackModel {
  return {
    order: track.order,
    title: track.title,
    isTitleTrack: track.is_title_track ?? undefined,
    spotifyUrl: track.spotify_url ?? undefined,
    youtubeMusicUrl: track.youtube_music_url ?? undefined,
  };
}

export function adaptReleaseDetail(
  group: string,
  displayGroup: string,
  detail: ReleaseDetailRaw,
  sourceUrl?: string,
  artwork?: ReleaseArtworkRaw,
): ReleaseDetailModel {
  const stream = normalizeReleaseStream(detail.stream);

  return {
    id: buildReleaseId(group, detail.release_title, detail.release_date, stream),
    group,
    displayGroup,
    releaseTitle: detail.release_title,
    releaseDate: detail.release_date,
    releaseKind: detail.release_kind ?? undefined,
    stream,
    coverImageUrl: artwork?.cover_image_url ?? undefined,
    spotifyUrl: detail.spotify_url ?? undefined,
    sourceUrl,
    youtubeMusicUrl: detail.youtube_music_url ?? undefined,
    youtubeVideoId: detail.youtube_video_id ?? undefined,
    youtubeVideoUrl: detail.youtube_video_url ?? undefined,
    youtubeVideoStatus: detail.youtube_video_status as ReleaseDetailModel['youtubeVideoStatus'],
    youtubeVideoProvenance: detail.youtube_video_provenance ?? undefined,
    notes: detail.notes ?? undefined,
    tracks: (detail.tracks ?? []).map(adaptTrack),
  };
}
