import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton } from '../../src/components/actions/ActionButton';
import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
import { AppBar } from '../../src/components/layout/AppBar';
import { SummaryStrip } from '../../src/components/layout/SummaryStrip';
import { buildDatasetRiskDisclosure } from '../../src/features/surfaceDisclosures';
import {
  areRouteParamsEqual,
  buildRadarRouteParams,
  resolveRadarRouteState,
  type RadarFilterActType,
  type RadarFilterStatus,
  type RadarSectionKey,
} from '../../src/features/routeState';
import { useActiveDatasetScreen } from '../../src/features/useActiveDatasetScreen';
import { selectRadarSnapshot } from '../../src/selectors';
import { type ActiveMobileDataset } from '../../src/services/activeDataset';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  RadarChangeFeedItemModel,
  RadarLongGapItemModel,
  RadarRookieItemModel,
  RadarSnapshotModel,
  RadarUpcomingCardModel,
  TeamSummaryModel,
  UpcomingConfidence,
  UpcomingStatus,
} from '../../src/types';

const DEFAULT_ENABLED_SECTIONS: RadarSectionKey[] = ['weekly', 'change', 'longGap', 'rookie'];

function resolveBadgeLabel(team: TeamSummaryModel): string {
  return team.badge?.monogram ?? team.displayName.slice(0, 2).toUpperCase();
}

function resolveUpcomingStatusLabel(status?: UpcomingStatus): string {
  if (status === 'confirmed') {
    return '확정';
  }

  if (status === 'rumor') {
    return '루머';
  }

  return '예정';
}

function resolveConfidenceLabel(confidence?: UpcomingConfidence): string | null {
  if (confidence === 'high') {
    return '신뢰도 높음';
  }

  if (confidence === 'medium') {
    return '신뢰도 보통';
  }

  if (confidence === 'low') {
    return '신뢰도 낮음';
  }

  return null;
}

function formatUpcomingDateLabel(item: RadarUpcomingCardModel): string {
  if (item.upcoming.scheduledDate) {
    return item.upcoming.scheduledDate;
  }

  if (item.upcoming.scheduledMonth) {
    return `${item.upcoming.scheduledMonth} · 날짜 미정`;
  }

  return '날짜 미정';
}

function formatFeaturedBody(item: RadarUpcomingCardModel): string {
  return item.upcoming.releaseLabel ?? item.upcoming.headline;
}

function formatLongGapBody(item: RadarLongGapItemModel): string {
  if (!item.latestRelease) {
    return `${item.gapLabel} · 마지막 발매 메타데이터 미완료`;
  }

  return `${item.latestRelease.releaseTitle} · ${item.latestRelease.releaseDate}`;
}

function formatLongGapMeta(item: RadarLongGapItemModel): string {
  return `${item.gapLabel} · ${item.hasUpcomingSignal ? '예정 신호 있음' : '예정 신호 없음'}`;
}

function formatRookieBody(item: RadarRookieItemModel): string {
  if (!item.latestRelease) {
    return `데뷔 ${item.debutYear} · 최근 발매 메타데이터 미완료`;
  }

  return `${item.latestRelease.releaseTitle} · ${item.latestRelease.releaseDate}`;
}

function formatRookieMeta(item: RadarRookieItemModel): string {
  return `데뷔 ${item.debutYear} · ${item.hasUpcomingSignal ? '예정 신호 있음' : '예정 신호 없음'}`;
}

function buildUpcomingCardAccessibilityLabel(item: RadarUpcomingCardModel): string {
  return `${item.team.displayName} 팀 페이지, ${formatFeaturedBody(item)}, ${item.dayLabel}, ${formatUpcomingDateLabel(item)}, ${resolveUpcomingStatusLabel(item.upcoming.status)}`;
}

function buildChangeFeedAccessibilityLabel(item: RadarChangeFeedItemModel): string {
  return `${item.team.displayName} 팀 페이지, ${item.changeTypeLabel}, 이전 ${item.previousScheduleLabel}, 새 일정 ${item.nextScheduleLabel}`;
}

function buildLongGapAccessibilityLabel(item: RadarLongGapItemModel): string {
  return `${item.team.displayName} 팀 페이지, ${formatLongGapBody(item)}, ${formatLongGapMeta(item)}`;
}

