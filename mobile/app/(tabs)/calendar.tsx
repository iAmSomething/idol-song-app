import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../src/tokens/theme';
import { loadActiveMobileDataset, type ActiveMobileDataset } from '../../src/services/activeDataset';
import { selectCalendarMonthSnapshot } from '../../src/selectors';
import type { CalendarMonthSnapshotModel, ReleaseSummaryModel, UpcomingEventModel } from '../../src/types';

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

export default function CalendarTabScreen() {
  const theme = useAppTheme();
  const [reloadCount, setReloadCount] = useState(0);
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

  const { source, snapshot } = state;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DATA-BACKED TAB</Text>
        <Text style={styles.title}>{formatMonthLabel(snapshot.month)}</Text>
        <Text style={styles.body}>
          shared selector와 active dataset source를 통해 현재 월 요약을 먼저 여는 단계입니다.
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
            {snapshot.nearestUpcoming ? formatUpcomingLabel(snapshot.nearestUpcoming) : 'exact 일정 없음'}
          </Text>
        </View>
      </View>

      {state.kind === 'empty' ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>이번 달 일정 없음</Text>
          <Text style={styles.body}>
            현재 dataset source에는 {formatMonthLabel(snapshot.month)} 기준 발매나 예정 컴백이 없습니다.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Verified releases</Text>
            {snapshot.releases.slice(0, 4).map((release) => (
              <View key={release.id} style={styles.row}>
                <Text style={styles.rowTitle}>{release.displayGroup}</Text>
                <Text style={styles.rowBody}>{release.releaseTitle}</Text>
                <Text style={styles.rowMeta}>{formatReleaseRowMeta(release)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Exact-date upcoming</Text>
            {snapshot.exactUpcoming.length ? (
              snapshot.exactUpcoming.slice(0, 4).map((event) => (
                <View key={event.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{event.displayGroup}</Text>
                  <Text style={styles.rowBody}>{event.releaseLabel ?? event.headline}</Text>
                  <Text style={styles.rowMeta}>{formatUpcomingLabel(event)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.body}>현재 월에 exact-date 예정 신호가 없습니다.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Month-only signals</Text>
            {snapshot.monthOnlyUpcoming.length ? (
              snapshot.monthOnlyUpcoming.slice(0, 4).map((event) => (
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
        </>
      )}
    </ScrollView>
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
      gap: theme.space[4],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    sourceLabel: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
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
      gap: theme.space[4],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
    },
    summaryLabel: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    summaryValue: {
      color: theme.colors.text.primary,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '700',
    },
    summaryValueSmall: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: theme.typography.sectionTitle.fontWeight,
    },
    summaryMeta: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    sectionCard: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: theme.typography.sectionTitle.fontWeight,
    },
    row: {
      gap: theme.space[4],
      paddingTop: theme.space[12],
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
      borderRadius: theme.radius.button,
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
