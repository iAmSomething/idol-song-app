import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { DateDetailSheet } from '../../src/components/calendar/DateDetailSheet';
import { DayCell } from '../../src/components/calendar/DayCell';
import { SegmentedControl } from '../../src/components/controls/SegmentedControl';
import { ScreenFeedbackState, InlineFeedbackNotice } from '../../src/components/feedback/FeedbackState';
import { FilterSheet, type FilterSheetGroup } from '../../src/components/filters/FilterSheet';
import { SummaryStrip } from '../../src/components/layout/SummaryStrip';
import {
  ReleaseSummaryRow,
  type ReleaseSummaryRowProps,
} from '../../src/components/release/ReleaseSummaryRow';
import {
  UpcomingEventRow,
  type UpcomingEventRowProps,
} from '../../src/components/upcoming/UpcomingEventRow';
import {
  buildCalendarMonthGrid,
  resolveInitialCalendarSelection,
  resolveNextCalendarSelection,
} from '../../src/features/calendarGrid';
import { buildDatasetRiskDisclosure } from '../../src/features/surfaceDisclosures';
import {
  areRouteParamsEqual,
  buildCalendarRouteParams,
  resolveCalendarRouteState,
  type CalendarFilterMode,
  type CalendarViewMode,
} from '../../src/features/routeState';
import { useActiveDatasetScreen } from '../../src/features/useActiveDatasetScreen';
import { selectCalendarMonthSnapshot } from '../../src/selectors';
import {
  MOBILE_COPY,
  resolveSourceLinkLabel,
  resolveUpcomingConfidenceLabel,
  resolveUpcomingStatusLabel,
} from '../../src/copy/mobileCopy';
import { loadActiveMobileDataset } from '../../src/services/activeDataset';
import {
  adaptBackendCalendarMonth,
} from '../../src/services/backendDisplayAdapters';
import type { BackendReadClient } from '../../src/services/backendReadClient';
import { cloneBundledDatasetFixture } from '../../src/services/bundledDatasetFixture';
import {
  classifyExternalLinkFailureCategory,
  classifyServiceHandoffFailureCategory,
  trackAnalyticsEvent,
  trackFailureObserved,
} from '../../src/services/analytics';
import {
  openServiceHandoff,
  resolveServiceHandoff,
  type ServiceHandoffFailure,
  type ServiceHandoffResolution,
} from '../../src/services/handoff';
import {
  openExternalLink,
  normalizeExternalLinkUrl,
} from '../../src/services/externalLinks';
import {
  runWithPendingRouteResume,
  type RouteResumeTarget,
} from '../../src/services/routeResume';
import { useAppTheme } from '../../src/tokens/theme';
import { MOBILE_TEXT_SCALE_LIMITS, isLargeTextMode } from '../../src/tokens/accessibility';
import type { ServiceButtonGroupItem } from '../../src/components/actions/ServiceButtonGroup';
import type { SourceLinkRowItem } from '../../src/components/meta/SourceLinkRow';
import type {
  CalendarMonthSnapshotModel,
  ReleaseSummaryModel,
  UpcomingEventModel,
} from '../../src/types';

function buildMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function moveMonthKey(month: string, offset: number): string {
  const [year, monthValue] = month.split('-').map(Number);
  const nextDate = new Date(year, monthValue - 1 + offset, 1);
  return buildMonthKey(nextDate);
}

function formatMonthLabel(month: string): string {
  const [year, monthValue] = month.split('-');
  return `${year}년 ${Number(monthValue)}월`;
}

function formatExactDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatShortDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function formatMonthOnlyLabel(month: string): string {
  const [year, monthValue] = month.split('-');
  return `${year}년 ${Number(monthValue)}월 · 날짜 미정`;
}

function formatFilterLabel(filterMode: CalendarFilterMode): string {
  switch (filterMode) {
    case 'releases':
      return '발매만';
    case 'upcoming':
      return '예정만';
    default:
      return '전체';
  }
}

function formatReleaseKindChip(release: ReleaseSummaryModel): string | null {
  const value = release.releaseKind?.trim();
  return value ? value.toUpperCase() : null;
}

function formatUpcomingLabel(event: UpcomingEventModel): string {
  if (event.datePrecision === 'exact' && event.scheduledDate) {
    return formatExactDateLabel(event.scheduledDate);
  }

  if (event.scheduledMonth) {
    return formatMonthOnlyLabel(event.scheduledMonth);
  }

  return MOBILE_COPY.date.unknown;
}

function applyCalendarFilter(
  snapshot: CalendarMonthSnapshotModel,
  filterMode: CalendarFilterMode,
): CalendarMonthSnapshotModel {
  if (filterMode === 'releases') {
    return {
      ...snapshot,
      upcomingCount: 0,
      nearestUpcoming: null,
      exactUpcoming: [],
      monthOnlyUpcoming: [],
    };
  }

  if (filterMode === 'upcoming') {
    return {
      ...snapshot,
      releaseCount: 0,
      releases: [],
      upcomingCount: snapshot.exactUpcoming.length + snapshot.monthOnlyUpcoming.length,
    };
  }

  return snapshot;
}