function buildRookieAccessibilityLabel(item: RadarRookieItemModel): string {
  return `${item.team.displayName} 팀 페이지, ${formatRookieBody(item)}, ${formatRookieMeta(item)}`;
}

function buildRadarPartialSections(snapshot: RadarSnapshotModel): string[] {
  const sections = new Set<string>();

  if (snapshot.featuredUpcoming && !snapshot.featuredUpcoming.upcoming.releaseLabel) {
    sections.add('가장 가까운 컴백');
  }

  if (snapshot.weeklyUpcoming.some((item) => !item.upcoming.confidence)) {
    sections.add('이번 주 예정');
  }

  if (snapshot.changeFeed.some((item) => !item.sourceUrl)) {
    sections.add('일정 변경');
  }

  if (snapshot.longGap.some((item) => !item.latestRelease)) {
    sections.add('장기 공백 레이더');
  }

  if (snapshot.rookie.some((item) => !item.latestRelease)) {
    sections.add('루키 레이더');
  }

  return [...sections];
}

function resolveRadarDataState(
  source: ActiveMobileDataset,
  partialSections: string[],
): 'default' | 'partial' | 'degraded' {
  if (source.runtimeState.mode === 'degraded' || source.issues.length > 0) {
    return 'degraded';
  }

  if (partialSections.length > 0) {
    return 'partial';
  }

  return 'default';
}

function buildRadarPartialBody(partialSections: string[]): string {
  if (partialSections.length === 1) {
    return `${partialSections[0]} 섹션은 아직 일부 정보만 표시됩니다. 가능한 범위 안에서 최소 카드만 유지합니다.`;
  }

  return `${partialSections.join(', ')} 섹션은 아직 일부 정보만 표시됩니다. 가능한 범위 안에서 최소 카드만 유지합니다.`;
}

function matchesActType(team: TeamSummaryModel, actTypeFilter: RadarFilterActType): boolean {
  if (actTypeFilter === 'all') {
    return true;
  }

  return team.actType === actTypeFilter;
}

function matchesUpcomingStatus(
  item: RadarUpcomingCardModel,
  statusFilter: RadarFilterStatus,
): boolean {
  if (statusFilter === 'all') {
    return true;
  }

  if (statusFilter === 'changed') {
    return false;
  }

  return item.upcoming.status === statusFilter;
}

function filterUpcomingCards(
  items: RadarUpcomingCardModel[],
  statusFilter: RadarFilterStatus,
  actTypeFilter: RadarFilterActType,
): RadarUpcomingCardModel[] {
  return items.filter((item) => matchesActType(item.team, actTypeFilter) && matchesUpcomingStatus(item, statusFilter));
}

function filterChangeFeedItems(
  items: RadarChangeFeedItemModel[],
  statusFilter: RadarFilterStatus,
  actTypeFilter: RadarFilterActType,
): RadarChangeFeedItemModel[] {
  return items.filter((item) => {
    if (!matchesActType(item.team, actTypeFilter)) {
      return false;
    }

    return statusFilter === 'all' || statusFilter === 'changed';
  });
}

function filterTeamCards<T extends { team: TeamSummaryModel }>(
  items: T[],
  actTypeFilter: RadarFilterActType,
): T[] {
  return items.filter((item) => matchesActType(item.team, actTypeFilter));
}

function isSectionEnabled(enabledSections: RadarSectionKey[], section: RadarSectionKey): boolean {
  return enabledSections.includes(section);
}

async function openExternalUrl(url?: string): Promise<void> {
  if (!url) {
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    // Ignore source-open failures in v1; the primary path remains team detail.
  }
}

