import type {
  CalendarMonthSnapshotModel,
  EntityDetailSnapshotModel,
  EntityTimelineItemModel,
  MobileRawDataset,
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
import {
  buildReleaseId,
  compareIsoDateDescending,
  compareUpcomingDate,
  normalizeSearchToken,
  normalizeUpcomingSourceType,
} from './normalize';

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
  ).sort((left, right) => {
    const dateDelta = compareIsoDateDescending(left.releaseDate, right.releaseDate);
    if (dateDelta !== 0) {
      return dateDelta;
    }

    if (left.stream !== right.stream) {
      return left.stream === 'album' ? -1 : 1;
    }

    return left.releaseTitle.localeCompare(right.releaseTitle);
  });

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

function isIsoDateInMonth(value: string | undefined, month: string): boolean {
  return Boolean(value && value.slice(0, 7) === month);
}

function resolveUpcomingMonth(
  upcoming: MobileRawDataset['upcomingCandidates'][number],
): string | undefined {
  return upcoming.scheduled_month ?? upcoming.scheduled_date?.slice(0, 7);
}

export function selectMonthReleaseSummaries(
  input: MobileSelectorContext | MobileRawDataset,
  month: string,
  limit = Number.POSITIVE_INFINITY,
): ReleaseSummaryModel[] {
  const context = resolveContext(input);
  const summaries: ReleaseSummaryModel[] = [];

  for (const [group, history] of context.releaseHistoryByGroup.entries()) {
    const profile = context.profilesByGroup.get(group);
    const displayGroup = profile?.display_name?.trim() || group;

    for (const release of history.releases) {
      if (!isIsoDateInMonth(release.date, month)) {
        continue;
      }

      const releaseId = buildReleaseId(group, release.title, release.date, release.stream ?? 'album');
      summaries.push(
        adaptReleaseHistoryEntry(
          group,
          displayGroup,
          release,
          context.artworkByReleaseId.get(releaseId),
          context.detailByReleaseId.get(releaseId),
        ),
      );
    }
  }

  return summaries
    .sort((left, right) => compareIsoDateDescending(left.releaseDate, right.releaseDate))
    .slice(0, limit);
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

export function selectMonthUpcomingEvents(
  input: MobileSelectorContext | MobileRawDataset,
  month: string,
): UpcomingEventModel[] {
  const context = resolveContext(input);
  const events: UpcomingEventModel[] = [];

  for (const upcoming of context.dataset.upcomingCandidates) {
    if (resolveUpcomingMonth(upcoming) !== month) {
      continue;
    }

    const displayGroup = context.profilesByGroup.get(upcoming.group)?.display_name?.trim() || upcoming.group;
    events.push(adaptUpcomingEvent(upcoming.group, displayGroup, upcoming));
  }

  return events.sort(compareUpcomingDate);
}

export function selectAvailableCalendarMonths(
  input: MobileSelectorContext | MobileRawDataset,
  todayMonth: string,
): string[] {
  const context = resolveContext(input);
  const months = new Set<string>([todayMonth]);

  for (const history of context.releaseHistoryByGroup.values()) {
    for (const release of history.releases) {
      if (release.date) {
        months.add(release.date.slice(0, 7));
      }
    }
  }

  for (const upcoming of context.dataset.upcomingCandidates) {
    const month = resolveUpcomingMonth(upcoming);
    if (month) {
      months.add(month);
    }
  }

  return [...months].sort((left, right) => left.localeCompare(right));
}

export function selectNearestExactUpcomingEvent(
  input: MobileSelectorContext | MobileRawDataset,
  todayIsoDate: string,
): UpcomingEventModel | null {
  const context = resolveContext(input);
  const events: UpcomingEventModel[] = [];

  for (const upcoming of context.dataset.upcomingCandidates) {
    if (!upcoming.scheduled_date || upcoming.date_precision !== 'exact') {
      continue;
    }

    if (upcoming.scheduled_date < todayIsoDate) {
      continue;
    }

    const displayGroup = context.profilesByGroup.get(upcoming.group)?.display_name?.trim() || upcoming.group;
    events.push(adaptUpcomingEvent(upcoming.group, displayGroup, upcoming));
  }

  return events.sort(compareUpcomingDate)[0] ?? null;
}

function includesPartialMatch(tokens: string[], query: string): boolean {
  return tokens.some((token) => token.includes(query));
}

function findSearchTeamResults(
  context: MobileSelectorContext,
  normalizedQuery: string,
): SearchTeamResultModel[] {
  const results: SearchTeamResultModel[] = [];

  for (const profile of context.dataset.artistProfiles) {
    const team = adaptTeamSummary(profile, context.allowlistsByGroup.get(profile.group));
    const displayTokens = [profile.group, profile.display_name]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalizeSearchToken);
    const searchAliasTokens = (profile.search_aliases ?? []).map(normalizeSearchToken);
    const aliasTokens = (profile.aliases ?? []).map(normalizeSearchToken);
    const allTokens = Array.from(new Set([...displayTokens, ...searchAliasTokens, ...aliasTokens]));

    let matchKind: SearchTeamResultModel['matchKind'] | null = null;

    if (displayTokens.includes(normalizedQuery)) {
      matchKind = 'display_name_exact';
    } else if (searchAliasTokens.includes(normalizedQuery)) {
      matchKind = 'search_alias_exact';
    } else if (aliasTokens.includes(normalizedQuery)) {
      matchKind = 'alias_exact';
    } else if (includesPartialMatch([...searchAliasTokens, ...aliasTokens], normalizedQuery)) {
      matchKind = 'alias_partial';
    } else if (includesPartialMatch(allTokens, normalizedQuery)) {
      matchKind = 'partial';
    }

    if (!matchKind) {
      continue;
    }

    results.push({
      team,
      latestRelease: selectLatestReleaseSummaryBySlug(context, team.slug),
      matchKind,
    });
  }

  const rank: Record<SearchTeamResultModel['matchKind'], number> = {
    display_name_exact: 0,
    search_alias_exact: 1,
    alias_exact: 2,
    alias_partial: 3,
    partial: 4,
  };

  return results.sort((left, right) => {
    const rankDelta = rank[left.matchKind] - rank[right.matchKind];
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return left.team.displayName.localeCompare(right.team.displayName);
  });
}

