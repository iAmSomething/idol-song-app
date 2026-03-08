import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { selectRadarSnapshot } from '../../src/selectors';
import {
  loadActiveMobileDataset,
  type ActiveMobileDataset,
} from '../../src/services/activeDataset';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  RadarLongGapItemModel,
  RadarRookieItemModel,
  RadarSnapshotModel,
  RadarUpcomingCardModel,
  TeamSummaryModel,
} from '../../src/types';

type RadarScreenState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; source: ActiveMobileDataset; snapshot: RadarSnapshotModel };

function formatUpcomingMeta(card: RadarUpcomingCardModel): string {
  const status = card.upcoming.status ?? '예정';
  const confidence = card.upcoming.confidence ? ` · ${card.upcoming.confidence}` : '';
  const scheduledLabel = card.upcoming.scheduledDate ?? card.upcoming.scheduledMonth ?? '날짜 미정';
  return `${scheduledLabel} · ${status}${confidence}`;
}

function formatLongGapMeta(item: RadarLongGapItemModel): string {
  const releaseLabel = item.latestRelease
    ? `${item.latestRelease.releaseTitle} · ${item.latestRelease.releaseDate}`
    : '마지막 발매 정보 없음';
  const upcomingLabel = item.hasUpcomingSignal ? '예정 신호 있음' : '예정 신호 없음';
  return `${releaseLabel} · ${item.gapLabel} · ${upcomingLabel}`;
}

function formatRookieMeta(item: RadarRookieItemModel): string {
  const releaseLabel = item.latestRelease
    ? `${item.latestRelease.releaseTitle} · ${item.latestRelease.releaseDate}`
    : '최근 발매 정보 없음';
  const upcomingLabel = item.hasUpcomingSignal ? '예정 신호 있음' : '예정 신호 없음';
  return `데뷔 ${item.debutYear} · ${releaseLabel} · ${upcomingLabel}`;
}

function resolveBadgeLabel(team: TeamSummaryModel): string {
  return team.badge?.monogram ?? team.displayName.slice(0, 2).toUpperCase();
}