export default function RadarTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    actType?: string | string[];
    sections?: string | string[];
    status?: string | string[];
  }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [reloadCount, setReloadCount] = useState(0);
  const routeState = useMemo(() => resolveRadarRouteState(params), [params]);
  const [statusFilter, setStatusFilter] = useState(routeState.statusFilter);
  const [actTypeFilter, setActTypeFilter] = useState(routeState.actTypeFilter);
  const [enabledSections, setEnabledSections] = useState(routeState.enabledSections);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const datasetState = useActiveDatasetScreen({
    surface: 'radar',
    reloadKey: reloadCount,
    fallbackErrorMessage: 'Radar dataset could not be loaded right now.',
  });
  const today = useMemo(() => new Date(), []);
  const todayIsoDate = useMemo(() => today.toISOString().slice(0, 10), [today]);

  useEffect(() => {
    setStatusFilter(routeState.statusFilter);
    setActTypeFilter(routeState.actTypeFilter);
    setEnabledSections(routeState.enabledSections);
  }, [routeState]);

  const source = datasetState.kind === 'ready' ? datasetState.source : null;
  const snapshot = useMemo(
    () => (source ? selectRadarSnapshot(source.dataset, todayIsoDate) : null),
    [source, todayIsoDate],
  );
  const partialSections = useMemo(
    () => (snapshot ? buildRadarPartialSections(snapshot) : []),
    [snapshot],
  );
  const dataState = useMemo(
    () => (source ? resolveRadarDataState(source, partialSections) : 'default'),
    [partialSections, source],
  );
  const datasetRiskDisclosure =
    source ? buildDatasetRiskDisclosure(source, '레이더', 'radar-dataset-risk-notice') : null;

  useEffect(() => {
    const currentRouteParams = buildRadarRouteParams({
      statusFilter: routeState.statusFilter,
      actTypeFilter: routeState.actTypeFilter,
      enabledSections: routeState.enabledSections,
    });
    const nextRouteParams = buildRadarRouteParams({
      statusFilter,
      actTypeFilter,
      enabledSections,
    });

    if (areRouteParamsEqual(currentRouteParams, nextRouteParams)) {
      return;
    }

    router.setParams(nextRouteParams);
  }, [actTypeFilter, enabledSections, routeState, router, statusFilter]);

  function openSearchTab() {
    router.push('/(tabs)/search');
  }

  function openTeamDetail(slug: string) {
    router.push({
      pathname: '/artists/[slug]',
      params: { slug },
    });
  }

  function toggleSection(section: RadarSectionKey) {
    setEnabledSections((current) =>
      current.includes(section)
        ? current.filter((value) => value !== section)
        : [...current, section],
    );
  }

  function resetFilters() {
    setStatusFilter('all');
    setActTypeFilter('all');
    setEnabledSections(DEFAULT_ENABLED_SECTIONS);
  }

  if (datasetState.kind === 'loading') {
    return (
      <ScreenFeedbackState
        body="가장 가까운 컴백과 레이더 요약을 불러오는 중입니다."
        eyebrow="DATA-BACKED TAB"
        title="레이더"
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
          testID: 'radar-error-retry',
        }}
        body={datasetState.message}
        eyebrow="LOAD ERROR"
        title="레이더"
        variant="error"
      />
    );
  }

  if (!snapshot || !source) {
    return (
      <ScreenFeedbackState
        body="레이더 스냅샷을 찾지 못했습니다."
        eyebrow="EMPTY SNAPSHOT"
        title="레이더"
        variant="empty"
      />
    );
  }

  const filteredFutureUpcoming = filterUpcomingCards(snapshot.futureUpcoming, statusFilter, actTypeFilter);
  const filteredWeeklyUpcoming = filterUpcomingCards(snapshot.weeklyUpcoming, statusFilter, actTypeFilter);
  const filteredChangeFeed = filterChangeFeedItems(snapshot.changeFeed, statusFilter, actTypeFilter);
  const filteredLongGap = filterTeamCards(snapshot.longGap, actTypeFilter);
  const filteredRookie = filterTeamCards(snapshot.rookie, actTypeFilter);
  const featuredUpcoming = filteredFutureUpcoming[0] ?? null;
  const hasNonDefaultFilters =
    statusFilter !== 'all' ||
    actTypeFilter !== 'all' ||
    enabledSections.length !== DEFAULT_ENABLED_SECTIONS.length ||
    DEFAULT_ENABLED_SECTIONS.some((section) => !enabledSections.includes(section));

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <AppBar subtitle={source.sourceLabel} testID="radar-app-bar" title="레이더" />
        <View style={styles.appBarActions}>
          <Pressable
            testID="radar-search-button"
            accessibilityLabel="검색 탭으로 이동"
            accessibilityRole="button"
            onPress={openSearchTab}
            style={({ pressed }) => [styles.appBarButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.appBarButtonLabel}>검색</Text>
          </Pressable>
          <Pressable
            testID="radar-filter-button"
            accessibilityLabel="레이더 필터 열기"
            accessibilityRole="button"
            accessibilityState={{ selected: hasNonDefaultFilters || isFilterSheetOpen }}
            onPress={() => setIsFilterSheetOpen(true)}
            style={({ pressed }) => [styles.appBarButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.appBarButtonLabel}>필터</Text>
          </Pressable>
        </View>

        {dataState === 'degraded' && datasetRiskDisclosure ? (
          <InlineFeedbackNotice
            action={{
              label: '다시 시도',
              onPress: () => setReloadCount((count) => count + 1),
              testID: 'radar-degraded-retry',
            }}
            body={datasetRiskDisclosure.body}
            testID={datasetRiskDisclosure.testID}
            title={datasetRiskDisclosure.title}
          />
        ) : null}

        {partialSections.length > 0 ? (
          <InlineFeedbackNotice
            body={buildRadarPartialBody(partialSections)}
            testID="radar-partial-notice"
            title="일부 정보만 표시됩니다."
          />
        ) : null}

        <SummaryStrip
          items={[
            { key: 'weekly', label: '이번 주 예정', value: filteredWeeklyUpcoming.length },
            { key: 'change', label: '일정 변경', value: filteredChangeFeed.length },
            { key: 'long-gap', label: '장기 공백', value: filteredLongGap.length },
          ]}
          testID="radar-summary-strip"
        />

        <RadarFeaturedSection
          item={featuredUpcoming}
          onOpenSource={openExternalUrl}
          onPressTeam={openTeamDetail}
          styles={styles}
        />

        {isSectionEnabled(enabledSections, 'weekly') ? (
          <RadarSection title="이번 주 예정" styles={styles}>
            {filteredWeeklyUpcoming.length === 0 ? <InlineFeedbackNotice body="이번 주 예정이 없습니다." /> : null}
            {filteredWeeklyUpcoming.map((item) => (
              <RadarUpcomingSectionCard
                key={item.id}
                item={item}
                onOpenSource={openExternalUrl}
                onPressTeam={openTeamDetail}
                styles={styles}
                testID={`radar-weekly-card-${item.team.slug}`}
              />
            ))}
          </RadarSection>
        ) : null}

        {isSectionEnabled(enabledSections, 'change') ? (
          <RadarSection title="일정 변경" styles={styles}>
            {filteredChangeFeed.length === 0 ? <InlineFeedbackNotice body="감지된 일정 변경이 없습니다." /> : null}
            {filteredChangeFeed.map((item) => (
              <RadarChangeFeedCard
                key={item.id}
                item={item}
                onOpenSource={openExternalUrl}
                onPressTeam={openTeamDetail}
                styles={styles}
              />
            ))}
          </RadarSection>
        ) : null}

        {isSectionEnabled(enabledSections, 'longGap') ? (
          <RadarSection title="장기 공백 레이더" styles={styles}>
            {filteredLongGap.length === 0 ? <InlineFeedbackNotice body="현재 장기 공백 대상이 없습니다." /> : null}
            {filteredLongGap.map((item) => (
              <RadarLongGapCard
                key={item.id}
                item={item}
                onPressTeam={openTeamDetail}
                styles={styles}
              />
            ))}
          </RadarSection>
        ) : null}

        {isSectionEnabled(enabledSections, 'rookie') ? (
          <RadarSection title="루키 레이더" styles={styles}>
            {filteredRookie.length === 0 ? <InlineFeedbackNotice body="현재 루키 대상이 없습니다." /> : null}
            {filteredRookie.map((item) => (
              <RadarRookieCard
                key={item.id}
                item={item}
                onPressTeam={openTeamDetail}
                styles={styles}
              />
            ))}
          </RadarSection>
        ) : null}
      </ScrollView>

      <RadarFilterSheet
        actTypeFilter={actTypeFilter}
        enabledSections={enabledSections}
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onReset={resetFilters}
        onSelectActType={setActTypeFilter}
        onSelectStatus={setStatusFilter}
        onToggleSection={toggleSection}
        statusFilter={statusFilter}
        styles={styles}
      />
    </>
  );
}