function getSelectedDayCounts(
  snapshot: CalendarMonthSnapshotModel,
  isoDate: string,
): { releaseCount: number; upcomingCount: number } {
  return {
    releaseCount: snapshot.releases.filter((release) => release.releaseDate === isoDate).length,
    upcomingCount: snapshot.exactUpcoming.filter((event) => event.scheduledDate === isoDate).length,
  };
}

function buildTeamMonogram(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (!compact) {
    return '??';
  }

  const hasHangul = /[가-힣]/.test(compact);
  if (hasHangul) {
    return compact.slice(0, 2);
  }

  const normalized = compact.replace(/[^A-Za-z0-9]/g, '');
  return (normalized || compact).slice(0, 2).toUpperCase();
}

function buildReleaseIdentityMeta(release: ReleaseSummaryModel): string | undefined {
  if (release.representativeSongTitle?.trim()) {
    return `대표곡 · ${release.representativeSongTitle.trim()}`;
  }

  return release.contextTags[0];
}

export default function CalendarTabScreen() {
  const router = useRouter();
  const hasTrackedViewRef = useRef(false);
  const params = useLocalSearchParams<{
    date?: string | string[];
    filter?: string | string[];
    month?: string | string[];
    sheet?: string | string[];
    view?: string | string[];
  }>();
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const largeTextMode = isLargeTextMode(fontScale);
  const styles = useMemo(() => createStyles(theme, largeTextMode), [theme, largeTextMode]);
  const today = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => buildMonthKey(today), [today]);
  const todayIsoDate = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const routeState = useMemo(
    () => resolveCalendarRouteState(params, currentMonth),
    [currentMonth, params],
  );
  const [activeMonth, setActiveMonth] = useState(routeState.activeMonth);
  const [filterMode, setFilterMode] = useState<CalendarFilterMode>(routeState.filterMode);
  const [draftFilterMode, setDraftFilterMode] = useState<CalendarFilterMode>(routeState.filterMode);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(routeState.selectedDayIso);
  const [isSheetOpen, setIsSheetOpen] = useState(routeState.isSheetOpen);
  const [viewMode, setViewMode] = useState<CalendarViewMode>(routeState.viewMode);
  const [reloadCount, setReloadCount] = useState(0);
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null);
  const bundledProfiles = useMemo(() => cloneBundledDatasetFixture().artistProfiles, []);
  const loadBundledSnapshot = useCallback(async () => {
    const activeDataset = await loadActiveMobileDataset();
    return selectCalendarMonthSnapshot(activeDataset.dataset, activeMonth, todayIsoDate);
  }, [activeMonth, todayIsoDate]);
  const loadBackendSnapshot = useCallback(
    async (client: BackendReadClient) => {
      const response = await client.getCalendarMonth(activeMonth);
      return {
        data: adaptBackendCalendarMonth(activeMonth, response.data),
        generatedAt: response.meta?.generatedAt ?? null,
      };
    },
    [activeMonth],
  );
  const datasetState = useActiveDatasetScreen({
    surface: 'calendar',
    reloadKey: reloadCount,
    cacheKey: `calendar:${activeMonth}:${todayIsoDate}`,
    fallbackErrorMessage: '캘린더 데이터를 지금 불러오지 못했습니다.',
    loadBundled: loadBundledSnapshot,
    loadBackend: loadBackendSnapshot,
  });
  const currentResumeTarget = useMemo<RouteResumeTarget>(
    () => ({
      pathname: '/(tabs)/calendar',
      params: buildCalendarRouteParams({
        activeMonth,
        currentMonth,
        filterMode,
        isSheetOpen,
        selectedDayIso,
        viewMode,
      }),
    }),
    [activeMonth, currentMonth, filterMode, isSheetOpen, selectedDayIso, viewMode],
  );

  useEffect(() => {
    setActiveMonth(routeState.activeMonth);
    setFilterMode(routeState.filterMode);
    setDraftFilterMode(routeState.filterMode);
    setSelectedDayIso(routeState.selectedDayIso);
    setIsSheetOpen(routeState.isSheetOpen);
    setViewMode(routeState.viewMode);
  }, [
    routeState.activeMonth,
    routeState.filterMode,
    routeState.isSheetOpen,
    routeState.selectedDayIso,
    routeState.viewMode,
  ]);

  const source = datasetState.kind === 'ready' ? datasetState.source : null;
  const snapshot = source?.data ?? null;
  const filteredSnapshot = useMemo(
    () => (snapshot ? applyCalendarFilter(snapshot, filterMode) : null),
    [filterMode, snapshot],
  );
  const monthGrid = useMemo(() => {
    if (!filteredSnapshot || !selectedDayIso) {
      return null;
    }

    return buildCalendarMonthGrid(filteredSnapshot, selectedDayIso, todayIsoDate);
  }, [filteredSnapshot, selectedDayIso, todayIsoDate]);
  const selectedDay = monthGrid?.selectedDay ?? null;
  const datasetRiskDisclosure = source
    ? buildDatasetRiskDisclosure(source, '캘린더', 'calendar-dataset-risk-notice')
    : null;
  const groupSlugByGroup = useMemo(() => {
    const entries = new Map<string, string>();

    for (const profile of bundledProfiles) {
      entries.set(profile.group, profile.slug);
      entries.set(profile.slug, profile.slug);
    }

    return entries;
  }, [bundledProfiles]);

  useEffect(() => {
    if (!filteredSnapshot) {
      return;
    }

    setSelectedDayIso((current) => {
      if (current && current.slice(0, 7) === filteredSnapshot.month) {
        return current;
      }

      return resolveInitialCalendarSelection(filteredSnapshot.month, todayIsoDate);
    });
  }, [filteredSnapshot, todayIsoDate]);

  useEffect(() => {
    if (viewMode === 'list' && isSheetOpen) {
      setIsSheetOpen(false);
    }
  }, [isSheetOpen, viewMode]);

  useEffect(() => {
    const currentRouteParams = buildCalendarRouteParams({
      activeMonth: routeState.activeMonth,
      currentMonth,
      filterMode: routeState.filterMode,
      isSheetOpen: routeState.isSheetOpen,
      selectedDayIso: routeState.selectedDayIso,
      viewMode: routeState.viewMode,
    });
    const nextRouteParams = buildCalendarRouteParams({
      activeMonth,
      currentMonth,
      filterMode,
      isSheetOpen,
      selectedDayIso,
      viewMode,
    });

    if (areRouteParamsEqual(currentRouteParams, nextRouteParams)) {
      return;
    }

    router.setParams(nextRouteParams);
  }, [
    activeMonth,
    currentMonth,
    filterMode,
    isSheetOpen,
    routeState.activeMonth,
    routeState.filterMode,
    routeState.isSheetOpen,
    routeState.selectedDayIso,
    routeState.viewMode,
    router,
    selectedDayIso,
    viewMode,
  ]);

  async function openExternalUrl(url?: string) {
    const result = await runWithPendingRouteResume(currentResumeTarget, () =>
      openExternalLink(normalizeExternalLinkUrl('source', url)),
    );
    trackAnalyticsEvent('source_link_opened', {
      surface: 'calendar',
      linkType: 'source',
      host: result.ok ? result.host : result.host,
      ok: result.ok,
      failureCode: result.ok ? null : result.code,
    });

    if (!result.ok) {
      trackFailureObserved(
        'calendar',
        classifyExternalLinkFailureCategory(result.code),
        result.code,
        result.feedback.retryable,
      );
      setHandoffFeedback(result.feedback.message);
      return;
    }

    setHandoffFeedback(null);
  }

  async function handleServiceHandoff(
    handoff: ServiceHandoffResolution | ServiceHandoffFailure,
  ) {
    trackAnalyticsEvent('service_handoff_attempted', {
      surface: 'calendar',
      service: handoff.service,
      mode: handoff.mode,
    });
    const result = await runWithPendingRouteResume(currentResumeTarget, () => openServiceHandoff(handoff));
    trackAnalyticsEvent('service_handoff_completed', {
      surface: 'calendar',
      service: result.service,
      mode: result.mode,
      ok: result.ok,
      target: result.ok ? result.target : result.target,
      failureCode: result.ok ? null : result.code,
    });

    if (!result.ok) {
      trackAnalyticsEvent('service_handoff_failed', {
        surface: 'calendar',
        service: result.service,
        mode: result.mode,
        failureCode: result.code,
        retryable: result.feedback.retryable,
      });
      trackFailureObserved(
        'calendar',
        classifyServiceHandoffFailureCategory(result.code),
        result.code,
        result.feedback.retryable,
      );
      setHandoffFeedback(result.feedback.message);
      return;
    }

    trackAnalyticsEvent('service_handoff_opened', {
      surface: 'calendar',
      service: result.service,
      mode: result.mode,
      target: result.target,
    });
    setHandoffFeedback(null);
  }

  useEffect(() => {
    if (hasTrackedViewRef.current) {
      return;
    }

    hasTrackedViewRef.current = true;
    trackAnalyticsEvent('calendar_viewed', {
      currentMonth: activeMonth,
    });
  }, [activeMonth]);

  function openSearchTab() {
    router.push('/(tabs)/search');
  }

  function jumpToMonth(nextMonth: string, isoDate: string) {
    setActiveMonth(nextMonth);
    setSelectedDayIso(isoDate);
    setIsSheetOpen(false);
  }

  function moveToRelativeMonth(offset: -1 | 1) {
    const nextMonth = moveMonthKey(activeMonth, offset);
    jumpToMonth(nextMonth, resolveInitialCalendarSelection(nextMonth, todayIsoDate));
  }

  function openDaySheet(isoDate: string) {
    if (filteredSnapshot) {
      const counts = getSelectedDayCounts(filteredSnapshot, isoDate);
      trackAnalyticsEvent('calendar_date_drill_opened', {
        date: isoDate,
        source: 'grid',
        filterMode,
        releaseCount: counts.releaseCount,
        upcomingCount: counts.upcomingCount,
      });
    }

    setSelectedDayIso((current) =>
      resolveNextCalendarSelection(
        current ?? isoDate,
        isoDate,
        filteredSnapshot?.month ?? isoDate.slice(0, 7),
      ),
    );
    setIsSheetOpen(true);
  }

  function closeDaySheet() {
    setIsSheetOpen(false);
  }

  function openReleaseDetail(releaseId: string) {
    router.push({
      pathname: '/releases/[id]',
      params: { id: releaseId },
    });
  }

  function openTeamDetailByGroup(group: string) {
    const slug = groupSlugByGroup.get(group);
    if (!slug) {
      return;
    }

    router.push({
      pathname: '/artists/[slug]',
      params: { slug },
    });
  }

  function openFilterSheet() {
    setDraftFilterMode(filterMode);
    setIsFilterSheetOpen(true);
  }

  function closeFilterSheet() {
    setDraftFilterMode(filterMode);
    setIsFilterSheetOpen(false);
  }

  function applyFilterSheet() {
    if (!snapshot) {
      setIsFilterSheetOpen(false);
      return;
    }

    if (filterMode !== draftFilterMode) {
      trackAnalyticsEvent('calendar_filter_changed', {
        filterMode: draftFilterMode,
        month: snapshot.month,
      });
    }

    const nextSnapshot = applyCalendarFilter(snapshot, draftFilterMode);
    if (isSheetOpen && selectedDayIso) {
      const counts = getSelectedDayCounts(nextSnapshot, selectedDayIso);
      if (counts.releaseCount === 0 && counts.upcomingCount === 0) {
        setIsSheetOpen(false);
      }
    }

    setFilterMode(draftFilterMode);
    setIsFilterSheetOpen(false);
  }

  function resetFilterSheet() {
    setDraftFilterMode('all');
  }

  function handleViewChange(nextViewMode: CalendarViewMode) {
    if (viewMode === nextViewMode) {
      return;
    }

    if (nextViewMode === 'list') {
      setIsSheetOpen(false);
    }
    setViewMode(nextViewMode);
  }

  function buildReleaseServiceButtons(release: ReleaseSummaryModel): ServiceButtonGroupItem[] {
    const albumQuery = `${release.displayGroup} ${release.releaseTitle}`;
    const mvQuery = `${release.displayGroup} ${release.representativeSongTitle ?? release.releaseTitle}`;
    const spotify = resolveServiceHandoff({
      service: 'spotify',
      query: albumQuery,
      canonicalUrl: release.spotifyUrl,
    });
    const youtubeMusic = resolveServiceHandoff({
      service: 'youtubeMusic',
      query: albumQuery,
      canonicalUrl: release.youtubeMusicUrl,
    });
    const youtubeMv = resolveServiceHandoff({
      service: 'youtubeMv',
      query: mvQuery,
      canonicalUrl: release.youtubeMvUrl,
    });

    return [
      {
        accessibilityLabel: `Spotify에서 ${release.releaseTitle} 열기`,
        key: `${release.id}-spotify`,
        label: 'Spotify',
        mode: spotify.mode,
        onPress: () => void handleServiceHandoff(spotify),
        service: 'spotify',
        testID: `calendar-release-service-spotify-${release.id}`,
      },
      {
        accessibilityLabel: `YouTube Music에서 ${release.releaseTitle} 열기`,
        key: `${release.id}-youtube-music`,
        label: 'YouTube Music',
        mode: youtubeMusic.mode,
        onPress: () => void handleServiceHandoff(youtubeMusic),
        service: 'youtubeMusic',
        testID: `calendar-release-service-youtube-music-${release.id}`,
      },
      {
        accessibilityLabel: `YouTube에서 ${release.representativeSongTitle ?? release.releaseTitle} MV 열기`,
        key: `${release.id}-youtube-mv`,
        label: 'YouTube MV',
        mode: youtubeMv.mode,
        onPress: () => void handleServiceHandoff(youtubeMv),
        service: 'youtubeMv',
        testID: `calendar-release-service-youtube-mv-${release.id}`,
      },
    ];
  }

  function buildReleaseSourceLinks(release: ReleaseSummaryModel): SourceLinkRowItem[] {
    if (!release.sourceUrl) {
      return [];
    }

    return [
      {
        key: `${release.id}-source`,
        label: MOBILE_COPY.action.sourceView,
        onPress: () => void openExternalUrl(release.sourceUrl),
        type: 'source',
        url: release.sourceUrl,
      },
    ];
  }

  function buildUpcomingSourceLinks(event: UpcomingEventModel): SourceLinkRowItem[] {
    if (!event.sourceUrl) {
      return [];
    }

    return [
      {
        key: `${event.id}-source`,
        label: resolveSourceLinkLabel(event.sourceType),
        onPress: () => void openExternalUrl(event.sourceUrl),
        type: 'source',
        url: event.sourceUrl,
      },
    ];
  }

  function buildReleaseRowProps(
    release: ReleaseSummaryModel,
    testPrefix: string,
  ): ReleaseSummaryRowProps {
    const kindChip = formatReleaseKindChip(release);

    return {
      chips: kindChip ? [{ key: `${release.id}-kind`, label: kindChip }] : [],
      date: formatExactDateLabel(release.releaseDate),
      primaryAction: {
        label: MOBILE_COPY.action.teamPage,
        onPress: () => openTeamDetailByGroup(release.group),
        testID: `${testPrefix}-primary-${release.id}`,
      },
      secondaryAction: {
        label: MOBILE_COPY.action.detailView,
        onPress: () => openReleaseDetail(release.id),
        testID: `${testPrefix}-secondary-${release.id}`,
      },
      serviceButtons: buildReleaseServiceButtons(release),
      sourceLinks: buildReleaseSourceLinks(release),
      team: {
        meta: buildReleaseIdentityMeta(release),
        monogram: buildTeamMonogram(release.displayGroup),
        name: release.displayGroup,
      },
      testID: `${testPrefix}-${release.id}`,
      title: release.releaseTitle,
    };
  }

  function buildUpcomingRowProps(
    event: UpcomingEventModel,
    testPrefix: string,
  ): UpcomingEventRowProps {
    return {
      confidenceChip: resolveUpcomingConfidenceLabel(event.confidence),
      headline: event.releaseLabel ?? event.headline,
      primaryAction: {
        label: MOBILE_COPY.action.teamPage,
        onPress: () => openTeamDetailByGroup(event.group),
        testID: `${testPrefix}-primary-${event.id}`,
      },
      scheduledDate: formatUpcomingLabel(event),
      sourceLinks: buildUpcomingSourceLinks(event),
      statusChip: resolveUpcomingStatusLabel(event.status),
      team: {
        monogram: buildTeamMonogram(event.displayGroup),
        name: event.displayGroup,
      },
      testID: `${testPrefix}-${event.id}`,
    };
  }

  const selectedDayReleaseRows = (selectedDay?.releases ?? [])
    .slice()
    .sort(
      (left, right) =>
        left.displayGroup.localeCompare(right.displayGroup) ||
        left.releaseTitle.localeCompare(right.releaseTitle),
    )
    .map((release) => buildReleaseRowProps(release, 'calendar-sheet-release'));
  const selectedDayUpcomingRows = (selectedDay?.exactUpcoming ?? [])
    .slice()
    .sort(
      (left, right) =>
        left.displayGroup.localeCompare(right.displayGroup) ||
        (left.releaseLabel ?? left.headline).localeCompare(right.releaseLabel ?? right.headline),
    )
    .map((event) => buildUpcomingRowProps(event, 'calendar-sheet-upcoming'));
  const listReleaseRows = filteredSnapshot
    ? filteredSnapshot.releases
        .slice()
        .sort(
          (left, right) =>
            left.releaseDate.localeCompare(right.releaseDate) ||
            left.displayGroup.localeCompare(right.displayGroup),
        )
        .map((release) => buildReleaseRowProps(release, 'calendar-list-release'))
    : [];
  const listExactUpcomingRows = filteredSnapshot
    ? filteredSnapshot.exactUpcoming
        .slice()
        .sort(
          (left, right) =>
            (left.scheduledDate ?? '').localeCompare(right.scheduledDate ?? '') ||
            left.displayGroup.localeCompare(right.displayGroup),
        )
        .map((event) => buildUpcomingRowProps(event, 'calendar-list-upcoming'))
    : [];
  const listMonthOnlyRows = filteredSnapshot
    ? filteredSnapshot.monthOnlyUpcoming
        .slice()
        .sort(
          (left, right) =>
            (left.scheduledMonth ?? '').localeCompare(right.scheduledMonth ?? '') ||
            left.displayGroup.localeCompare(right.displayGroup),
        )
        .map((event) => buildUpcomingRowProps(event, 'calendar-list-month-only'))
    : [];

  const filterGroups = useMemo<FilterSheetGroup[]>(
    () => [
      {
        key: 'mode',
        label: '표시 대상',
        options: [
          { key: 'all', label: '전체', selected: draftFilterMode === 'all' },
          { key: 'releases', label: '발매', selected: draftFilterMode === 'releases' },
          { key: 'upcoming', label: '예정', selected: draftFilterMode === 'upcoming' },
        ],
      },
    ],
    [draftFilterMode],
  );

  function handleFilterOptionToggle(_groupKey: string, optionKey: string) {
    setDraftFilterMode(optionKey as CalendarFilterMode);
  }

  if (datasetState.kind === 'loading') {
    return (
      <ScreenFeedbackState
        body="현재 월 데이터와 예정 신호를 불러오는 중입니다."
        eyebrow="데이터 로딩"
        title="캘린더"
        variant="loading"
      />
    );
  }

  if (datasetState.kind === 'error') {
    return (
      <ScreenFeedbackState
        action={{
          label: MOBILE_COPY.action.retry,
          onPress: () => setReloadCount((count) => count + 1),
        }}
        body={datasetState.message}
        eyebrow="로드 오류"
        title="캘린더"
        variant="error"
      />
    );
  }

  if (!filteredSnapshot || !source) {
    return (
      <ScreenFeedbackState
        body="현재 월 데이터를 찾지 못했습니다."
        eyebrow="빈 월"
        title="캘린더"
        variant="empty"
      />
    );
  }

  const selectedDaySummary = selectedDay
    ? `발매 ${selectedDay.releases.length} · 예정 ${selectedDay.exactUpcoming.length}`
    : '발매 0 · 예정 0';
  const nearestSummary = filteredSnapshot.nearestUpcoming?.scheduledDate
    ? `${filteredSnapshot.nearestUpcoming.displayGroup} · ${formatShortDateLabel(filteredSnapshot.nearestUpcoming.scheduledDate)}`
    : '없음';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={styles.headerBar} testID="calendar-app-bar">
          <View style={styles.monthCluster}>
            <Text
              accessibilityRole="header"
              allowFontScaling
              maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.screenTitle}
              style={[styles.monthTitle, largeTextMode ? styles.monthTitleCompact : null]}
              testID="calendar-month-title"
            >
              {formatMonthLabel(filteredSnapshot.month)}
            </Text>
            <View style={[styles.monthNav, largeTextMode ? styles.actionRowLargeText : null]}>
              <Pressable
                accessibilityHint="이전 달 일정을 봅니다."
                accessibilityLabel={`${formatMonthLabel(moveMonthKey(activeMonth, -1))}로 이동`}
                accessibilityRole="button"
                onPress={() => moveToRelativeMonth(-1)}
                style={({ pressed }) => [
                  styles.headerButton,
                  largeTextMode ? styles.headerButtonLargeText : null,
                  pressed ? styles.headerButtonPressed : null,
                ]}
                testID="calendar-month-prev"
              >
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.buttonService}
                  style={styles.headerButtonLabel}
                >
                  이전
                </Text>
              </Pressable>
              <Pressable
                accessibilityHint="다음 달 일정을 봅니다."
                accessibilityLabel={`${formatMonthLabel(moveMonthKey(activeMonth, 1))}로 이동`}
                accessibilityRole="button"
                onPress={() => moveToRelativeMonth(1)}
                style={({ pressed }) => [
                  styles.headerButton,
                  largeTextMode ? styles.headerButtonLargeText : null,
                  pressed ? styles.headerButtonPressed : null,
                ]}
                testID="calendar-month-next"
              >
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.buttonService}
                  style={styles.headerButtonLabel}
                >
                  다음
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.trailingActions, largeTextMode ? styles.actionRowLargeText : null]}>
            <Pressable
              accessibilityLabel="검색 탭으로 이동"
              accessibilityRole="button"
              onPress={openSearchTab}
              style={({ pressed }) => [
                styles.headerButton,
                largeTextMode ? styles.headerButtonLargeText : null,
                pressed ? styles.headerButtonPressed : null,
              ]}
              testID="calendar-search-open"
            >
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.buttonService}
                style={styles.headerButtonLabel}
              >
                검색
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="캘린더 필터 열기"
              accessibilityRole="button"
              accessibilityState={{ selected: filterMode !== 'all' || isFilterSheetOpen }}
              onPress={openFilterSheet}
              style={({ pressed }) => [
                styles.headerButton,
                largeTextMode ? styles.headerButtonLargeText : null,
                pressed ? styles.headerButtonPressed : null,
              ]}
              testID="calendar-filter-open"
            >
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.buttonService}
                style={styles.headerButtonLabel}
              >
                필터
              </Text>
            </Pressable>
          </View>
        </View>

        <SummaryStrip
          items={[
            { key: 'release-count', label: '이번 달 발매', value: filteredSnapshot.releaseCount },
            { key: 'upcoming-count', label: '예정 컴백', value: filteredSnapshot.upcomingCount },
            { key: 'nearest-upcoming', label: '가장 가까운 일정', value: nearestSummary },
          ]}
          layout="wrap"
          testID="calendar-summary-strip"
        />

        {datasetRiskDisclosure ? (
          <InlineFeedbackNotice
            body={datasetRiskDisclosure.body}
            testID={datasetRiskDisclosure.testID}
            title={datasetRiskDisclosure.title}
          />
        ) : null}

        {handoffFeedback ? (
          <InlineFeedbackNotice
            body={handoffFeedback}
            testID="calendar-handoff-feedback"
            title="외부 이동을 완료하지 못했습니다."
          />
        ) : null}

        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text
                accessibilityRole="header"
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                style={styles.sectionTitle}
              >
                보기
              </Text>
            <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.sectionMeta}>
              {formatFilterLabel(filterMode)}
            </Text>
          </View>
          <SegmentedControl
            items={[
              { key: 'calendar', label: '캘린더' },
              { key: 'list', label: '리스트' },
            ]}
            onChange={(key) => handleViewChange(key as CalendarViewMode)}
            selectedKey={viewMode}
            testID="calendar-view"
          />
        </View>

        {viewMode === 'calendar' && monthGrid ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text
                accessibilityRole="header"
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                style={styles.sectionTitle}
              >
                월간 캘린더
              </Text>
              <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.sectionMeta}>
                {selectedDay ? selectedDay.label : formatMonthLabel(filteredSnapshot.month)}
              </Text>
            </View>

            <View style={styles.weekdayRow}>
              {monthGrid.weekdayLabels.map((label) => (
                <Text
                  key={label}
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta}
                  style={styles.weekdayLabel}
                >
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthGrid.weeks.map((week, weekIndex) => (
                <View key={`${monthGrid.month}-week-${weekIndex}`} style={styles.weekRow}>
                  {week.map((cell, cellIndex) => {
                    if (!cell) {
                      return (
                        <View
                          key={`${monthGrid.month}-empty-${weekIndex}-${cellIndex}`}
                          style={styles.emptyCell}
                        />
                      );
                    }

                    return (
                      <DayCell
                        key={cell.isoDate}
                        badges={cell.badges}
                        dateNumber={cell.dayNumber}
                        extraCount={cell.overflowCount}
                        isCurrentMonth={cell.isCurrentMonth}
                        isSelected={cell.isSelected}
                        isToday={cell.isToday}
                        isoDate={cell.isoDate}
                        onPress={() => openDaySheet(cell.isoDate)}
                        releaseCount={cell.releaseCount}
                        upcomingCount={cell.upcomingCount}
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            {filteredSnapshot.releaseCount === 0 && filteredSnapshot.upcomingCount === 0 ? (
              <InlineFeedbackNotice
                body={`현재 dataset source에는 ${formatMonthLabel(filteredSnapshot.month)} 기준 발매나 예정 컴백이 없습니다.`}
              />
            ) : null}
          </View>
        ) : null}

        {viewMode === 'calendar' ? (
          <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
              <Text
                accessibilityRole="header"
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                style={styles.sectionTitle}
              >
                월 단위 예정 신호
              </Text>
              <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.sectionMeta}>
                {filteredSnapshot.monthOnlyUpcoming.length}건
              </Text>
            </View>
            {filterMode === 'releases' ? (
              <InlineFeedbackNotice body="현재 필터에서는 월 단위 예정 신호를 숨깁니다." />
            ) : listMonthOnlyRows.length > 0 ? (
              <View style={styles.sectionStack}>
                {listMonthOnlyRows.map((row) => (
                  <UpcomingEventRow key={row.testID} {...row} />
                ))}
              </View>
            ) : (
              <InlineFeedbackNotice body="현재 월에 월 단위 예정 신호가 없습니다." />
            )}
          </View>
        ) : null}

        {viewMode === 'list' ? (
          <View style={styles.sectionStack}>
            {filterMode !== 'upcoming' ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text
                    accessibilityRole="header"
                    allowFontScaling
                    maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                    style={styles.sectionTitle}
                  >
                    검증된 발매
                  </Text>
                  <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.sectionMeta}>
                    {listReleaseRows.length}건
                  </Text>
                </View>
                {listReleaseRows.length > 0 ? (
                  <View style={styles.sectionStack}>
                    {listReleaseRows.map((row) => (
                      <ReleaseSummaryRow key={row.testID} {...row} />
                    ))}
                  </View>
                ) : (
                  <InlineFeedbackNotice body="현재 월에 확정 발매가 없습니다." />
                )}
              </View>
            ) : null}

            {filterMode !== 'releases' ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text
                    accessibilityRole="header"
                    allowFontScaling
                    maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                    style={styles.sectionTitle}
                  >
                    날짜가 잡힌 예정 컴백
                  </Text>
                  <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.sectionMeta}>
                    {listExactUpcomingRows.length}건
                  </Text>
                </View>
                {listExactUpcomingRows.length > 0 ? (
                  <View style={styles.sectionStack}>
                    {listExactUpcomingRows.map((row) => (
                      <UpcomingEventRow key={row.testID} {...row} />
                    ))}
                  </View>
                ) : (
                  <InlineFeedbackNotice body="현재 월에 날짜가 잡힌 예정 컴백이 없습니다." />
                )}
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text
                  accessibilityRole="header"
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                  style={styles.sectionTitle}
                >
                  월 단위 예정 신호
                </Text>
                <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.sectionMeta}>
                  {listMonthOnlyRows.length}건
                </Text>
              </View>
              {filterMode === 'releases' ? (
                <InlineFeedbackNotice body="현재 필터에서는 월 단위 예정 신호를 숨깁니다." />
              ) : listMonthOnlyRows.length > 0 ? (
                <View style={styles.sectionStack}>
                  {listMonthOnlyRows.map((row) => (
                    <UpcomingEventRow key={row.testID} {...row} />
                  ))}
                </View>
              ) : (
                <InlineFeedbackNotice body="현재 월에 월 단위 예정 신호가 없습니다." />
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {selectedDay ? (
        <DateDetailSheet
          isOpen={isSheetOpen && viewMode === 'calendar'}
          onClose={closeDaySheet}
          scheduledRows={selectedDayUpcomingRows}
          summary={selectedDaySummary}
          title={`${selectedDay.label} 발매/컴백`}
          verifiedRows={selectedDayReleaseRows}
        />
      ) : null}

      <FilterSheet
        applyButtonTestID="calendar-filter-apply"
        closeButtonTestID="calendar-filter-close"
        groups={filterGroups}
        isOpen={isFilterSheetOpen}
        onApply={applyFilterSheet}
        onClose={closeFilterSheet}
        onReset={resetFilterSheet}
        onToggleOption={handleFilterOptionToggle}
        resetButtonTestID="calendar-filter-reset"
        testID="calendar-filter-sheet"
        title="캘린더 필터"
      />
    </>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>, largeTextMode: boolean) {
  const { lineHeight: _screenTitleLineHeight, ...screenTitleTypography } =
    theme.typography.screenTitle;
  const { lineHeight: _buttonServiceLineHeight, ...buttonServiceTypography } =
    theme.typography.buttonService;
  const { lineHeight: _sectionTitleLineHeight, ...sectionTitleTypography } =
    theme.typography.sectionTitle;
  const { lineHeight: _bodyLineHeight, ...bodyTypography } = theme.typography.body;
  const { lineHeight: _metaLineHeight, ...metaTypography } = theme.typography.meta;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.surface.base,
    },
    content: {
      paddingHorizontal: theme.space[24],
      paddingTop: theme.space[24],
      paddingBottom: theme.space[32],
      gap: theme.space[16],
    },
    headerBar: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.space[12],
    },
    monthCluster: {
      width: '100%',
      gap: theme.space[8],
    },
    monthTitle: {
      ...screenTitleTypography,
      color: theme.colors.text.primary,
    },
    monthTitleCompact: {
      fontSize: theme.typography.sectionTitle.fontSize,
      fontWeight: theme.typography.sectionTitle.fontWeight,
      letterSpacing: theme.typography.sectionTitle.letterSpacing,
    },
    monthNav: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    actionRowLargeText: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    trailingActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
      justifyContent: 'flex-start',
      maxWidth: '100%',
    },
    headerButton: {
      minHeight: theme.size.button.heightSecondary,
      justifyContent: 'center',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    headerButtonLargeText: {
      flexGrow: 1,
      flexBasis: largeTextMode ? '48%' : undefined,
      minWidth: 0,
    },
    headerButtonPressed: {
      opacity: 0.84,
    },
    headerButtonLabel: {
      ...buttonServiceTypography,
      color: theme.colors.text.primary,
    },
    sectionCard: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
    },
    sectionHeader: {
      gap: theme.space[4],
    },
    sectionTitle: {
      ...sectionTitleTypography,
      color: theme.colors.text.primary,
    },
    sectionMeta: {
      ...bodyTypography,
      color: theme.colors.text.secondary,
    },
    sectionStack: {
      gap: theme.space[12],
    },
    weekdayRow: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    weekdayLabel: {
      flex: 1,
      textAlign: 'center',
      ...metaTypography,
      color: theme.colors.text.tertiary,
    },
    calendarGrid: {
      gap: theme.space[8],
    },
    weekRow: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    emptyCell: {
      flex: 1,
      minHeight: 96,
    },
  });
}