function findSearchReleaseResults(
  context: MobileSelectorContext,
  normalizedQuery: string,
): SearchReleaseResultModel[] {
  const latestReleaseIdsByGroup = new Map<string, string>();

  for (const profile of context.dataset.artistProfiles) {
    const latestRelease = selectLatestReleaseSummaryBySlug(context, profile.slug);
    if (latestRelease) {
      latestReleaseIdsByGroup.set(profile.group, latestRelease.id);
    }
  }

  const results: SearchReleaseResultModel[] = [];

  for (const [group, history] of context.releaseHistoryByGroup.entries()) {
    const profile = context.profilesByGroup.get(group);
    const displayGroup = profile?.display_name?.trim() || group;
    const teamTokens = [group, profile?.display_name, ...(profile?.aliases ?? []), ...(profile?.search_aliases ?? [])]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalizeSearchToken);

    for (const release of history.releases) {
      const releaseId = buildReleaseId(group, release.title, release.date, release.stream ?? 'album');
      const releaseTitleToken = normalizeSearchToken(release.title);

      let matchKind: SearchReleaseResultModel['matchKind'] | null = null;

      if (releaseTitleToken === normalizedQuery) {
        matchKind = 'release_title_exact';
      } else if (
        teamTokens.includes(normalizedQuery) &&
        latestReleaseIdsByGroup.get(group) === releaseId
      ) {
        matchKind = 'entity_exact_latest_release';
      } else if (releaseTitleToken.includes(normalizedQuery) || teamTokens.some((token) => token.includes(normalizedQuery))) {
        matchKind = 'partial';
      }

      if (!matchKind) {
        continue;
      }

      results.push({
        release: adaptReleaseHistoryEntry(
          group,
          displayGroup,
          release,
          context.artworkByReleaseId.get(releaseId),
          context.detailByReleaseId.get(releaseId),
        ),
        matchKind,
      });
    }
  }

  const rank: Record<SearchReleaseResultModel['matchKind'], number> = {
    release_title_exact: 0,
    entity_exact_latest_release: 1,
    partial: 2,
  };

  return results
    .sort((left, right) => {
      const rankDelta = rank[left.matchKind] - rank[right.matchKind];
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return compareIsoDateDescending(left.release.releaseDate, right.release.releaseDate);
    })
    .slice(0, 20);
}