function RadarFeaturedSection({
  item,
  onOpenSource,
  onPressTeam,
  styles,
}: {
  item: RadarUpcomingCardModel | null;
  onOpenSource: (url?: string) => void;
  onPressTeam: (slug: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>가장 가까운 컴백</Text>
      </View>
      {item ? (
        <View
          accessibilityLabel={buildUpcomingCardAccessibilityLabel(item)}
          style={styles.featuredCard}
          testID="radar-featured-card"
        >
          <Text style={styles.featuredEyebrow}>{item.dayLabel}</Text>
          <Text style={styles.featuredTitle}>{item.team.displayName}</Text>
          <Text style={styles.featuredBody}>{formatFeaturedBody(item)}</Text>
          <View style={styles.chipRow}>
            <StatusChip label={resolveUpcomingStatusLabel(item.upcoming.status)} styles={styles} />
            {resolveConfidenceLabel(item.upcoming.confidence) ? (
              <StatusChip label={resolveConfidenceLabel(item.upcoming.confidence)!} styles={styles} />
            ) : null}
          </View>
          <Text style={styles.featuredMeta}>{formatUpcomingDateLabel(item)}</Text>
          <RadarActionRow
            onOpenSource={() => onOpenSource(item.sourceUrl)}
            onPressPrimary={() => onPressTeam(item.team.slug)}
            primaryLabel="팀 페이지"
            sourceLabel={item.sourceLabel}
            sourceUrl={item.sourceUrl}
            styles={styles}
          />
        </View>
      ) : (
        <InlineFeedbackNotice body="가까운 컴백 일정이 없습니다." />
      )}
    </View>
  );
}

function RadarSection({
  children,
  styles,
  title,
}: {
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  title: string;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function RadarUpcomingSectionCard({
  item,
  onOpenSource,
  onPressTeam,
  styles,
  testID,
}: {
  item: RadarUpcomingCardModel;
  onOpenSource: (url?: string) => void;
  onPressTeam: (slug: string) => void;
  styles: ReturnType<typeof createStyles>;
  testID: string;
}) {
  return (
    <View
      accessibilityLabel={buildUpcomingCardAccessibilityLabel(item)}
      style={styles.card}
      testID={testID}
    >
      <View style={styles.cardBadge}>
        <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{item.team.displayName}</Text>
        <Text style={styles.cardBody}>{formatFeaturedBody(item)}</Text>
        <View style={styles.chipRow}>
          <StatusChip label={resolveUpcomingStatusLabel(item.upcoming.status)} styles={styles} />
          {resolveConfidenceLabel(item.upcoming.confidence) ? (
            <StatusChip label={resolveConfidenceLabel(item.upcoming.confidence)!} styles={styles} />
          ) : null}
        </View>
        <Text style={styles.cardMeta}>
          {item.dayLabel} · {formatUpcomingDateLabel(item)}
        </Text>
        <RadarActionRow
          onOpenSource={() => onOpenSource(item.sourceUrl)}
          onPressPrimary={() => onPressTeam(item.team.slug)}
          primaryLabel="팀 페이지"
          sourceLabel={item.sourceLabel}
          sourceUrl={item.sourceUrl}
          styles={styles}
        />
      </View>
    </View>
  );
}

function RadarChangeFeedCard({
  item,
  onOpenSource,
  onPressTeam,
  styles,
}: {
  item: RadarChangeFeedItemModel;
  onOpenSource: (url?: string) => void;
  onPressTeam: (slug: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View
      accessibilityLabel={buildChangeFeedAccessibilityLabel(item)}
      style={[styles.card, styles.changeCard]}
      testID={`radar-change-card-${item.team.slug}`}
    >
      <View style={styles.cardBadge}>
        <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{item.team.displayName}</Text>
        <Text style={styles.cardBody}>{item.releaseLabel ?? item.headline ?? item.changeTypeLabel}</Text>
        <View style={styles.chipRow}>
          <StatusChip label={item.changeTypeLabel} styles={styles} tone="title" />
        </View>
        <Text style={styles.cardMeta}>이전 일정 · {item.previousScheduleLabel}</Text>
        <Text style={styles.cardMetaStrong}>새 일정 · {item.nextScheduleLabel}</Text>
        <RadarActionRow
          onOpenSource={() => onOpenSource(item.sourceUrl)}
          onPressPrimary={() => onPressTeam(item.team.slug)}
          primaryLabel="팀 페이지"
          sourceLabel={item.sourceLabel}
          sourceUrl={item.sourceUrl}
          styles={styles}
        />
      </View>
    </View>
  );
}

function RadarLongGapCard({
  item,
  onPressTeam,
  styles,
}: {
  item: RadarLongGapItemModel;
  onPressTeam: (slug: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View
      accessibilityLabel={buildLongGapAccessibilityLabel(item)}
      style={styles.card}
      testID={`radar-long-gap-card-${item.team.slug}`}
    >
      <View style={styles.cardBadge}>
        <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{item.team.displayName}</Text>
        <Text style={styles.cardBody}>{formatLongGapBody(item)}</Text>
        <Text style={styles.cardMeta}>{formatLongGapMeta(item)}</Text>
        <RadarActionRow
          onPressPrimary={() => onPressTeam(item.team.slug)}
          primaryLabel="팀 페이지"
          styles={styles}
        />
      </View>
    </View>
  );
}

function RadarRookieCard({
  item,
  onPressTeam,
  styles,
}: {
  item: RadarRookieItemModel;
  onPressTeam: (slug: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View
      accessibilityLabel={buildRookieAccessibilityLabel(item)}
      style={styles.card}
      testID={`radar-rookie-card-${item.team.slug}`}
    >
      <View style={styles.cardBadge}>
        <Text style={styles.cardBadgeLabel}>{resolveBadgeLabel(item.team)}</Text>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{item.team.displayName}</Text>
        <Text style={styles.cardBody}>{formatRookieBody(item)}</Text>
        <Text style={styles.cardMeta}>{formatRookieMeta(item)}</Text>
        <RadarActionRow
          onPressPrimary={() => onPressTeam(item.team.slug)}
          primaryLabel="팀 페이지"
          styles={styles}
        />
      </View>
    </View>
  );
}

function RadarActionRow({
  onOpenSource,
  onPressPrimary,
  primaryLabel,
  sourceLabel,
  sourceUrl,
  styles,
}: {
  onOpenSource?: () => void;
  onPressPrimary: () => void;
  primaryLabel: string;
  sourceLabel?: string;
  sourceUrl?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.actionRow}>
      <ActionButton
        accessibilityLabel={primaryLabel}
        label={primaryLabel}
        onPress={onPressPrimary}
      />
      {sourceUrl && sourceLabel && onOpenSource ? (
        <ActionButton
          accessibilityLabel={sourceLabel}
          label={sourceLabel}
          onPress={onOpenSource}
          tone="meta"
        />
      ) : null}
    </View>
  );
}

function RadarFilterSheet({
  actTypeFilter,
  enabledSections,
  isOpen,
  onClose,
  onReset,
  onSelectActType,
  onSelectStatus,
  onToggleSection,
  statusFilter,
  styles,
}: {
  actTypeFilter: RadarFilterActType;
  enabledSections: RadarSectionKey[];
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  onSelectActType: (value: RadarFilterActType) => void;
  onSelectStatus: (value: RadarFilterStatus) => void;
  onToggleSection: (value: RadarSectionKey) => void;
  statusFilter: RadarFilterStatus;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      testID="radar-filter-sheet"
      transparent
      visible={isOpen}
    >
      <View style={styles.filterOverlay}>
        <Pressable style={styles.filterBackdrop} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>레이더 필터</Text>
          </View>
          <Text style={styles.filterHelper}>
            레이더 의미를 바꾸지 않는 범위에서만 상태와 act type, 섹션 표시를 조정합니다.
          </Text>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>상태</Text>
            <View style={styles.filterChipRow}>
              {(['all', 'scheduled', 'confirmed', 'changed'] as RadarFilterStatus[]).map((option) => (
                <FilterChip
                  key={option}
                  active={statusFilter === option}
                  label={
                    option === 'all'
                      ? '전체'
                      : option === 'scheduled'
                        ? '예정'
                        : option === 'confirmed'
                          ? '확정'
                          : '변경'
                  }
                  onPress={() => onSelectStatus(option)}
                  styles={styles}
                  testID={`radar-filter-status-${option}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>act type</Text>
            <View style={styles.filterChipRow}>
              {(['all', 'group', 'solo', 'unit'] as RadarFilterActType[]).map((option) => (
                <FilterChip
                  key={option}
                  active={actTypeFilter === option}
                  label={
                    option === 'all'
                      ? '전체'
                      : option === 'group'
                        ? '그룹'
                        : option === 'solo'
                          ? '솔로'
                          : '유닛'
                  }
                  onPress={() => onSelectActType(option)}
                  styles={styles}
                  testID={`radar-filter-act-${option}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>섹션 표시</Text>
            <View style={styles.filterChipRow}>
              {([
                ['weekly', '이번 주 예정'],
                ['change', '일정 변경'],
                ['longGap', '장기 공백'],
                ['rookie', '루키'],
              ] as [RadarSectionKey, string][]).map(([section, label]) => (
                <FilterChip
                  key={section}
                  active={enabledSections.includes(section)}
                  label={label}
                  onPress={() => onToggleSection(section)}
                  styles={styles}
                  testID={`radar-filter-section-${section}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.actionRow}>
            <ActionButton
              label="초기화"
              onPress={onReset}
              testID="radar-filter-reset"
              tone="secondary"
            />
            <ActionButton
              label="닫기"
              onPress={onClose}
              testID="radar-filter-close"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterChip({
  active,
  label,
  onPress,
  styles,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active ? styles.filterChipActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
      testID={testID}
    >
      <Text style={active ? styles.filterChipLabelActive : styles.filterChipLabel}>{label}</Text>
    </Pressable>
  );
}

function StatusChip({
  label,
  styles,
  tone = 'default',
}: {
  label: string;
  styles: ReturnType<typeof createStyles>;
  tone?: 'default' | 'title';
}) {
  return (
    <View style={[styles.statusChip, tone === 'title' ? styles.statusChipTitle : null]}>
      <Text style={[styles.statusChipLabel, tone === 'title' ? styles.statusChipLabelTitle : null]}>
        {label}
      </Text>
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
      minHeight: 44,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      justifyContent: 'center',
    },
    appBarButtonLabel: {
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
    changeCard: {
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.status.title.text,
      paddingLeft: theme.space[8],
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
      gap: theme.space[8],
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
    cardMetaStrong: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    statusChip: {
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.interactive,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[4],
    },
    statusChipTitle: {
      backgroundColor: theme.colors.status.title.bg,
    },
    statusChipLabel: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    statusChipLabelTitle: {
      color: theme.colors.status.title.text,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.space[12],
      marginTop: theme.space[4],
    },
    primaryActionButton: {
      minHeight: 44,
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.text.brand,
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      justifyContent: 'center',
    },
    primaryActionLabel: {
      color: theme.colors.surface.base,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    secondaryActionButton: {
      minHeight: 44,
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      justifyContent: 'center',
    },
    secondaryActionLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    metaActionButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: theme.space[8],
    },
    metaActionLabel: {
      color: theme.colors.text.brand,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    filterOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.surface.overlay,
    },
    filterBackdrop: {
      flex: 1,
    },
    filterSheet: {
      borderTopLeftRadius: theme.radius.card,
      borderTopRightRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      paddingHorizontal: theme.space[24],
      paddingTop: theme.space[20],
      paddingBottom: theme.space[32],
      gap: theme.space[16],
    },
    filterHelper: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    filterGroup: {
      gap: theme.space[8],
    },
    filterGroupTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    filterChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    filterChip: {
      minHeight: 40,
      borderRadius: theme.radius.chip,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      justifyContent: 'center',
    },
    filterChipActive: {
      backgroundColor: theme.colors.text.brand,
      borderColor: theme.colors.text.brand,
    },
    filterChipLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    filterChipLabelActive: {
      color: theme.colors.surface.base,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    buttonPressed: {
      opacity: 0.84,
    },
  });
}
