import { useRouter } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createSelectorContext,
  selectSearchResults,
  selectTeamSummaryBySlug,
} from '../../src/selectors';
import { loadActiveMobileDataset, type ActiveMobileDataset } from '../../src/services/activeDataset';
import { clearRecentQueries, persistRecentQuery, readRecentQueries } from '../../src/services/recentQueries';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  ReleaseSummaryModel,
  SearchTeamResultModel,
  SearchUpcomingResultModel,
  TeamSummaryModel,
} from '../../src/types';

type SearchScreenState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; source: ActiveMobileDataset };

type SearchSegment = 'entities' | 'releases' | 'upcoming';

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

export default function SearchTabScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<SearchScreenState>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [activeSegment, setActiveSegment] = useState<SearchSegment>('entities');
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    void Promise.all([loadActiveMobileDataset(), readRecentQueries()])
      .then(([source, history]) => {
        if (cancelled) {
          return;
        }

        setRecentQueries(history);
        setState({
          kind: 'ready',
          source,
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
              : 'Search dataset could not be loaded right now.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const selectorContext = useMemo(() => {
    if (state.kind !== 'ready') {
      return null;
    }

    return createSelectorContext(state.source.dataset);
  }, [state]);

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

  async function rememberQuery(nextQuery: string) {
    const history = await persistRecentQuery(nextQuery);
    setRecentQueries(history);
  }

  async function handleSubmitQuery(nextQuery = query) {
    const normalized = nextQuery.trim();
    if (!normalized) {
      return;
    }

    await rememberQuery(normalized);
  }

  async function handleRecentQueryPress(nextQuery: string) {
    setQuery(nextQuery);
    await rememberQuery(nextQuery);
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

  if (state.kind === 'loading') {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={theme.colors.text.brand} />
        <Text style={styles.eyebrow}>DATASET LOADING</Text>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.body}>검색 대상 팀, 발매, 예정 데이터를 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.eyebrow}>LOAD ERROR</Text>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.body}>{state.message}</Text>
        <Pressable style={styles.retryButton} onPress={() => setReloadCount((count) => count + 1)}>
          <Text style={styles.retryButtonLabel}>다시 시도</Text>
        </Pressable>
      </View>
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SEARCH TAB</Text>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.body}>한글 별칭, 영문 그룹명, 릴리즈명, 예정 headline까지 같은 selector semantics로 찾습니다.</Text>
      </View>

      <View style={styles.searchCard}>
        <TextInput
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
            accessibilityRole="button"
            onPress={() => setQuery('')}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonLabel}>지우기</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.segmentRow}>
        {([
          ['entities', '팀'],
          ['releases', '발매'],
          ['upcoming', '예정'],
        ] as const).map(([segment, label]) => (
          <Pressable
            key={segment}
            testID={`search-segment-${segment}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeSegment === segment }}
            onPress={() => setActiveSegment(segment)}
            style={({ pressed }) => [
              styles.segmentButton,
              activeSegment === segment ? styles.segmentButtonActive : null,
              pressed ? styles.segmentButtonPressed : null,
            ]}
          >
            <Text style={activeSegment === segment ? styles.segmentLabelActive : styles.segmentLabel}>
              {label}
            </Text>
            <Text style={activeSegment === segment ? styles.segmentCountActive : styles.segmentCount}>
              {segmentCounts[segment]}
            </Text>
          </Pressable>
        ))}
      </View>

      {!query.trim() ? (
        <>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>최근 검색</Text>
              {recentQueries.length ? (
                <Pressable
                  testID="search-clear-history"
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
                    accessibilityRole="button"
                    onPress={() => void handleRecentQueryPress(recentQuery)}
                    style={({ pressed }) => [styles.historyChip, pressed ? styles.segmentButtonPressed : null]}
                  >
                    <Text style={styles.historyChipLabel}>{recentQuery}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.body}>최근 검색이 없습니다.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>추천 팀</Text>
            <View style={styles.suggestedGrid}>
              {suggestedTeams.map((team) => (
                <Pressable
                  key={team.slug}
                  testID={`suggested-team-${team.slug}`}
                  accessibilityRole="button"
                  onPress={() => openTeamDetail(team.slug)}
                  style={({ pressed }) => [styles.suggestedCard, pressed ? styles.segmentButtonPressed : null]}
                >
                  <View style={styles.suggestedBadge}>
                    <Text style={styles.suggestedBadgeLabel}>{formatSuggestedLabel(team)}</Text>
                  </View>
                  <Text style={styles.suggestedTitle}>{team.displayName}</Text>
                  <Text style={styles.suggestedMeta}>{team.agency ?? 'Tracked team'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>검색 결과</Text>
            <Text style={styles.sectionMeta}>{segmentCounts[activeSegment]}건</Text>
          </View>

          {activeRows.length === 0 ? (
            <Text style={styles.body}>검색 결과가 없습니다.</Text>
          ) : null}

          {activeSegment === 'entities'
            ? results.entities.map((result) => (
                <Pressable
                  key={result.team.slug}
                  accessibilityRole="button"
                  onPress={() => openTeamDetail(result.team.slug)}
                  style={({ pressed }) => [styles.resultRow, pressed ? styles.segmentButtonPressed : null]}
                >
                  <View style={styles.resultLeadingBadge}>
                    <Text style={styles.resultLeadingBadgeLabel}>
                      {result.team.badge?.monogram ?? result.team.displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View testID={`search-team-result-${result.team.slug}`} style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{result.team.displayName}</Text>
                    <Text style={styles.resultBody}>{formatTeamMeta(result)}</Text>
                    <Text style={styles.resultMeta}>{result.matchKind}</Text>
                  </View>
                </Pressable>
              ))
            : null}

          {activeSegment === 'releases'
            ? results.releases.map((result) => (
                <Pressable
                  key={result.release.id}
                  accessibilityRole="button"
                  onPress={() => openReleaseDetail(result.release.id)}
                  style={({ pressed }) => [styles.resultRow, pressed ? styles.segmentButtonPressed : null]}
                >
                  <View style={styles.resultLeadingBadge}>
                    <Text style={styles.resultLeadingBadgeLabel}>{result.release.displayGroup.slice(0, 2)}</Text>
                  </View>
                  <View testID={`search-release-result-${result.release.id}`} style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{result.release.releaseTitle}</Text>
                    <Text style={styles.resultBody}>{result.release.displayGroup}</Text>
                    <Text style={styles.resultMeta}>
                      {formatReleaseMeta(result.release)} · {result.matchKind}
                    </Text>
                  </View>
                </Pressable>
              ))
            : null}

          {activeSegment === 'upcoming'
            ? results.upcoming.map((result) => (
                <Pressable
                  key={result.upcoming.id}
                  accessibilityRole="button"
                  onPress={() => {
                    const slug = teamSlugByGroup.get(result.upcoming.group);
                    if (slug) {
                      openTeamDetail(slug);
                    }
                  }}
                  style={({ pressed }) => [styles.resultRow, pressed ? styles.segmentButtonPressed : null]}
                >
                  <View style={styles.resultLeadingBadge}>
                    <Text style={styles.resultLeadingBadgeLabel}>
                      {result.upcoming.displayGroup.slice(0, 2)}
                    </Text>
                  </View>
                  <View testID={`search-upcoming-result-${result.upcoming.id}`} style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{result.upcoming.displayGroup}</Text>
                    <Text style={styles.resultBody}>
                      {result.upcoming.releaseLabel ?? result.upcoming.headline}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {formatUpcomingMeta(result)} · {result.matchKind}
                    </Text>
                  </View>
                </Pressable>
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
    },
    segmentRow: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    segmentButton: {
      flex: 1,
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.elevated,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[12],
      gap: theme.space[4],
      alignItems: 'center',
    },
    segmentButtonActive: {
      borderColor: theme.colors.border.focus,
      backgroundColor: theme.colors.surface.interactive,
    },
    segmentButtonPressed: {
      backgroundColor: theme.colors.surface.interactive,
    },
    segmentLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    segmentLabelActive: {
      color: theme.colors.text.brand,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    segmentCount: {
      color: theme.colors.text.tertiary,
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      fontWeight: theme.typography.meta.fontWeight,
    },
    segmentCountActive: {
      color: theme.colors.text.brand,
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
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
    },
    historyChipLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    suggestedGrid: {
      gap: theme.space[8],
    },
    suggestedCard: {
      borderRadius: theme.radius.button,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      padding: theme.space[12],
      gap: theme.space[8],
    },
    suggestedBadge: {
      alignSelf: 'flex-start',
      minWidth: 40,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.status.title.bg,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[4],
    },
    suggestedBadgeLabel: {
      color: theme.colors.status.title.text,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
      textAlign: 'center',
    },
    suggestedTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    suggestedMeta: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
    },
    resultRow: {
      flexDirection: 'row',
      gap: theme.space[12],
      paddingTop: theme.space[12],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.subtle,
    },
    resultLeadingBadge: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.base,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultLeadingBadgeLabel: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: theme.typography.buttonService.fontWeight,
    },
    resultCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    resultTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.cardTitle.fontSize,
      lineHeight: theme.typography.cardTitle.lineHeight,
      fontWeight: theme.typography.cardTitle.fontWeight,
    },
    resultBody: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: theme.typography.body.fontWeight,
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
