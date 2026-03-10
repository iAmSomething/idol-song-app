import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DateDetailSheet } from '../../src/components/calendar/DateDetailSheet';
import { DayCell } from '../../src/components/calendar/DayCell';
import { SegmentedControl } from '../../src/components/controls/SegmentedControl';
import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
import { AppBar } from '../../src/components/layout/AppBar';
import { SummaryStrip } from '../../src/components/layout/SummaryStrip';
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
import {
  selectCalendarMonthSnapshot,
  selectNearestExactUpcomingEvent,
} from '../../src/selectors';
import { trackAnalyticsEvent } from '../../src/services/analytics';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  CalendarMonthSnapshotModel,
  UpcomingEventModel,
} from '../../src/types';

function buildMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(month: string): string {
  const [year, monthValue] = month.split('-');
  return `${year}년 ${Number(monthValue)}월`;
}

function formatUpcomingLabel(event: UpcomingEventModel): string {
  if (event.datePrecision === 'exact' && event.scheduledDate) {
    return event.scheduledDate;
  }

  if (event.scheduledMonth) {
    return `${event.scheduledMonth} · 날짜 미정`;
  }

  return '날짜 미정';
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

function moveMonthKey(month: string, offset: number): string {
  const [year, monthValue] = month.split('-').map(Number);
  const next = new Date(year, monthValue - 1 + offset, 1);
  return buildMonthKey(next);
}

function getSelectedDayCounts(snapshot: CalendarMonthSnapshotModel, isoDate: string): {
  releaseCount: number;
  upcomingCount: number;
} {
  return {
    releaseCount: snapshot.releases.filter((release) => release.releaseDate === isoDate).length,
    upcomingCount: snapshot.exactUpcoming.filter((event) => event.scheduledDate === isoDate).length,
  };
}

type CalendarListRowModel = {
  isoDate: string;
  label: string;
  releaseCount: number;
  releaseTitles: string[];
  upcomingCount: number;
  upcomingTitles: string[];
};

function formatDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function buildCalendarListRows(snapshot: CalendarMonthSnapshotModel): CalendarListRowModel[] {
  const rows = new Map<string, CalendarListRowModel>();

  for (const release of snapshot.releases) {
    const current = rows.get(release.releaseDate) ?? {
      isoDate: release.releaseDate,
      label: formatDayLabel(release.releaseDate),
      releaseCount: 0,
      releaseTitles: [],
      upcomingCount: 0,
      upcomingTitles: [],
    };

    current.releaseCount += 1;
    current.releaseTitles.push(release.releaseTitle);
    rows.set(release.releaseDate, current);
  }

  for (const event of snapshot.exactUpcoming) {
    if (!event.scheduledDate) {
      continue;
    }

    const current = rows.get(event.scheduledDate) ?? {
      isoDate: event.scheduledDate,
      label: formatDayLabel(event.scheduledDate),
      releaseCount: 0,
      releaseTitles: [],
      upcomingCount: 0,
      upcomingTitles: [],
    };

    current.upcomingCount += 1;
    current.upcomingTitles.push(event.releaseLabel ?? event.headline);
    rows.set(event.scheduledDate, current);
  }

  return Array.from(rows.values()).sort((left, right) => left.isoDate.localeCompare(right.isoDate));
}

export default function CalendarTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string | string[];
    filter?: string | string[];
    month?: string | string[];
    sheet?: string | string[];
    view?: string | string[];
  }>();
  const theme = useAppTheme();
  const [reloadCount, setReloadCount] = useState(0);
  const today = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => buildMonthKey(today), [today]);
  const todayIsoDate = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const routeState = useMemo(
    () => resolveCalendarRouteState(params, currentMonth),
    [currentMonth, params],
  );
  const [activeMonth, setActiveMonth] = useState(routeState.activeMonth);
  const [filterMode, setFilterMode] = useState<CalendarFilterMode>(routeState.filterMode);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(routeState.selectedDayIso);
  const [isSheetOpen, setIsSheetOpen] = useState(routeState.isSheetOpen);
  const [viewMode, setViewMode] = useState<CalendarViewMode>(routeState.viewMode);
  const datasetState = useActiveDatasetScreen({
    surface: 'calendar',
    reloadKey: reloadCount,
    fallbackErrorMessage: 'Calendar dataset could not be loaded right now.',
  });
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    setActiveMonth(routeState.activeMonth);
    setFilterMode(routeState.filterMode);
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
  const snapshot = useMemo(
    () => (source ? selectCalendarMonthSnapshot(source.dataset, activeMonth, todayIsoDate) : null),
    [activeMonth, source, todayIsoDate],
  );
  const globalNearestUpcoming = useMemo(() => {
    if (!source) {
      return null;
    }

    return selectNearestExactUpcomingEvent(source.dataset, todayIsoDate);
  }, [source, todayIsoDate]);
  const filteredSnapshot = useMemo(
    () => (snapshot ? applyCalendarFilter(snapshot, filterMode) : null),
    [filterMode, snapshot],
  );
  const datasetRiskDisclosure = source
    ? buildDatasetRiskDisclosure(source, '캘린더', 'calendar-dataset-risk-notice')
    : null;
  const groupSlugByGroup = useMemo(() => {
    const entries = new Map<string, string>();

    if (!source) {
      return entries;
    }

    for (const profile of source.dataset.artistProfiles) {
      entries.set(profile.group, profile.slug);
    }

    return entries;
  }, [source]);

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

  const monthGrid = useMemo(() => {
    if (!filteredSnapshot || !selectedDayIso) {
      return null;
    }

    return buildCalendarMonthGrid(filteredSnapshot, selectedDayIso, todayIsoDate);
  }, [filteredSnapshot, selectedDayIso, todayIsoDate]);

  const selectedDay = monthGrid?.selectedDay ?? null;
  const listRows = useMemo(
    () => (filteredSnapshot ? buildCalendarListRows(filteredSnapshot) : []),
    [filteredSnapshot],
  );

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

  function jumpToMonth(month: string, isoDate: string) {
    setActiveMonth(month);
    setSelectedDayIso(isoDate);
    setIsSheetOpen(false);
  }

  function moveToRelativeMonth(offset: -1 | 1) {
    const nextMonth = moveMonthKey(activeMonth, offset);
    jumpToMonth(nextMonth, resolveInitialCalendarSelection(nextMonth, todayIsoDate));
  }

  function jumpToToday() {
    trackAnalyticsEvent('calendar_quick_jump_used', {
      target: 'today',
      fromMonth: activeMonth,
      toMonth: currentMonth,
    });
    setFilterMode('all');
    jumpToMonth(currentMonth, todayIsoDate);
  }

  function jumpToNearestUpcoming() {
    if (!source || !globalNearestUpcoming?.scheduledDate) {
      return;
    }

    const nextMonth = globalNearestUpcoming.scheduledDate.slice(0, 7);
    const baseSnapshot = selectCalendarMonthSnapshot(source.dataset, nextMonth, todayIsoDate);
    const nextSnapshot = applyCalendarFilter(baseSnapshot, 'all');
    const counts = getSelectedDayCounts(nextSnapshot, globalNearestUpcoming.scheduledDate);

    trackAnalyticsEvent('calendar_quick_jump_used', {
      target: 'nearest_upcoming',
      fromMonth: activeMonth,
      toMonth: nextMonth,
    });
    trackAnalyticsEvent('calendar_date_drill_opened', {
      date: globalNearestUpcoming.scheduledDate,
      source: 'nearest_upcoming',
      filterMode: 'all',
      releaseCount: counts.releaseCount,
      upcomingCount: counts.upcomingCount,
    });
    setFilterMode('all');
    setActiveMonth(nextMonth);
    setSelectedDayIso(globalNearestUpcoming.scheduledDate);
    setIsSheetOpen(true);
  }

  function openDaySheet(isoDate: string, sourceLabel: 'grid' | 'nearest_upcoming' = 'grid') {
    if (filteredSnapshot) {
      const counts = getSelectedDayCounts(filteredSnapshot, isoDate);
      trackAnalyticsEvent('calendar_date_drill_opened', {
        date: isoDate,
        source: sourceLabel,
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

  function handleFilterChange(nextFilterMode: CalendarFilterMode) {
    if (filterMode === nextFilterMode || !filteredSnapshot) {
      return;
    }

    trackAnalyticsEvent('calendar_filter_changed', {
      filterMode: nextFilterMode,
      month: filteredSnapshot.month,
    });
    setFilterMode(nextFilterMode);
  }

  function handleViewChange(nextViewMode: CalendarViewMode) {
    if (viewMode === nextViewMode) {
      return;
    }

    setViewMode(nextViewMode);
  }

  if (datasetState.kind === 'loading') {
    return (
      <ScreenFeedbackState
        body="현재 월 데이터와 예정 신호를 불러오는 중입니다."
        eyebrow="DATASET LOADING"
        title="Calendar"
        variant="loading"
      />
    );
  }

  if (datasetState.kind === 'error') {
    return (
      <ScreenFeedbackState
        action={{
          label: '다시 시도',
          onPress: () => setReloadCount((count) => count + 1),
        }}
        body={datasetState.message}
        eyebrow="LOAD ERROR"
        title="Calendar"
        variant="error"
      />
    );
  }

  if (!filteredSnapshot || !source) {
    return (
      <ScreenFeedbackState
        body="현재 월 데이터를 찾지 못했습니다."
        eyebrow="EMPTY MONTH"
        title="Calendar"
        variant="empty"
      />
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <AppBar
          leadingAction={{
            accessibilityHint: '이전 달 일정을 봅니다.',
            accessibilityLabel: `${formatMonthLabel(moveMonthKey(activeMonth, -1))}로 이동`,
            label: '이전',
            onPress: () => moveToRelativeMonth(-1),
            testID: 'calendar-month-prev',
          }}
          subtitle={source.sourceLabel}
          testID="calendar-app-bar"
          title={formatMonthLabel(filteredSnapshot.month)}
          titleTestID="calendar-month-title"
          trailingActions={[
            {
              accessibilityHint: '다음 달 일정을 봅니다.',
              accessibilityLabel: `${formatMonthLabel(moveMonthKey(activeMonth, 1))}로 이동`,
              key: 'next',
              label: '다음',
              onPress: () => moveToRelativeMonth(1),
              testID: 'calendar-month-next',
            },
          ]}
        />

        {datasetRiskDisclosure ? (
          <InlineFeedbackNotice
            body={datasetRiskDisclosure.body}
            testID={datasetRiskDisclosure.testID}
            title={datasetRiskDisclosure.title}
          />
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.calendarHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Quick jumps</Text>
            <Text style={styles.sectionMeta}>
              {globalNearestUpcoming?.scheduledDate
                ? `${globalNearestUpcoming.displayGroup} · ${globalNearestUpcoming.scheduledDate}`
                : '다가오는 exact 일정 없음'}
            </Text>
          </View>

          <View style={styles.controlRow}>
            <Pressable
              testID="calendar-jump-today"
              accessibilityHint="현재 월과 오늘 날짜로 이동합니다."
              accessibilityLabel="오늘로 이동"
              accessibilityRole="button"
              onPress={jumpToToday}
              style={({ pressed }) => [
                styles.controlChip,
                styles.controlChipStrong,
                pressed ? styles.controlChipPressed : null,
              ]}
            >
              <Text style={styles.controlChipStrongLabel}>오늘</Text>
            </Pressable>

            <Pressable
              testID="calendar-jump-nearest"
              accessibilityHint={
                globalNearestUpcoming?.scheduledDate
                  ? '가장 가까운 exact 일정 날짜를 열어 상세 시트를 표시합니다.'
                  : undefined
              }
              accessibilityLabel={
                globalNearestUpcoming?.scheduledDate
                  ? `${globalNearestUpcoming.displayGroup} 가장 가까운 일정 열기`
                  : '가장 가까운 일정 없음'
              }
              accessibilityRole="button"
              disabled={!globalNearestUpcoming?.scheduledDate}
              onPress={jumpToNearestUpcoming}
              style={({ pressed }) => [
                styles.controlChip,
                !globalNearestUpcoming?.scheduledDate ? styles.buttonDisabled : null,
                pressed && globalNearestUpcoming?.scheduledDate ? styles.controlChipPressed : null,
              ]}
            >
              <Text style={styles.controlChipLabel}>가장 가까운 일정</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.controlsBlock}>
            <View style={styles.controlSection}>
              <View style={styles.calendarHeader}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>View</Text>
                <Text style={styles.sectionMeta}>{viewMode === 'calendar' ? 'Calendar' : 'List'}</Text>
              </View>
              <SegmentedControl
                items={[
                  { key: 'calendar', label: 'Calendar' },
                  { key: 'list', label: 'List' },
                ]}
                onChange={(key) => handleViewChange(key as CalendarViewMode)}
                selectedKey={viewMode}
                testID="calendar-view"
              />
            </View>

            <View style={styles.controlSection}>
              <View style={styles.calendarHeader}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Filters</Text>
                <Text style={styles.sectionMeta}>{formatFilterLabel(filterMode)}</Text>
              </View>

              <SegmentedControl
                items={[
                  { key: 'all', label: '전체' },
                  { key: 'releases', label: '발매' },
                  { key: 'upcoming', label: '예정' },
                ]}
                onChange={(key) => handleFilterChange(key as CalendarFilterMode)}
                selectedKey={filterMode}
                testID="calendar-filter"
              />
            </View>
          </View>
        </View>

        <SummaryStrip
          items={[
            { key: 'release-count', label: '이번 달 발매', value: filteredSnapshot.releaseCount },
            { key: 'upcoming-count', label: '예정 컴백', value: filteredSnapshot.upcomingCount },
            {
              key: 'nearest-upcoming',
              label: '가장 가까운 일정',
              value: filteredSnapshot.nearestUpcoming?.displayGroup ?? '없음',
            },
          ]}
          layout="wrap"
          testID="calendar-summary-strip"
        />

        {viewMode === 'calendar' && monthGrid ? (
          <View style={styles.sectionCard}>
            <View style={styles.calendarHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Calendar grid</Text>
              <Text style={styles.sectionMeta}>
                {selectedDay ? selectedDay.label : formatMonthLabel(filteredSnapshot.month)}
              </Text>
            </View>

            <View style={styles.weekdayRow}>
              {monthGrid.weekdayLabels.map((label) => (
                <Text key={label} style={styles.weekdayLabel}>
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

        {viewMode === 'list' ? (
          <View style={styles.sectionCard}>
            <View style={styles.calendarHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>List view</Text>
              <Text style={styles.sectionMeta}>{listRows.length}일</Text>
            </View>
            {listRows.length > 0 ? (
              <View style={styles.listRows}>
                {listRows.map((row) => (
                  <Pressable
                    key={row.isoDate}
                    accessibilityHint="이 날짜의 발매와 예정 상세를 엽니다."
                    accessibilityLabel={`${row.label} 상세 열기`}
                    accessibilityRole="button"
                    onPress={() => openDaySheet(row.isoDate)}
                    style={({ pressed }) => [
                      styles.listRowCard,
                      pressed ? styles.buttonPressed : null,
                    ]}
                    testID={`calendar-list-row-${row.isoDate}`}
                  >
                    <View style={styles.listRowHeader}>
                      <Text style={styles.listRowTitle}>{row.label}</Text>
                      <Text style={styles.listRowMeta}>
                        발매 {row.releaseCount} · 예정 {row.upcomingCount}
                      </Text>
                    </View>
                    {row.releaseTitles.length > 0 ? (
                      <Text style={styles.listRowBody}>
                        발매: {row.releaseTitles.slice(0, 2).join(', ')}
                        {row.releaseTitles.length > 2 ? ` 외 ${row.releaseTitles.length - 2}건` : ''}
                      </Text>
                    ) : null}
                    {row.upcomingTitles.length > 0 ? (
                      <Text style={styles.listRowBody}>
                        예정: {row.upcomingTitles.slice(0, 2).join(', ')}
                        {row.upcomingTitles.length > 2 ? ` 외 ${row.upcomingTitles.length - 2}건` : ''}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <InlineFeedbackNotice
                body={`현재 dataset source에는 ${formatMonthLabel(filteredSnapshot.month)} 기준 발매나 예정 컴백이 없습니다.`}
              />
            )}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.calendarHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Month-only signals</Text>
            <Text style={styles.sectionMeta}>{filteredSnapshot.monthOnlyUpcoming.length}건</Text>
          </View>
          <Text style={styles.body}>
            month-only 예정 신호는 날짜 셀에 넣지 않고 월 컨텍스트 버킷으로 유지합니다.
          </Text>
          {filterMode === 'releases' ? (
            <InlineFeedbackNotice body="현재 필터에서는 month-only 예정 신호를 숨깁니다." />
          ) : filteredSnapshot.monthOnlyUpcoming.length ? (
            filteredSnapshot.monthOnlyUpcoming.map((event) => (
              <View key={event.id} style={styles.row}>
                <Text style={styles.rowTitle}>{event.displayGroup}</Text>
                <Text style={styles.rowBody}>{event.headline}</Text>
                <Text style={styles.rowMeta}>{formatUpcomingLabel(event)}</Text>
              </View>
            ))
          ) : (
            <InlineFeedbackNotice body="현재 월에 month-only 예정 신호가 없습니다." />
          )}
        </View>
      </ScrollView>

      {selectedDay ? (
        <DateDetailSheet
          isOpen={isSheetOpen}
          onClose={closeDaySheet}
          onPressRelease={openReleaseDetail}
          onPressTeam={openTeamDetailByGroup}
          scheduledRows={selectedDay.exactUpcoming}
          summary={formatMonthLabel(filteredSnapshot.month)}
          title={selectedDay.label}
          verifiedRows={selectedDay.releases}
        />
      ) : null}
    </>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
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
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.space[24],
      gap: theme.space[12],
      backgroundColor: theme.colors.surface.base,
    },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[12],
    },
    header: {
      gap: theme.space[8],
    },
    monthTitleWrap: {
      flex: 1,
      alignItems: 'center',
      gap: theme.space[4],
    },
    monthButton: {
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.elevated,
      minHeight: 44,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
    },
    monthButtonPressed: {
      backgroundColor: theme.colors.surface.interactive,
    },
    monthButtonLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      flexShrink: 1,
      textAlign: 'center',
    },
    eyebrow: {
      color: theme.colors.text.brand,
      fontSize: theme.typography.meta.fontSize,
      fontWeight: theme.typography.meta.fontWeight,
      letterSpacing: theme.typography.meta.letterSpacing,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.screenTitle.fontSize,
      lineHeight: theme.typography.screenTitle.lineHeight,
      fontWeight: theme.typography.screenTitle.fontWeight,
      letterSpacing: theme.typography.screenTitle.letterSpacing,
    },
    body: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    row: {
      gap: theme.space[4],
      paddingVertical: theme.space[8],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.subtle,
    },
    rowTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    rowBody: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    rowMeta: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    listRows: {
      gap: theme.space[12],
    },
    listRowCard: {
      gap: theme.space[8],
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.elevated,
      minHeight: 72,
    },
    listRowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.space[12],
    },
    listRowTitle: {
      flex: 1,
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    listRowMeta: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
      textAlign: 'right',
    },
    listRowBody: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    sourceCard: {
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
      padding: theme.space[16],
      gap: theme.space[8],
    },
    sourceLabel: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      fontWeight: theme.typography.meta.fontWeight,
      letterSpacing: theme.typography.meta.letterSpacing,
      textTransform: 'uppercase',
    },
    sourceValue: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    sourceIssue: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    summaryGrid: {
      gap: theme.space[12],
    },
    controlsBlock: {
      gap: theme.space[16],
    },
    controlSection: {
      gap: theme.space[8],
    },
    summaryCard: {
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.elevated,
      padding: theme.space[16],
      gap: theme.space[8],
    },
    summaryLabel: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
      letterSpacing: theme.typography.meta.letterSpacing,
      textTransform: 'uppercase',
    },
    summaryValue: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.screenTitle.fontSize,
      lineHeight: theme.typography.screenTitle.lineHeight,
      fontWeight: theme.typography.screenTitle.fontWeight,
    },
    summaryValueSmall: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: theme.typography.sectionTitle.fontWeight,
    },
    summaryMeta: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    controlRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    controlChip: {
      borderRadius: theme.radius.chip,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      minHeight: 44,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
    },
    controlChipStrong: {
      backgroundColor: theme.colors.text.brand,
      borderColor: theme.colors.text.brand,
    },
    controlChipActive: {
      backgroundColor: theme.colors.surface.interactive,
      borderColor: theme.colors.border.focus,
    },
    controlChipPressed: {
      backgroundColor: theme.colors.surface.interactive,
    },
    controlChipLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      flexShrink: 1,
      textAlign: 'center',
    },
    controlChipStrongLabel: {
      color: theme.colors.surface.base,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      flexShrink: 1,
      textAlign: 'center',
    },
    controlChipActiveLabel: {
      color: theme.colors.text.brand,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      flexShrink: 1,
      textAlign: 'center',
    },
    sectionCard: {
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
      padding: theme.space[16],
      gap: theme.space[12],
    },
    calendarHeader: {
      gap: theme.space[4],
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: theme.typography.sectionTitle.fontWeight,
    },
    sectionMeta: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    weekdayRow: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    weekdayLabel: {
      flex: 1,
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
      textAlign: 'center',
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
      minHeight: 88,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonPressed: {
      opacity: 0.84,
    },
    retryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.text.brand,
    },
    retryButtonLabel: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.buttonPrimary.fontSize,
      lineHeight: theme.typography.buttonPrimary.lineHeight,
      fontWeight: theme.typography.buttonPrimary.fontWeight,
    },
  });
}
