import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton } from '../../src/components/actions/ActionButton';
import { SegmentedControl } from '../../src/components/controls/SegmentedControl';
import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
import { TeamIdentityRow } from '../../src/components/identity/TeamIdentityRow';
import { AppBar } from '../../src/components/layout/AppBar';
import { buildDatasetRiskDisclosure } from '../../src/features/surfaceDisclosures';
import {
  areRouteParamsEqual,
  buildSearchRouteParams,
  resolveSearchRouteState,
  type SearchSegment,
} from '../../src/features/routeState';
import { useActiveDatasetScreen } from '../../src/features/useActiveDatasetScreen';
import {
  createSelectorContext,
  selectSearchResults,
  selectTeamSummaryBySlug,
} from '../../src/selectors';
import {
  trackAnalyticsEvent,
  type SearchSubmitSource,
} from '../../src/services/analytics';
import { clearRecentQueries, persistRecentQuery, readRecentQueries } from '../../src/services/recentQueries';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  ReleaseSummaryModel,
  SearchTeamResultModel,
  SearchUpcomingResultModel,
  TeamSummaryModel,
} from '../../src/types';

function formatReleaseMeta(release: ReleaseSummaryModel): string {
  const releaseKind = release.releaseKind ?? 'release';
  return `${release.releaseDate} · ${releaseKind}`;
}

function formatUpcomingMeta(result: SearchUpcomingResultModel): string {
  const event = result.upcoming;
  const dateLabel = event.scheduledDate
    ? event.scheduledDate
    : event.scheduledMonth
      ? `${event.scheduledMonth} · 날짜 미정`
      : '날짜 미정';

  return [dateLabel, event.status ?? '예정', event.sourceType].join(' · ');
}

function formatTeamMeta(result: SearchTeamResultModel): string {
  if (result.latestRelease) {
    return `최근 발매 · ${result.latestRelease.releaseTitle}`;
  }

  return result.team.agency ?? '최근 발매 정보 없음';
}

function formatSuggestedLabel(team: TeamSummaryModel): string {
  return team.badge?.monogram ?? team.displayName.slice(0, 2).toUpperCase();
}

function buildTeamResultAccessibilityLabel(result: SearchTeamResultModel): string {
  return `${result.team.displayName} 팀 열기, ${formatTeamMeta(result)}, ${result.matchKind}`;
}

function buildReleaseResultAccessibilityLabel(release: ReleaseSummaryModel, matchKind: string): string {
  return `${release.releaseTitle} 릴리즈 상세 열기, ${release.displayGroup}, ${formatReleaseMeta(release)}, ${matchKind}`;
}

function buildUpcomingResultAccessibilityLabel(result: SearchUpcomingResultModel): string {
  return `${result.upcoming.displayGroup} 예정 정보 열기, ${result.upcoming.releaseLabel ?? result.upcoming.headline}, ${formatUpcomingMeta(result)}, ${result.matchKind}`;
}

