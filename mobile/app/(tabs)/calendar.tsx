import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  buildCalendarMonthGrid,
  resolveInitialCalendarSelection,
  resolveNextCalendarSelection,
} from '../../src/features/calendarGrid';
import { selectCalendarMonthSnapshot } from '../../src/selectors';
import {
  loadActiveMobileDataset,
  type ActiveMobileDataset,
} from '../../src/services/activeDataset';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  CalendarDayBadgeKind,
  CalendarMonthSnapshotModel,
  CalendarSelectedDayModel,
  ReleaseSummaryModel,
  UpcomingEventModel,
} from '../../src/types';

type CalendarScreenState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'ready' | 'empty';
      source: ActiveMobileDataset;
      snapshot: CalendarMonthSnapshotModel;
    };

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

function formatReleaseRowMeta(release: ReleaseSummaryModel): string {
  const kind = release.releaseKind ?? 'release';
  return `${release.releaseDate} · ${kind}`;
}

function formatSelectedDaySummary(selectedDay: CalendarSelectedDayModel): string {
  return `발매 ${selectedDay.releases.length} · 예정 ${selectedDay.exactUpcoming.length}`;
}

function getBadgePalette(
  theme: ReturnType<typeof useAppTheme>,
  kind: CalendarDayBadgeKind,
): { backgroundColor: string; color: string } {
  if (kind === 'release') {
    return {
      backgroundColor: theme.colors.status.title.bg,
      color: theme.colors.status.title.text,
    };
  }

  const token = theme.colors.status[kind];
  return {
    backgroundColor: token.bg,
    color: token.text,
  };
}

