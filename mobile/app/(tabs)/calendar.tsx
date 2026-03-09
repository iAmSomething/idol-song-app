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
import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
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

export default function CalendarTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string | string[];
    filter?: string | string[];
    month?: string | string[];
    sheet?: string | string[];
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
  }, [
    routeState.activeMonth,
    routeState.filterMode,
    routeState.isSheetOpen,
    routeState.selectedDayIso,
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

  useEffect(() => {
    const currentRouteParams = buildCalendarRouteParams({
      activeMonth: routeState.activeMonth,
      currentMonth,
      filterMode: routeState.filterMode,
      isSheetOpen: routeState.isSheetOpen,
      selectedDayIso: routeState.selectedDayIso,
    });
    const nextRouteParams = buildCalendarRouteParams({
      activeMonth,
      currentMonth,
      filterMode,
      isSheetOpen,
      selectedDayIso,
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
    router,
    selectedDayIso,
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
        <View style={styles.appBar}>
          <Pressable
            testID="calendar-month-prev"
            accessibilityHint="이전 달 일정을 봅니다."
            accessibilityLabel={`${formatMonthLabel(moveMonthKey(activeMonth, -1))}로 이동`}
            accessibilityRole="button"
            onPress={() => moveToRelativeMonth(-1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed ? styles.monthButtonPressed : null,
            ]}
          >
            <Text style={styles.monthButtonLabel}>이전</Text>
          </Pressable>

          <View style={styles.monthTitleWrap}>
            <Text style={styles.eyebrow}>DATA-BACKED TAB</Text>
            <Text accessibilityRole="header" testID="calendar-month-title" style={styles.title}>
              {formatMonthLabel(filteredSnapshot.month)}
            </Text>
          </View>

          <Pressable
            testID="calendar-month-next"
            accessibilityHint="다음 달 일정을 봅니다."
            accessibilityLabel={`${formatMonthLabel(moveMonthKey(activeMonth, 1))}로 이동`}
            accessibilityRole="button"
            onPress={() => moveToRelativeMonth(1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed ? styles.monthButtonPressed : null,
            ]}
          >
            <Text style={styles.monthButtonLabel}>다음</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>DATA-BACKED TAB</Text>
          <Text style={styles.body}>
            현재 월 grid, compact filter, quick jump, month-only bucket을 shared selector와 dataset source 위에서 렌더링합니다.
          </Text>
        </View>

        {datasetRiskDisclosure ? (
          <InlineFeedbackNotice
            body={datasetRiskDisclosure.body}
            testID={datasetRiskDisclosure.testID}
            title={datasetRiskDisclosure.title}
          />
        ) : null}

        <View style={styles.sourceCard}>
          <Text style={styles.sourceLabel}>Active source</Text>
          <Text style={styles.sourceValue}>{source.sourceLabel}</Text>
        </View>

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
          <View style={styles.calendarHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Filters</Text>
            <Text style={styles.sectionMeta}>{formatFilterLabel(filterMode)}</Text>
          </View>

          <View style={styles.controlRow}>
            {([
              ['all', '전체'],
              ['releases', '발매'],
              ['upcoming', '예정'],
            ] as const).map(([mode, label]) => (
              <Pressable
                key={mode}
                testID={`calendar-filter-${mode}`}
                accessibilityHint="월간 캘린더 표시 범위를 바꿉니다."
                accessibilityLabel={`${label} 필터`}
                accessibilityRole="button"
                accessibilityState={{ selected: filterMode === mode }}
                onPress={() => handleFilterChange(mode)}
                style={({ pressed }) => [
                  styles.controlChip,
                  filterMode === mode ? styles.controlChipActive : null,
                  pressed ? styles.controlChipPressed : null,
                ]}
              >
                <Text
                  style={filterMode === mode ? styles.controlChipActiveLabel : styles.controlChipLabel}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>이번 달 발매</Text>
            <Text style={styles.summaryValue}>{filteredSnapshot.releaseCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>예정 컴백</Text>
            <Text style={styles.summaryValue}>{filteredSnapshot.upcomingCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>가장 가까운 일정</Text>
            <Text style={styles.summaryValueSmall}>
              {filteredSnapshot.nearestUpcoming?.displayGroup ?? '없음'}
            </Text>
            <Text style={styles.summaryMeta}>
              {filteredSnapshot.nearestUpcoming
                ? formatUpcomingLabel(filteredSnapshot.nearestUpcoming)
                : 'exact 일정 없음'}
            </Text>
          </View>
        </View>

        {monthGrid ? (
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

                    return <DayCell key={cell.isoDate} cell={cell} onPress={openDaySheet} />;
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
        <DateDetailSheet onClose={closeDaySheet} selectedDay={selectedDay} visible={isSheetOpen} />
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