export default function RadarTabScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [reloadCount, setReloadCount] = useState(0);
  const [hideEmptySections, setHideEmptySections] = useState(false);
  const [state, setState] = useState<RadarScreenState>({ kind: 'loading' });
  const today = useMemo(() => new Date(), []);
  const todayIsoDate = useMemo(() => today.toISOString().slice(0, 10), [today]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    void loadActiveMobileDataset()
      .then((source) => {
        if (cancelled) {
          return;
        }

        setState({
          kind: 'ready',
          source,
          snapshot: selectRadarSnapshot(source.dataset, todayIsoDate),
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
              : 'Radar dataset could not be loaded right now.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount, todayIsoDate]);

  function openSearchTab() {
    router.push('/(tabs)/search');
  }

  function openTeamDetail(slug: string) {
    router.push({
      pathname: '/artists/[slug]',
      params: { slug },
    });
  }

  if (state.kind === 'loading') {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={theme.colors.text.brand} />
        <Text style={styles.eyebrow}>DATA-BACKED TAB</Text>
        <Text style={styles.title}>레이더</Text>
        <Text style={styles.body}>가장 가까운 컴백과 레이더 요약을 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.eyebrow}>LOAD ERROR</Text>
        <Text style={styles.title}>레이더</Text>
        <Text style={styles.body}>{state.message}</Text>
        <Pressable style={styles.retryButton} onPress={() => setReloadCount((count) => count + 1)}>
          <Text style={styles.retryButtonLabel}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const { snapshot, source } = state;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.appBar}>
        <View style={styles.appBarCopy}>
          <Text style={styles.eyebrow}>DATA-BACKED TAB</Text>
          <Text style={styles.title}>레이더</Text>
          <Text style={styles.body}>{source.sourceLabel}</Text>
        </View>
        <View style={styles.appBarActions}>
          <Pressable
            testID="radar-search-button"
            accessibilityRole="button"
            onPress={openSearchTab}
            style={({ pressed }) => [styles.appBarButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.appBarButtonLabel}>검색</Text>
          </Pressable>
          <Pressable
            testID="radar-filter-button"
            accessibilityRole="button"
            onPress={() => setHideEmptySections((value) => !value)}
            style={({ pressed }) => [
              styles.appBarButton,
              hideEmptySections ? styles.appBarButtonActive : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={hideEmptySections ? styles.appBarButtonLabelActive : styles.appBarButtonLabel}>
              빈 섹션 숨김
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryStrip}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{snapshot.weeklyUpcoming.length}</Text>
          <Text style={styles.summaryLabel}>이번 주 예정</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{snapshot.changeFeed.length}</Text>
          <Text style={styles.summaryLabel}>일정 변경</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{snapshot.longGap.length + snapshot.rookie.length}</Text>
          <Text style={styles.summaryLabel}>장기 공백 · 루키</Text>
        </View>
      </View>

      <RadarFeaturedSection
        styles={styles}
        item={snapshot.featuredUpcoming}
        onPressTeam={openTeamDetail}
      />

      <RadarSection
        title="이번 주 예정"
        emptyCopy="이번 주 예정이 없습니다."
        styles={styles}
        hideWhenEmpty={hideEmptySections}
        items={snapshot.weeklyUpcoming}
        renderItem={(item) => (
          <Pressable
            key={item.id}
            testID={`radar-weekly-card-${item.team.slug}`}
            accessibilityRole="button"
            onPress={() => openTeamDetail(item.team.slug)}
            style={({ pressed }) => [styles.card, pressed ? styles.buttonPressed : null]}
          >
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.team.displayName}</Text>
              <Text style={styles.cardBody}>{item.upcoming.releaseLabel ?? item.upcoming.headline}</Text>
              <Text style={styles.cardMeta}>
                {item.dayLabel} · {formatUpcomingMeta(item)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <RadarSection
        title="일정 변경"
        emptyCopy="감지된 일정 변경이 없습니다."
        styles={styles}
        hideWhenEmpty={hideEmptySections}
        items={snapshot.changeFeed}
        renderItem={(item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.label}</Text>
          </View>
        )}
      />

      <RadarSection
        title="장기 공백 레이더"
        emptyCopy="현재 장기 공백 대상이 없습니다."
        styles={styles}
        hideWhenEmpty={hideEmptySections}
        items={snapshot.longGap}
        renderItem={(item) => (
          <Pressable
            key={item.id}
            testID={`radar-long-gap-card-${item.team.slug}`}
            accessibilityRole="button"
            onPress={() => openTeamDetail(item.team.slug)}
            style={({ pressed }) => [styles.card, pressed ? styles.buttonPressed : null]}
          >
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.team.displayName}</Text>
              <Text style={styles.cardMeta}>{formatLongGapMeta(item)}</Text>
            </View>
          </Pressable>
        )}
      />

      <RadarSection
        title="루키 레이더"
        emptyCopy="현재 루키 대상이 없습니다."
        styles={styles}
        hideWhenEmpty={hideEmptySections}
        items={snapshot.rookie}
        renderItem={(item) => (
          <Pressable
            key={item.id}
            testID={`radar-rookie-card-${item.team.slug}`}
            accessibilityRole="button"
            onPress={() => openTeamDetail(item.team.slug)}
            style={({ pressed }) => [styles.card, pressed ? styles.buttonPressed : null]}
          >
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.team.displayName}</Text>
              <Text style={styles.cardMeta}>{formatRookieMeta(item)}</Text>
            </View>
          </Pressable>
        )}
      />
    </ScrollView>
  );
}

function RadarFeaturedSection({
  item,
  onPressTeam,
  styles,
}: {
  item: RadarUpcomingCardModel | null;
  onPressTeam: (slug: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>가장 가까운 컴백</Text>
      </View>
      {item ? (
        <Pressable
          testID="radar-featured-card"
          accessibilityRole="button"
          onPress={() => onPressTeam(item.team.slug)}
          style={({ pressed }) => [styles.featuredCard, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.featuredEyebrow}>{item.dayLabel}</Text>
          <Text style={styles.featuredTitle}>{item.team.displayName}</Text>
          <Text style={styles.featuredBody}>{item.upcoming.releaseLabel ?? item.upcoming.headline}</Text>
          <Text style={styles.featuredMeta}>{formatUpcomingMeta(item)}</Text>
        </Pressable>
      ) : (
        <Text style={styles.emptyCopy}>가까운 컴백 일정이 없습니다.</Text>
      )}
    </View>
  );
}

function RadarSection<T>({
  emptyCopy,
  hideWhenEmpty,
  items,
  renderItem,
  styles,
  title,
}: {
  emptyCopy: string;
  hideWhenEmpty: boolean;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  title: string;
}) {
  if (hideWhenEmpty && items.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {items.length === 0 ? <Text style={styles.emptyCopy}>{emptyCopy}</Text> : null}
      {items.map(renderItem)}
    </View>
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
      gap: theme.space[12],
    },
    appBarCopy: {
      gap: theme.space[8],
    },
    appBarActions: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    appBarButton: {
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.elevated,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
    },
    appBarButtonActive: {
      backgroundColor: theme.colors.text.brand,
      borderColor: theme.colors.text.brand,
    },
    appBarButtonLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    appBarButtonLabelActive: {
      color: theme.colors.surface.base,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
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
    summaryStrip: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    summaryCard: {
      flex: 1,
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.elevated,
      padding: theme.space[12],
      gap: theme.space[4],
    },
    summaryValue: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    summaryLabel: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    sectionCard: {
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
      padding: theme.space[16],
      gap: theme.space[12],
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.space[8],
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: theme.typography.sectionTitle.fontWeight,
    },
    featuredCard: {
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.status.title.bg,
      padding: theme.space[16],
      gap: theme.space[8],
    },
    featuredEyebrow: {
      color: theme.colors.status.title.text,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    featuredTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.screenTitle.fontSize,
      lineHeight: theme.typography.screenTitle.lineHeight,
      fontWeight: theme.typography.screenTitle.fontWeight,
    },
    featuredBody: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    featuredMeta: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    card: {
      flexDirection: 'row',
      gap: theme.space[12],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.subtle,
      paddingTop: theme.space[12],
    },
    cardBadge: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBadgeLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    cardCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    cardTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    cardBody: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    cardMeta: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    emptyCopy: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    retryButton: {
      alignSelf: 'flex-start',
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.text.brand,
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
    },
    retryButtonLabel: {
      color: theme.colors.surface.base,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    buttonPressed: {
      opacity: 0.84,
    },
  });
}