export default function CalendarTabScreen() {
  const theme = useAppTheme();
  const [reloadCount, setReloadCount] = useState(0);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [state, setState] = useState<CalendarScreenState>({ kind: 'loading' });
  const today = useMemo(() => new Date(), []);
  const activeMonth = useMemo(() => buildMonthKey(today), [today]);
  const todayIsoDate = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    void loadActiveMobileDataset()
      .then((source) => {
        if (cancelled) {
          return;
        }

        const snapshot = selectCalendarMonthSnapshot(source.dataset, activeMonth, todayIsoDate);
        const nextKind =
          snapshot.releaseCount === 0 && snapshot.upcomingCount === 0 ? 'empty' : 'ready';

        setState({
          kind: nextKind,
          source,
          snapshot,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Calendar dataset could not be loaded right now.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeMonth, reloadCount, todayIsoDate]);

  const snapshot = state.kind === 'ready' || state.kind === 'empty' ? state.snapshot : null;
  const source = state.kind === 'ready' || state.kind === 'empty' ? state.source : null;

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setSelectedDayIso((current) => {
      if (current && current.slice(0, 7) === snapshot.month) {
        return current;
      }

      return resolveInitialCalendarSelection(snapshot.month, todayIsoDate);
    });
  }, [snapshot, todayIsoDate]);

  const monthGrid = useMemo(() => {
    if (!snapshot || !selectedDayIso) {
      return null;
    }

    return buildCalendarMonthGrid(snapshot, selectedDayIso, todayIsoDate);
  }, [selectedDayIso, snapshot, todayIsoDate]);

  const selectedDay = monthGrid?.selectedDay ?? null;

  function openDaySheet(isoDate: string) {
    setSelectedDayIso((current) =>
      resolveNextCalendarSelection(current ?? isoDate, isoDate, snapshot?.month ?? isoDate.slice(0, 7)),
    );
    setIsSheetOpen(true);
  }

  function closeDaySheet() {
    setIsSheetOpen(false);
  }

  if (state.kind === 'loading') {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={theme.colors.text.brand} />
        <Text style={styles.eyebrow}>DATASET LOADING</Text>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.body}>현재 월 데이터와 예정 신호를 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.eyebrow}>LOAD ERROR</Text>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.body}>{state.message}</Text>
        <Pressable style={styles.retryButton} onPress={() => setReloadCount((count) => count + 1)}>
          <Text style={styles.retryButtonLabel}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (!snapshot || !source) {
    return null;
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DATA-BACKED TAB</Text>
          <Text style={styles.title}>{formatMonthLabel(snapshot.month)}</Text>
          <Text style={styles.body}>
            현재 월 grid, day badge, selected-day state를 shared selector와 dataset source 위에서 렌더링합니다.
          </Text>
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sourceLabel}>Active source</Text>
          <Text style={styles.sourceValue}>{source.sourceLabel}</Text>
          {source.issues.length ? (
            <Text style={styles.sourceIssue}>{source.issues.join(' / ')}</Text>
          ) : null}
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>이번 달 발매</Text>
            <Text style={styles.summaryValue}>{snapshot.releaseCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>예정 컴백</Text>
            <Text style={styles.summaryValue}>{snapshot.upcomingCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>가장 가까운 일정</Text>
            <Text style={styles.summaryValueSmall}>
              {snapshot.nearestUpcoming?.displayGroup ?? '없음'}
            </Text>
            <Text style={styles.summaryMeta}>
              {snapshot.nearestUpcoming
                ? formatUpcomingLabel(snapshot.nearestUpcoming)
                : 'exact 일정 없음'}
            </Text>
          </View>
        </View>

        {monthGrid ? (
          <View style={styles.sectionCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.sectionTitle}>Calendar grid</Text>
              <Text style={styles.sectionMeta}>
                {selectedDay ? selectedDay.label : formatMonthLabel(snapshot.month)}
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
                      <Pressable
                        key={cell.isoDate}
                        testID={`calendar-day-${cell.isoDate}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: cell.isSelected }}
                        onPress={() => openDaySheet(cell.isoDate)}
                        style={({ pressed }) => [
                          styles.dayCell,
                          cell.isToday ? styles.dayCellToday : null,
                          cell.isSelected ? styles.dayCellSelected : null,
                          pressed ? styles.dayCellPressed : null,
                        ]}
                      >
                        <View style={styles.dayCellHeader}>
                          <Text
                            style={[
                              styles.dayNumber,
                              cell.isSelected ? styles.dayNumberSelected : null,
                            ]}
                          >
                            {cell.dayNumber}
                          </Text>
                          {cell.releaseCount > 0 || cell.upcomingCount > 0 ? (
                            <Text style={styles.dayCounts}>
                              {cell.releaseCount}/{cell.upcomingCount}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.badgeStack}>
                          {cell.badges.map((badge) => {
                            const palette = getBadgePalette(theme, badge.kind);
                            return (
                              <View
                                key={badge.id}
                                style={[
                                  styles.badgePill,
                                  {
                                    backgroundColor: palette.backgroundColor,
                                  },
                                ]}
                              >
                                <Text style={[styles.badgeText, { color: palette.color }]}>
                                  {badge.monogram}
                                </Text>
                              </View>
                            );
                          })}
                          {cell.overflowCount > 0 ? (
                            <Text style={styles.overflowLabel}>+{cell.overflowCount}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {state.kind === 'empty' ? (
              <Text style={styles.body}>
                현재 dataset source에는 {formatMonthLabel(snapshot.month)} 기준 발매나 예정 컴백이 없습니다.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Month-only signals</Text>
          <Text style={styles.body}>
            month-only 예정 신호는 날짜 셀에 넣지 않고 월 컨텍스트 버킷으로 유지합니다.
          </Text>
          {snapshot.monthOnlyUpcoming.length ? (
            snapshot.monthOnlyUpcoming.map((event) => (
              <View key={event.id} style={styles.row}>
                <Text style={styles.rowTitle}>{event.displayGroup}</Text>
                <Text style={styles.rowBody}>{event.headline}</Text>
                <Text style={styles.rowMeta}>{formatUpcomingLabel(event)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.body}>현재 월에 month-only 예정 신호가 없습니다.</Text>
          )}
        </View>
      </ScrollView>

      {selectedDay ? (
        <Modal
          transparent
          animationType="slide"
          visible={isSheetOpen}
          onRequestClose={closeDaySheet}
        >
          <View style={styles.sheetOverlay}>
            <Pressable
              testID="calendar-sheet-backdrop"
              accessibilityRole="button"
              style={styles.sheetBackdrop}
              onPress={closeDaySheet}
            />
            <View
              testID="calendar-bottom-sheet"
              style={[
                styles.sheetPanel,
                selectedDay.isEmpty ? styles.sheetPanelEmpty : null,
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderCopy}>
                  <Text style={styles.sectionTitle}>{selectedDay.label}</Text>
                  <Text style={styles.sectionMeta}>{formatSelectedDaySummary(selectedDay)}</Text>
                </View>
                <Pressable
                  testID="calendar-sheet-close"
                  accessibilityRole="button"
                  onPress={closeDaySheet}
                  style={styles.sheetCloseButton}
                >
                  <Text style={styles.sheetCloseLabel}>닫기</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetContent}
                bounces={false}
              >
                {selectedDay.isEmpty ? (
                  <Text style={styles.body}>이 날짜에는 등록된 일정이 없습니다.</Text>
                ) : (
                  <>
                    {selectedDay.releases.length ? (
                      <View style={styles.subsection}>
                        <Text style={styles.subsectionTitle}>Verified releases</Text>
                        {selectedDay.releases.map((release) => (
                          <View key={release.id} style={styles.row}>
                            <Text style={styles.rowTitle}>{release.displayGroup}</Text>
                            <Text style={styles.rowBody}>{release.releaseTitle}</Text>
                            <Text style={styles.rowMeta}>{formatReleaseRowMeta(release)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {selectedDay.exactUpcoming.length ? (
                      <View style={styles.subsection}>
                        <Text style={styles.subsectionTitle}>Scheduled comebacks</Text>
                        {selectedDay.exactUpcoming.map((event) => (
                          <View key={event.id} style={styles.row}>
                            <Text style={styles.rowTitle}>{event.displayGroup}</Text>
                            <Text style={styles.rowBody}>{event.releaseLabel ?? event.headline}</Text>
                            <Text style={styles.rowMeta}>{formatUpcomingLabel(event)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    header: {
      gap: theme.space[8],
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
    dayCell: {
      flex: 1,
      minHeight: 88,
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      padding: theme.space[8],
      gap: theme.space[8],
    },
    dayCellPressed: {
      backgroundColor: theme.colors.surface.interactive,
    },
    dayCellToday: {
      borderColor: theme.colors.border.strong,
    },
    dayCellSelected: {
      borderColor: theme.colors.border.focus,
      backgroundColor: theme.colors.surface.interactive,
    },
    dayCellHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    dayNumber: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    dayNumberSelected: {
      color: theme.colors.text.brand,
    },
    dayCounts: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    badgeStack: {
      gap: theme.space[4],
      alignItems: 'flex-start',
    },
    badgePill: {
      minWidth: 32,
      borderRadius: theme.radius.chip,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
    },
    badgeText: {
      fontSize: theme.typography.chip.fontSize,
      lineHeight: theme.typography.chip.lineHeight,
      fontWeight: theme.typography.chip.fontWeight,
      letterSpacing: theme.typography.chip.letterSpacing,
      textAlign: 'center',
    },
    overflowLabel: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.surface.overlay,
    },
    sheetBackdrop: {
      flex: 1,
    },
    sheetPanel: {
      height: '78%',
      backgroundColor: theme.colors.surface.elevated,
      borderTopLeftRadius: theme.radius.sheet,
      borderTopRightRadius: theme.radius.sheet,
      paddingHorizontal: theme.space[20],
      paddingTop: theme.space[12],
      paddingBottom: theme.space[20],
      gap: theme.space[12],
    },
    sheetPanelEmpty: {
      height: '45%',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 56,
      height: 4,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.border.strong,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.space[12],
    },
    sheetHeaderCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    sheetCloseButton: {
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    sheetCloseLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    sheetScroll: {
      flex: 1,
    },
    sheetContent: {
      gap: theme.space[12],
      paddingBottom: theme.space[24],
    },
    subsection: {
      gap: theme.space[8],
    },
    subsectionTitle: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
      letterSpacing: theme.typography.meta.letterSpacing,
      textTransform: 'uppercase',
    },
    row: {
      gap: theme.space[4],
      paddingTop: theme.space[8],
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