function findSearchUpcomingResults(
  context: MobileSelectorContext,
  normalizedQuery: string,
): SearchUpcomingResultModel[] {
  const results: SearchUpcomingResultModel[] = [];

  for (const upcoming of context.dataset.upcomingCandidates) {
    const displayGroup = context.profilesByGroup.get(upcoming.group)?.display_name?.trim() || upcoming.group;
    const teamProfile = context.profilesByGroup.get(upcoming.group);
    const teamTokens = [upcoming.group, teamProfile?.display_name, ...(teamProfile?.aliases ?? []), ...(teamProfile?.search_aliases ?? [])]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalizeSearchToken);
    const headlineToken = normalizeSearchToken(upcoming.headline);
    const releaseLabelToken = normalizeSearchToken(upcoming.release_label ?? '');
    const headlineWords = headlineToken.split(' ').filter(Boolean);

    let matchKind: SearchUpcomingResultModel['matchKind'] | null = null;

    if (teamTokens.includes(normalizedQuery)) {
      matchKind = 'entity_exact';
    } else if (headlineWords.includes(normalizedQuery) || releaseLabelToken === normalizedQuery) {
      matchKind = 'headline_exact';
    } else if (
      headlineToken.includes(normalizedQuery) ||
      releaseLabelToken.includes(normalizedQuery) ||
      teamTokens.some((token) => token.includes(normalizedQuery))
    ) {
      matchKind = 'partial';
    }

    if (!matchKind) {
      continue;
    }

    results.push({
      upcoming: adaptUpcomingEvent(upcoming.group, displayGroup, upcoming),
      matchKind,
    });
  }

  const rank: Record<SearchUpcomingResultModel['matchKind'], number> = {
    entity_exact: 0,
    headline_exact: 1,
    partial: 2,
  };

  return results
    .sort((left, right) => {
      const rankDelta = rank[left.matchKind] - rank[right.matchKind];
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return compareUpcomingDate(left.upcoming, right.upcoming);
    })
    .slice(0, 20);
}

export function selectSearchResults(
  input: MobileSelectorContext | MobileRawDataset,
  query: string,
): SearchResultsModel {
  const context = resolveContext(input);
  const normalizedQuery = normalizeSearchToken(query);

  if (!normalizedQuery) {
    return {
      query,
      entities: [],
      releases: [],
      upcoming: [],
    };
  }

  return {
    query,
    entities: findSearchTeamResults(context, normalizedQuery),
    releases: findSearchReleaseResults(context, normalizedQuery),
    upcoming: findSearchUpcomingResults(context, normalizedQuery),
  };
}

