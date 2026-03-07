import type {
  MobileRawDataset,
  ReleaseDetailModel,
  ReleaseSummaryModel,
  TeamSummaryModel,
  UpcomingEventModel,
} from '../types';

import {
  adaptLatestReleaseStreams,
  adaptReleaseDetail,
  adaptReleaseHistoryEntry,
  adaptTeamSummary,
  adaptUpcomingEvent,
} from './adapters';
import { createSelectorContext, type MobileSelectorContext } from './context';
import { buildReleaseId, compareIsoDateDescending, compareUpcomingDate } from './normalize';

export { createSelectorContext } from './context';
export * from './adapters';
export * from './normalize';

function resolveContext(input: MobileSelectorContext | MobileRawDataset): MobileSelectorContext {
  return 'profilesBySlug' in input ? input : createSelectorContext(input);
}

export function selectTeamSummaryBySlug(
  input: MobileSelectorContext | MobileRawDataset,
  slug: string,
): TeamSummaryModel | null {
  const context = resolveContext(input);
  const profile = context.profilesBySlug.get(slug);

  if (!profile) {
    return null;
  }

  return adaptTeamSummary(profile, context.allowlistsByGroup.get(profile.group));
}

export function selectLatestReleaseSummaryBySlug(
  input: MobileSelectorContext | MobileRawDataset,
  slug: string,
): ReleaseSummaryModel | null {
  const context = resolveContext(input);
  const team = selectTeamSummaryBySlug(context, slug);

  if (!team) {
    return null;
  }

  const releaseCollection = context.releaseCollectionsByGroup.get(team.group);
  if (!releaseCollection) {
    return null;
  }

  const candidates = adaptLatestReleaseStreams(
    team.group,
    team.displayName,
    releaseCollection,
    context.artworkByReleaseId,
    context.detailByReleaseId,
  ).sort((left, right) => compareIsoDateDescending(left.releaseDate, right.releaseDate));

  return candidates[0] ?? null;
}

export function selectRecentReleaseSummariesBySlug(
  input: MobileSelectorContext | MobileRawDataset,
  slug: string,
  limit = 12,
): ReleaseSummaryModel[] {
  const context = resolveContext(input);
  const team = selectTeamSummaryBySlug(context, slug);

  if (!team) {
    return [];
  }

  const history = context.releaseHistoryByGroup.get(team.group);
  if (!history) {
    return [];
  }

  return [...history.releases]
    .sort((left, right) => compareIsoDateDescending(left.date, right.date))
    .slice(0, limit)
    .map((release) => {
      const releaseId = buildReleaseId(team.group, release.title, release.date, release.stream ?? 'album');
      return adaptReleaseHistoryEntry(
        team.group,
        team.displayName,
        release,
        context.artworkByReleaseId.get(releaseId),
        context.detailByReleaseId.get(releaseId),
      );
    });
}

export function selectUpcomingEventsBySlug(
  input: MobileSelectorContext | MobileRawDataset,
  slug: string,
): UpcomingEventModel[] {
  const context = resolveContext(input);
  const team = selectTeamSummaryBySlug(context, slug);

  if (!team) {
    return [];
  }

  return (context.upcomingByGroup.get(team.group) ?? [])
    .map((upcoming) => adaptUpcomingEvent(team.group, team.displayName, upcoming))
    .sort(compareUpcomingDate);
}

export function selectReleaseDetailById(
  input: MobileSelectorContext | MobileRawDataset,
  releaseId: string,
): ReleaseDetailModel | null {
  const context = resolveContext(input);
  const detail = context.detailByReleaseId.get(releaseId);

  if (!detail) {
    return null;
  }

  const team = context.profilesByGroup.get(detail.group);
  const displayGroup = team?.display_name?.trim() || detail.group;

  return adaptReleaseDetail(detail.group, displayGroup, detail, context.artworkByReleaseId.get(releaseId));
}