export default function SearchTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string | string[];
    segment?: string | string[];
  }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const routeState = useMemo(() => resolveSearchRouteState(params), [params]);

  const [reloadCount, setReloadCount] = useState(0);
  const datasetState = useActiveDatasetScreen({
    surface: 'search',
    reloadKey: reloadCount,
    fallbackErrorMessage: 'Search dataset could not be loaded right now.',
  });
  const [query, setQuery] = useState(routeState.query);
  const [activeSegment, setActiveSegment] = useState<SearchSegment>(routeState.activeSegment);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery(routeState.query);
    setActiveSegment(routeState.activeSegment);
  }, [routeState.activeSegment, routeState.query]);

  useEffect(() => {
    let cancelled = false;

    void readRecentQueries().then((history) => {
      if (cancelled) {
        return;
      }

      setRecentQueries(history);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const selectorContext = useMemo(() => {
    if (datasetState.kind !== 'ready') {
      return null;
    }

    return createSelectorContext(datasetState.source.dataset);
  }, [datasetState]);
  const datasetRiskDisclosure =
    datasetState.kind === 'ready'
      ? buildDatasetRiskDisclosure(datasetState.source, '검색', 'search-dataset-risk-notice')
      : null;

  const results = useMemo(() => {
    if (!selectorContext) {
      return null;
    }

    return selectSearchResults(selectorContext, deferredQuery);
  }, [deferredQuery, selectorContext]);

  const suggestedTeams = useMemo(() => {
    if (!selectorContext) {
      return [];
    }

    return selectorContext.dataset.artistProfiles
      .map((profile) => selectTeamSummaryBySlug(selectorContext, profile.slug))
      .filter((team): team is TeamSummaryModel => team !== null)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .slice(0, 4);
  }, [selectorContext]);

  const teamSlugByGroup = useMemo(() => {
    const entries = new Map<string, string>();

    if (!selectorContext) {
      return entries;
    }

    for (const profile of selectorContext.dataset.artistProfiles) {
      entries.set(profile.group, profile.slug);
    }

    return entries;
  }, [selectorContext]);

  useEffect(() => {
    const currentRouteParams = buildSearchRouteParams({
      activeSegment: routeState.activeSegment,
      query: routeState.query,
    });
    const nextRouteParams = buildSearchRouteParams({
      activeSegment,
      query,
    });

    if (areRouteParamsEqual(currentRouteParams, nextRouteParams)) {
      return;
    }

    router.setParams(nextRouteParams);
  }, [activeSegment, query, routeState.activeSegment, routeState.query, router]);

  async function rememberQuery(nextQuery: string) {
    const history = await persistRecentQuery(nextQuery);
    setRecentQueries(history);
  }

  function buildSearchSubmissionMetrics(nextQuery: string): {
    hadResults: boolean;
    resultCounts: {
      entities: number;
      releases: number;
      upcoming: number;
    };
  } {
    if (!selectorContext) {
      return {
        hadResults: false,
        resultCounts: {
          entities: 0,
          releases: 0,
          upcoming: 0,
        },
      };
    }

    const nextResults = selectSearchResults(selectorContext, nextQuery);
    const resultCounts = {
      entities: nextResults.entities.length,
      releases: nextResults.releases.length,
      upcoming: nextResults.upcoming.length,
    };

    return {
      hadResults: resultCounts.entities + resultCounts.releases + resultCounts.upcoming > 0,
      resultCounts,
    };
  }

  async function handleSubmitQuery(nextQuery = query, submitSource: SearchSubmitSource = 'input') {
    const normalized = nextQuery.trim();
    if (!normalized) {
      return;
    }

    const metrics = buildSearchSubmissionMetrics(normalized);
    trackAnalyticsEvent('search_submitted', {
      query: normalized,
      submitSource,
      activeSegment,
      resultCounts: metrics.resultCounts,
      hadResults: metrics.hadResults,
    });
    await rememberQuery(normalized);
  }

  async function handleRecentQueryPress(nextQuery: string) {
    setQuery(nextQuery);
    await handleSubmitQuery(nextQuery, 'recent');
  }

  async function handleClearHistory() {
    await clearRecentQueries();
    setRecentQueries([]);
  }

  function openTeamDetail(slug: string) {
    router.push({
      pathname: '/artists/[slug]',
      params: { slug },
    });
  }

  function openReleaseDetail(releaseId: string) {
    router.push({
      pathname: '/releases/[id]',
      params: { id: releaseId },
    });
  }

  function handleTeamResultPress(result: SearchTeamResultModel) {
    trackAnalyticsEvent('search_result_opened', {
      query: query.trim(),
      activeSegment,
      resultType: 'team',
      targetId: result.team.slug,
      matchKind: result.matchKind,
    });
    openTeamDetail(result.team.slug);
  }

  function handleReleaseResultPress(release: ReleaseSummaryModel, matchKind: string) {
    trackAnalyticsEvent('search_result_opened', {
      query: query.trim(),
      activeSegment,
      resultType: 'release',
      targetId: release.id,
      matchKind,
    });
    openReleaseDetail(release.id);
  }

  function handleUpcomingResultPress(result: SearchUpcomingResultModel) {
    const slug = teamSlugByGroup.get(result.upcoming.group);
    if (!slug) {
      return;
    }

    trackAnalyticsEvent('search_result_opened', {
      query: query.trim(),
      activeSegment,
      resultType: 'upcoming',
      targetId: slug,
      matchKind: result.matchKind,
    });
    openTeamDetail(slug);
  }

  if (datasetState.kind === 'loading') {
    return (
      <ScreenFeedbackState
        body="검색 대상 팀, 발매, 예정 데이터를 불러오는 중입니다."
        eyebrow="DATASET LOADING"
        title="Search"
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
        title="Search"
        variant="error"
      />
    );
  }

  if (!results) {
    return null;
  }

  const segmentCounts: Record<SearchSegment, number> = {
    entities: results.entities.length,
    releases: results.releases.length,
    upcoming: results.upcoming.length,
  };

  const activeRows =
    activeSegment === 'entities'
      ? results.entities
      : activeSegment === 'releases'
        ? results.releases
        : results.upcoming;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppBar
        subtitle="한글 별칭, 영문 그룹명, 릴리즈명, 예정 headline까지 같은 selector semantics로 찾습니다."
        testID="search-app-bar"
        title="Search"
      />

      {datasetRiskDisclosure ? (
        <InlineFeedbackNotice
          body={datasetRiskDisclosure.body}
          testID={datasetRiskDisclosure.testID}
          title={datasetRiskDisclosure.title}
        />
      ) : null}

      <View style={styles.searchCard}>
        <TextInput
          accessibilityHint="팀, 릴리즈, 예정 키워드를 입력해 검색합니다."
          accessibilityLabel="팀, 앨범, 곡, 별칭 검색"
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void handleSubmitQuery()}
          placeholder="팀, 앨범, 곡, 별칭 검색"
          placeholderTextColor={theme.colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {query.trim() ? (
          <Pressable
            testID="search-clear-button"
            accessibilityLabel="검색어 지우기"
            accessibilityRole="button"
            onPress={() => setQuery('')}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonLabel}>지우기</Text>
          </Pressable>
        ) : null}
      </View>

      <SegmentedControl
        items={[
          { count: segmentCounts.entities, key: 'entities', label: '팀' },
          { count: segmentCounts.releases, key: 'releases', label: '발매' },
          { count: segmentCounts.upcoming, key: 'upcoming', label: '예정' },
        ]}
        onChange={(key) => setActiveSegment(key as SearchSegment)}
        selectedKey={activeSegment}
        testID="search-segment"
      />

      {!query.trim() ? (
        <>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>최근 검색</Text>
              {recentQueries.length ? (
                <Pressable
                  testID="search-clear-history"
                  accessibilityLabel="최근 검색 전체 삭제"
                  accessibilityRole="button"
                  onPress={() => void handleClearHistory()}
                  style={styles.inlineButton}
                >
                  <Text style={styles.inlineButtonLabel}>전체 삭제</Text>
                </Pressable>
              ) : null}
            </View>

            {recentQueries.length ? (
              <View style={styles.chipRow}>
                {recentQueries.map((recentQuery) => (
                  <Pressable
                    key={recentQuery}
                    testID={`recent-query-${recentQuery}`}
                    accessibilityLabel={`${recentQuery} 다시 검색`}
                    accessibilityRole="button"
                    onPress={() => void handleRecentQueryPress(recentQuery)}
                    style={({ pressed }) => [styles.historyChip, pressed ? styles.segmentButtonPressed : null]}
                  >
                    <Text style={styles.historyChipLabel}>{recentQuery}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <InlineFeedbackNotice body="최근 검색이 없습니다." />
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>추천 팀</Text>
            <View style={styles.suggestedGrid}>
              {suggestedTeams.map((team) => (
                <View
                  key={team.slug}
                  style={styles.resultCard}
                  testID={`suggested-team-${team.slug}`}
                >
                  <TeamIdentityRow
                    badgeImageUrl={team.badge?.imageUrl}
                    meta={team.agency ?? 'Tracked team'}
                    monogram={formatSuggestedLabel(team)}
                    name={team.displayName}
                    testID={`suggested-team-copy-${team.slug}`}
                  />
                  <ActionButton
                    accessibilityLabel={`${team.displayName} 팀 열기`}
                    label="팀 페이지"
                    onPress={() => openTeamDetail(team.slug)}
                    testID={`suggested-team-open-${team.slug}`}
                  />
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>검색 결과</Text>
            <Text style={styles.sectionMeta}>{segmentCounts[activeSegment]}건</Text>
          </View>

          {activeRows.length === 0 ? (
            <InlineFeedbackNotice body="검색 결과가 없습니다." />
          ) : null}

          {activeSegment === 'entities'
            ? results.entities.map((result) => (
                <View key={result.team.slug} style={styles.resultCard}>
                  <TeamIdentityRow
                    badgeImageUrl={result.team.badge?.imageUrl}
                    meta={formatTeamMeta(result)}
                    monogram={result.team.badge?.monogram}
                    name={result.team.displayName}
                    testID={`search-team-result-${result.team.slug}`}
                  />
                  <Text style={styles.resultMeta}>{result.matchKind}</Text>
                  <ActionButton
                    accessibilityLabel={buildTeamResultAccessibilityLabel(result)}
                    label="팀 페이지"
                    onPress={() => handleTeamResultPress(result)}
                    testID={`search-team-result-press-${result.team.slug}`}
                  />
                </View>
              ))
            : null}

          {activeSegment === 'releases'
            ? results.releases.map((result) => (
                <View key={result.release.id} style={styles.resultCard}>
                  <TeamIdentityRow
                    meta={`${result.release.displayGroup} · ${formatReleaseMeta(result.release)}`}
                    monogram={result.release.displayGroup.slice(0, 2)}
                    name={result.release.releaseTitle}
                    testID={`search-release-result-${result.release.id}`}
                  />
                  <Text style={styles.resultMeta}>{result.matchKind}</Text>
                  <ActionButton
                    accessibilityLabel={buildReleaseResultAccessibilityLabel(result.release, result.matchKind)}
                    label="릴리즈 상세"
                    onPress={() => handleReleaseResultPress(result.release, result.matchKind)}
                    testID={`search-release-result-press-${result.release.id}`}
                  />
                </View>
              ))
            : null}

          {activeSegment === 'upcoming'
            ? results.upcoming.map((result) => (
                <View key={result.upcoming.id} style={styles.resultCard}>
                  <TeamIdentityRow
                    meta={result.upcoming.releaseLabel ?? result.upcoming.headline}
                    monogram={result.upcoming.displayGroup.slice(0, 2)}
                    name={result.upcoming.displayGroup}
                    testID={`search-upcoming-result-${result.upcoming.id}`}
                  />
                  <Text style={styles.resultMeta}>
                    {formatUpcomingMeta(result)} · {result.matchKind}
                  </Text>
                  <ActionButton
                    accessibilityLabel={buildUpcomingResultAccessibilityLabel(result)}
                    disabled={!teamSlugByGroup.get(result.upcoming.group)}
                    label="팀 페이지"
                    onPress={() => handleUpcomingResultPress(result)}
                    testID={`search-upcoming-result-press-${result.upcoming.id}`}
                  />
                </View>
              ))
            : null}
        </View>
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
    searchCard: {
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
      padding: theme.space[12],
      gap: theme.space[8],
    },
    searchInput: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
      minHeight: 48,
    },
    inlineButton: {
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
    },
    inlineButtonLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      flexShrink: 1,
      textAlign: 'center',
    },
    segmentButtonPressed: {
      backgroundColor: theme.colors.surface.interactive,
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
    sectionMeta: {
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
    historyChip: {
      borderRadius: theme.radius.chip,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      minHeight: 44,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
    },
    historyChipLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      flexShrink: 1,
      textAlign: 'center',
    },
    suggestedGrid: {
      gap: theme.space[8],
    },
    resultCard: {
      gap: theme.space[8],
      paddingTop: theme.space[12],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.subtle,
    },
    resultMeta: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
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
  });
}