export function selectCalendarMonthSnapshot(
  input: MobileSelectorContext | MobileRawDataset,
  month: string,
  todayIsoDate: string,
): CalendarMonthSnapshotModel {
  const releases = selectMonthReleaseSummaries(input, month);
  const upcoming = selectMonthUpcomingEvents(input, month);
  const exactUpcoming = upcoming.filter((event) => event.datePrecision === 'exact');
  const monthOnlyUpcoming = upcoming.filter((event) => event.datePrecision === 'month_only');
  const nearestUpcoming =
    exactUpcoming.find((event) => event.scheduledDate && event.scheduledDate >= todayIsoDate) ?? null;

  return {
    month,
    releaseCount: releases.length,
    upcomingCount: upcoming.length,
    nearestUpcoming,
    releases,
    exactUpcoming,
    monthOnlyUpcoming,
  };
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

function resolveTimelineSortKey(item: EntityTimelineItemModel): string {
  if (item.kind === 'artist_source') {
    return '';
  }

  const match = item.meta.match(/\d{4}-\d{2}(?:-\d{2})?/);
  return match?.[0] ?? '';
}

function resolveTimelineRank(item: EntityTimelineItemModel): number {
  switch (item.kind) {
    case 'upcoming_source':
      return 0;
    case 'release_source':
      return 1;
    case 'artist_source':
    default:
      return 2;
  }
}

export function selectEntityDetailSnapshot(
  input: MobileSelectorContext | MobileRawDataset,
  slug: string,
): EntityDetailSnapshotModel | null {
  const context = resolveContext(input);
  const team = selectTeamSummaryBySlug(context, slug);

  if (!team) {
    return null;
  }

  const upcomingEvents = selectUpcomingEventsBySlug(context, slug);
  const nextUpcoming = upcomingEvents[0] ?? null;
  const latestRelease = selectLatestReleaseSummaryBySlug(context, slug);
  const recentAlbums = selectRecentReleaseSummariesBySlug(context, slug).filter(
    (release) => release.stream === 'album',
  );

  const sourceTimeline: EntityTimelineItemModel[] = [];

  if (team.artistSourceUrl) {
    sourceTimeline.push({
      id: `${team.slug}-artist-source`,
      kind: 'artist_source',
      title: '아티스트 기준 소스',
      meta: '대표 엔티티 소스',
      sourceUrl: team.artistSourceUrl,
    });
  }

  for (const upcoming of upcomingEvents) {
    if (!upcoming.sourceUrl) {
      continue;
    }

    const dateLabel =
      upcoming.datePrecision === 'exact'
        ? upcoming.scheduledDate ?? '날짜 미정'
        : `${upcoming.scheduledMonth ?? '날짜 미정'} · 날짜 미정`;

    sourceTimeline.push({
      id: `${upcoming.id}-source`,
      kind: 'upcoming_source',
      title: upcoming.releaseLabel ?? upcoming.headline,
      meta: `${dateLabel} · ${upcoming.status ?? '예정'}`,
      sourceUrl: upcoming.sourceUrl,
    });
  }

  for (const release of selectRecentReleaseSummariesBySlug(context, slug)) {
    if (!release.sourceUrl) {
      continue;
    }

    sourceTimeline.push({
      id: `${release.id}-source`,
      kind: 'release_source',
      title: release.releaseTitle,
      meta: `${release.releaseDate} · ${release.releaseKind ?? 'release'}`,
      sourceUrl: release.sourceUrl,
    });
  }

  sourceTimeline.sort((left, right) => {
    const dateDelta = compareIsoDateDescending(
      resolveTimelineSortKey(left),
      resolveTimelineSortKey(right),
    );
    if (dateDelta !== 0) {
      return dateDelta;
    }

    const rankDelta = resolveTimelineRank(left) - resolveTimelineRank(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return left.title.localeCompare(right.title);
  });

  return {
    team,
    nextUpcoming,
    latestRelease,
    recentAlbums,
    sourceTimeline,
  };
}

function parseIsoDate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveDayLabel(todayIsoDate: string, scheduledDate?: string): string {
  if (!scheduledDate) {
    return '날짜 미정';
  }

  const todayTime = parseIsoDate(todayIsoDate);
  const scheduledTime = parseIsoDate(scheduledDate);

  if (todayTime == null || scheduledTime == null) {
    return scheduledDate;
  }

  const dayDelta = Math.round((scheduledTime - todayTime) / 86_400_000);

  if (dayDelta === 0) {
    return '오늘';
  }

  if (dayDelta === 1) {
    return '내일';
  }

  if (dayDelta > 1) {
    return `D-${dayDelta}`;
  }

  return `D+${Math.abs(dayDelta)}`;
}

function resolveRadarSourceLabel(sourceType: UpcomingEventModel['sourceType']): string {
  if (sourceType === 'agency_notice' || sourceType === 'weverse_notice' || sourceType === 'official_social') {
    return '공식 공지';
  }

  if (sourceType === 'news_rss') {
    return '기사 원문';
  }

  return '소스 보기';
}

function resolveChangeStatusLabel(status?: string | null): string | null {
  if (status === 'confirmed') {
    return '확정';
  }

  if (status === 'scheduled') {
    return '예정';
  }

  if (status === 'rumor') {
    return '루머';
  }

  return null;
}

function formatChangeScheduleLabel(date?: string | null, status?: string | null): string {
  const normalizedStatus = resolveChangeStatusLabel(status);
  if (date && normalizedStatus) {
    return `${date} · ${normalizedStatus}`;
  }

  if (date) {
    return date;
  }

  if (normalizedStatus) {
    return normalizedStatus;
  }

  return '일정 미상';
}

function buildRadarUpcomingCard(
  context: MobileSelectorContext,
  upcoming: UpcomingEventModel,
  todayIsoDate: string,
): RadarUpcomingCardModel | null {
  const team = selectTeamSummaryBySlug(context, context.profilesByGroup.get(upcoming.group)?.slug ?? '');
  if (!team) {
    return null;
  }

  return {
    id: upcoming.id,
    team,
    upcoming,
    dayLabel: resolveDayLabel(todayIsoDate, upcoming.scheduledDate),
    sourceLabel: resolveRadarSourceLabel(upcoming.sourceType),
    sourceUrl: upcoming.sourceUrl,
  };
}

function isWithinWeeklyWindow(todayIsoDate: string, scheduledDate?: string): boolean {
  const todayTime = parseIsoDate(todayIsoDate);
  const scheduledTime = parseIsoDate(scheduledDate);

  if (todayTime == null || scheduledTime == null) {
    return false;
  }

  const dayDelta = Math.round((scheduledTime - todayTime) / 86_400_000);
  return dayDelta >= 0 && dayDelta <= 6;
}

function resolveLatestReleaseSummaryByGroup(
  context: MobileSelectorContext,
  group: string,
): ReleaseSummaryModel | null {
  const slug = context.profilesByGroup.get(group)?.slug;
  if (!slug) {
    return null;
  }

  return selectLatestReleaseSummaryBySlug(context, slug);
}

function resolveEarliestReleaseYear(context: MobileSelectorContext, group: string): number | null {
  const history = context.releaseHistoryByGroup.get(group);
  if (!history || history.releases.length === 0) {
    return null;
  }

  const years = history.releases
    .map((release) => Number(release.date.slice(0, 4)))
    .filter((value) => Number.isFinite(value));

  if (years.length === 0) {
    return null;
  }

  return Math.min(...years);
}

function buildLongGapItems(
  context: MobileSelectorContext,
  todayIsoDate: string,
): RadarLongGapItemModel[] {
  const todayTime = parseIsoDate(todayIsoDate);
  if (todayTime == null) {
    return [];
  }

  const thresholdDays = 365;
  const items: RadarLongGapItemModel[] = [];

  for (const profile of context.dataset.artistProfiles) {
    const team = adaptTeamSummary(profile, context.allowlistsByGroup.get(profile.group));
    const latestRelease = resolveLatestReleaseSummaryByGroup(context, profile.group);

    if (!latestRelease) {
      continue;
    }

    const latestReleaseTime = parseIsoDate(latestRelease.releaseDate);
    if (latestReleaseTime == null) {
      continue;
    }

    const gapDays = Math.floor((todayTime - latestReleaseTime) / 86_400_000);
    if (gapDays < thresholdDays) {
      continue;
    }

    const debutYear = resolveEarliestReleaseYear(context, profile.group);
    if (debutYear != null && debutYear >= Number(todayIsoDate.slice(0, 4)) - 1) {
      continue;
    }

    items.push({
      id: team.slug,
      team,
      latestRelease,
      gapDays,
      gapLabel: `${gapDays}일 공백`,
      hasUpcomingSignal: (context.upcomingByGroup.get(profile.group) ?? []).length > 0,
    });
  }

  return items.sort((left, right) => right.gapDays - left.gapDays);
}

function buildRookieItems(
  context: MobileSelectorContext,
  todayIsoDate: string,
): RadarRookieItemModel[] {
  const currentYear = Number(todayIsoDate.slice(0, 4));
  const items: RadarRookieItemModel[] = [];

  for (const profile of context.dataset.artistProfiles) {
    const debutYear = resolveEarliestReleaseYear(context, profile.group);
    if (debutYear == null || debutYear < currentYear - 1) {
      continue;
    }

    const team = adaptTeamSummary(profile, context.allowlistsByGroup.get(profile.group));
    items.push({
      id: team.slug,
      team,
      debutYear,
      latestRelease: resolveLatestReleaseSummaryByGroup(context, profile.group),
      hasUpcomingSignal: (context.upcomingByGroup.get(profile.group) ?? []).length > 0,
    });
  }

  return items.sort((left, right) => {
    if (left.debutYear !== right.debutYear) {
      return right.debutYear - left.debutYear;
    }

    const latestReleaseDelta = compareIsoDateDescending(
      left.latestRelease?.releaseDate,
      right.latestRelease?.releaseDate,
    );
    if (latestReleaseDelta !== 0) {
      return latestReleaseDelta;
    }

    return left.team.displayName.localeCompare(right.team.displayName);
  });
}

function buildChangeFeedItems(context: MobileSelectorContext): RadarChangeFeedItemModel[] {
  const feed = context.dataset.radarChangeFeed ?? [];
  const items: RadarChangeFeedItemModel[] = [];

  for (const item of feed) {
    const profile = context.profilesByGroup.get(item.group);
    if (!profile) {
      continue;
    }

    items.push({
      id: buildReleaseId(
        item.group,
        item.release_label ?? item.headline ?? item.change_type ?? 'change',
        item.new_date ?? item.previous_date ?? item.occurred_at ?? 'unknown',
        'album',
      ),
      team: adaptTeamSummary(profile, context.allowlistsByGroup.get(item.group)),
      changeTypeLabel: item.change_type ?? '일정 변경',
      previousScheduleLabel: formatChangeScheduleLabel(item.previous_date, item.previous_status),
      nextScheduleLabel: formatChangeScheduleLabel(item.new_date, item.new_status),
      occurredAtLabel: item.occurred_at ?? undefined,
      releaseLabel: item.release_label ?? undefined,
      headline: item.headline ?? undefined,
      sourceLabel: resolveRadarSourceLabel(normalizeUpcomingSourceType(item.source_type)),
      sourceUrl: item.source_url ?? undefined,
    });
  }

  return items.sort((left, right) => compareIsoDateDescending(left.occurredAtLabel, right.occurredAtLabel));
}

export function selectRadarSnapshot(
  input: MobileSelectorContext | MobileRawDataset,
  todayIsoDate: string,
): RadarSnapshotModel {
  const context = resolveContext(input);
  const upcomingEvents = context.dataset.upcomingCandidates
    .map((upcoming) => {
      const displayGroup = context.profilesByGroup.get(upcoming.group)?.display_name?.trim() || upcoming.group;
      return adaptUpcomingEvent(upcoming.group, displayGroup, upcoming);
    })
    .filter((event) => event.datePrecision === 'exact')
    .sort(compareUpcomingDate);

  const futureUpcoming = upcomingEvents
    .filter((event) => event.scheduledDate && event.scheduledDate >= todayIsoDate)
    .map((event) => buildRadarUpcomingCard(context, event, todayIsoDate))
    .filter((value): value is RadarUpcomingCardModel => value !== null);

  const weeklyUpcoming = futureUpcoming.filter((item) =>
    isWithinWeeklyWindow(todayIsoDate, item.upcoming.scheduledDate),
  );

  return {
    futureUpcoming,
    featuredUpcoming: futureUpcoming[0] ?? null,
    weeklyUpcoming,
    changeFeed: buildChangeFeedItems(context),
    longGap: buildLongGapItems(context, todayIsoDate),
    rookie: buildRookieItems(context, todayIsoDate),
  };
}
