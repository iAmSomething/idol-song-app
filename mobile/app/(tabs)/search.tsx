import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton } from '../../src/components/actions/ActionButton';
import { ServiceButtonGroup } from '../../src/components/actions/ServiceButtonGroup';
import { SegmentedControl } from '../../src/components/controls/SegmentedControl';
import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
import { TeamIdentityRow } from '../../src/components/identity/TeamIdentityRow';
import { AppBar } from '../../src/components/layout/AppBar';
import { SourceLinkRow } from '../../src/components/meta/SourceLinkRow';
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
import { openServiceHandoff, resolveServiceHandoff, type MusicService } from '../../src/services/handoff';
import { clearRecentQueries, persistRecentQuery, readRecentQueries } from '../../src/services/recentQueries';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  ReleaseSummaryModel,
  SearchReleaseResultModel,
  SearchTeamResultModel,
  SearchUpcomingResultModel,
  TeamSummaryModel,
} from '../../src/types';

function resolveReleaseKindLabel(releaseKind?: string): string {
  if (!releaseKind) {
    return '발매';
  }

  const normalized = releaseKind.trim().toLowerCase();
  if (normalized === 'single') {
    return '싱글';
  }
  if (normalized === 'mini' || normalized === 'ep') {
    return '미니';
  }
  if (normalized === 'album') {
    return '정규';
  }
  if (normalized === 'ost') {
    return 'OST';
  }
  if (normalized === 'collab') {
    return '콜라보';
  }

  return releaseKind;
}

function formatReleaseMeta(release: ReleaseSummaryModel): string {
  const releaseKind = resolveReleaseKindLabel(release.releaseKind);
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

function resolveTeamMatchLabel(matchKind: SearchTeamResultModel['matchKind']): string {
  if (matchKind === 'display_name_exact') {
    return '팀명 정확';
  }

  if (matchKind === 'search_alias_exact' || matchKind === 'alias_exact') {
    return '별칭 정확';
  }

  if (matchKind === 'alias_partial') {
    return '별칭 부분';
  }

  return '부분 일치';
}

function resolveReleaseMatchLabel(matchKind: SearchReleaseResultModel['matchKind']): string {
  if (matchKind === 'release_title_exact') {
    return '릴리즈명 정확';
  }

  if (matchKind === 'entity_exact_latest_release') {
    return '팀명 정확';
  }

  return '부분 일치';
}

function resolveUpcomingMatchLabel(matchKind: SearchUpcomingResultModel['matchKind']): string {
  if (matchKind === 'entity_exact') {
    return '팀명 정확';
  }

  if (matchKind === 'headline_exact') {
    return '헤드라인 정확';
  }

  return '부분 일치';
}

function resolveSearchSegmentLabel(segment: SearchSegment): string {
  if (segment === 'entities') {
    return '팀';
  }

  if (segment === 'releases') {
    return '발매';
  }

  return '예정';
}

function resolveUpcomingSourceLabel(sourceType: SearchUpcomingResultModel['upcoming']['sourceType']): string {
  if (
    sourceType === 'agency_notice' ||
    sourceType === 'weverse_notice' ||
    sourceType === 'official_social'
  ) {
    return '공식 공지';
  }

  if (sourceType === 'news_rss') {
    return '기사 원문';
  }

  return '출처 보기';
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
  const inputRef = useRef<TextInput | null>(null);
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null);
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

  const teamSummaryByGroup = useMemo(() => {
    const entries = new Map<string, TeamSummaryModel>();

    if (!selectorContext) {
      return entries;
    }

    for (const profile of selectorContext.dataset.artistProfiles) {
      const team = selectTeamSummaryBySlug(selectorContext, profile.slug);
      if (team) {
        entries.set(profile.group, team);
      }
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

    setQuery(normalized);
    setHandoffFeedback(null);
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
    setHandoffFeedback(null);
    await handleSubmitQuery(nextQuery, 'recent');
  }

  async function handleClearHistory() {
    await clearRecentQueries();
    setRecentQueries([]);
  }

  function handleClearSearch() {
    setHandoffFeedback(null);
    setQuery('');
    setActiveSegment('entities');
  }

  function handleCancelSearch() {
    setHandoffFeedback(null);
    setQuery('');
    setActiveSegment('entities');
    setIsInputFocused(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  }

  function openTeamDetail(slug: string) {
    setHandoffFeedback(null);
    router.push({
      pathname: '/artists/[slug]',
      params: { slug },
    });
  }

  function openReleaseDetail(releaseId: string) {
    setHandoffFeedback(null);
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

  async function handleUpcomingSourcePress(result: SearchUpcomingResultModel) {
    if (!result.upcoming.sourceUrl) {
      return;
    }

    try {
      await Linking.openURL(result.upcoming.sourceUrl);
      setHandoffFeedback(null);
    } catch {
      setHandoffFeedback('링크를 열 수 없습니다. 다시 시도해 주세요.');
    }
  }

  function buildReleaseServiceQuery(release: ReleaseSummaryModel): string {
    return `${release.displayGroup} ${release.releaseTitle}`.trim();
  }

  function buildReleaseMvQuery(release: ReleaseSummaryModel): string {
    return `${release.displayGroup} ${release.representativeSongTitle ?? release.releaseTitle}`.trim();
  }

  async function handleReleaseServicePress(release: ReleaseSummaryModel, service: MusicService) {
    const resolution = resolveServiceHandoff({
      service,
      query: service === 'youtubeMv' ? buildReleaseMvQuery(release) : buildReleaseServiceQuery(release),
      canonicalUrl:
        service === 'spotify'
          ? release.spotifyUrl
          : service === 'youtubeMusic'
            ? release.youtubeMusicUrl
            : release.youtubeMvUrl,
    });

    trackAnalyticsEvent('service_handoff_attempted', {
      surface: 'search',
      service,
      mode: resolution.mode,
    });

    const result = await openServiceHandoff(resolution);
    trackAnalyticsEvent('service_handoff_completed', {
      surface: 'search',
      service,
      mode: result.mode,
      ok: result.ok,
      target: result.ok ? result.target : result.target,
      failureCode: result.ok ? null : result.code,
    });

    setHandoffFeedback(result.ok ? null : '앱을 열 수 없습니다. 다시 시도해 주세요.');
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
  const totalResults = segmentCounts.entities + segmentCounts.releases + segmentCounts.upcoming;
  const availableSegments = (['entities', 'releases', 'upcoming'] as SearchSegment[]).filter(
    (segment) => segmentCounts[segment] > 0,
  );
  const hasPartialResults = totalResults > 0 && availableSegments.length < 3;
  const firstAvailableSegment = availableSegments[0] ?? null;
  const showActiveSegmentEmpty = query.trim().length > 0 && activeRows.length === 0 && totalResults > 0;
  const showSegmentSummaryNotice =
    query.trim().length > 0 && activeRows.length > 0 && hasPartialResults;
  const showCancelAction = isInputFocused || query.trim().length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
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
        <View style={styles.searchInputRow}>
          <TextInput
            ref={inputRef}
            accessibilityHint="팀, 릴리즈, 예정 키워드를 입력해 검색합니다."
            accessibilityLabel="팀, 앨범, 곡, 별칭 검색"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => setIsInputFocused(false)}
            onChangeText={(nextQuery) => {
              setHandoffFeedback(null);
              setQuery(nextQuery);
            }}
            onFocus={() => setIsInputFocused(true)}
            onSubmitEditing={() => void handleSubmitQuery()}
            placeholder="팀, 앨범, 곡, 별칭 검색"
            placeholderTextColor={theme.colors.text.tertiary}
            returnKeyType="search"
            style={styles.searchInput}
            testID="search-input"
            value={query}
          />
          {query.trim() ? (
            <Pressable
              accessibilityLabel="검색어 지우기"
              accessibilityRole="button"
              onPress={handleClearSearch}
              style={styles.inlineButton}
              testID="search-clear-button"
            >
              <Text style={styles.inlineButtonLabel}>지우기</Text>
            </Pressable>
          ) : null}
          {showCancelAction ? (
            <Pressable
              accessibilityLabel="검색 취소"
              accessibilityRole="button"
              onPress={handleCancelSearch}
              style={styles.inlineButton}
              testID="search-cancel-button"
            >
              <Text style={styles.inlineButtonLabel}>취소</Text>
            </Pressable>
          ) : null}
        </View>
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

          {handoffFeedback ? (
            <InlineFeedbackNotice
              body={handoffFeedback}
              testID="search-handoff-feedback"
              title="외부 열기 실패"
              tone="error"
            />
          ) : null}

          {showSegmentSummaryNotice ? (
            <InlineFeedbackNotice
              body={`일부 세그먼트만 결과가 있습니다. 팀 ${segmentCounts.entities} · 발매 ${segmentCounts.releases} · 예정 ${segmentCounts.upcoming}`}
              testID="search-partial-result-notice"
              title="일부 세그먼트만 결과가 있습니다."
            />
          ) : null}

          {query.trim() && totalResults === 0 ? (
            <InlineFeedbackNotice body="검색 결과가 없습니다." testID="search-no-result-notice" />
          ) : null}

          {showActiveSegmentEmpty ? (
            <InlineFeedbackNotice
              action={
                firstAvailableSegment
                  ? {
                      label: `${resolveSearchSegmentLabel(firstAvailableSegment)} 결과 보기`,
                      onPress: () => setActiveSegment(firstAvailableSegment),
                      testID: 'search-partial-result-action',
                    }
                  : undefined
              }
              body="다른 탭을 확인해 보세요."
              testID="search-segment-empty-notice"
              title="이 세그먼트에는 결과가 없습니다."
            />
          ) : null}

          {activeSegment === 'entities'
            ? results.entities.map((result) => (
                <View key={result.team.slug} style={styles.resultCard}>
                  <Pressable
                    accessibilityHint="팀 상세 화면으로 이동합니다."
                    accessibilityLabel={buildTeamResultAccessibilityLabel(result)}
                    accessibilityRole="button"
                    onPress={() => handleTeamResultPress(result)}
                    style={({ pressed }) => [styles.resultPressable, pressed ? styles.resultPressed : null]}
                    testID={`search-team-result-press-${result.team.slug}`}
                  >
                    <TeamIdentityRow
                      badgeImageUrl={result.team.badge?.imageUrl}
                      meta={formatTeamMeta(result)}
                      monogram={result.team.badge?.monogram}
                      name={result.team.displayName}
                      testID={`search-team-result-${result.team.slug}`}
                    />
                    <View style={styles.chipRow}>
                      <View style={styles.resultChip}>
                        <Text style={styles.resultChipLabel}>{resolveTeamMatchLabel(result.matchKind)}</Text>
                      </View>
                    </View>
                  </Pressable>
                </View>
              ))
            : null}

          {activeSegment === 'releases'
            ? results.releases.map((result) => (
                <View key={result.release.id} style={styles.resultCard}>
                  <Pressable
                    accessibilityHint="릴리즈 상세 화면으로 이동합니다."
                    accessibilityLabel={buildReleaseResultAccessibilityLabel(result.release, result.matchKind)}
                    accessibilityRole="button"
                    onPress={() => handleReleaseResultPress(result.release, result.matchKind)}
                    style={({ pressed }) => [styles.resultPressable, pressed ? styles.resultPressed : null]}
                    testID={`search-release-result-press-${result.release.id}`}
                  >
                    <TeamIdentityRow
                      badgeImageUrl={result.release.coverImageUrl}
                      meta={`${result.release.displayGroup} · ${formatReleaseMeta(result.release)}`}
                      monogram={result.release.displayGroup.slice(0, 2).toUpperCase()}
                      name={result.release.releaseTitle}
                      testID={`search-release-result-${result.release.id}`}
                    />
                  </Pressable>
                  <View style={styles.resultSupplement}>
                    <View style={styles.chipRow}>
                      <View style={styles.resultChip}>
                        <Text style={styles.resultChipLabel}>{resolveReleaseMatchLabel(result.matchKind)}</Text>
                      </View>
                    </View>
                    <ServiceButtonGroup
                      buttons={[
                        {
                          key: `${result.release.id}-spotify`,
                          accessibilityLabel: `${result.release.releaseTitle} Spotify 열기`,
                          label: 'Spotify',
                          mode: resolveServiceHandoff({
                            service: 'spotify',
                            query: buildReleaseServiceQuery(result.release),
                            canonicalUrl: result.release.spotifyUrl,
                          }).mode,
                          onPress: () => void handleReleaseServicePress(result.release, 'spotify'),
                          service: 'spotify',
                          testID: `search-release-service-spotify-${result.release.id}`,
                        },
                        {
                          key: `${result.release.id}-youtube-music`,
                          accessibilityLabel: `${result.release.releaseTitle} YouTube Music 열기`,
                          label: 'YouTube Music',
                          mode: resolveServiceHandoff({
                            service: 'youtubeMusic',
                            query: buildReleaseServiceQuery(result.release),
                            canonicalUrl: result.release.youtubeMusicUrl,
                          }).mode,
                          onPress: () => void handleReleaseServicePress(result.release, 'youtubeMusic'),
                          service: 'youtubeMusic',
                          testID: `search-release-service-youtube-music-${result.release.id}`,
                        },
                        {
                          key: `${result.release.id}-youtube-mv`,
                          accessibilityLabel: `${result.release.releaseTitle} YouTube MV 열기`,
                          label: 'YouTube MV',
                          mode: resolveServiceHandoff({
                            service: 'youtubeMv',
                            query: buildReleaseMvQuery(result.release),
                            canonicalUrl: result.release.youtubeMvUrl,
                          }).mode,
                          onPress: () => void handleReleaseServicePress(result.release, 'youtubeMv'),
                          service: 'youtubeMv',
                          testID: `search-release-service-youtube-mv-${result.release.id}`,
                        },
                      ]}
                      testID={`search-release-result-services-${result.release.id}`}
                    />
                  </View>
                </View>
              ))
            : null}

          {activeSegment === 'upcoming'
            ? results.upcoming.map((result) => (
                <View key={result.upcoming.id} style={styles.resultCard}>
                  <Pressable
                    accessibilityHint="팀 상세 화면으로 이동합니다."
                    accessibilityLabel={buildUpcomingResultAccessibilityLabel(result)}
                    accessibilityRole="button"
                    disabled={!teamSlugByGroup.get(result.upcoming.group)}
                    onPress={() => handleUpcomingResultPress(result)}
                    style={({ pressed }) => [
                      styles.resultPressable,
                      pressed && teamSlugByGroup.get(result.upcoming.group) ? styles.resultPressed : null,
                    ]}
                    testID={`search-upcoming-result-press-${result.upcoming.id}`}
                  >
                    <TeamIdentityRow
                      badgeImageUrl={teamSummaryByGroup.get(result.upcoming.group)?.badge?.imageUrl}
                      meta={result.upcoming.releaseLabel ?? result.upcoming.headline}
                      monogram={
                        teamSummaryByGroup.get(result.upcoming.group)?.badge?.monogram ??
                        result.upcoming.displayGroup.slice(0, 2).toUpperCase()
                      }
                      name={result.upcoming.displayGroup}
                      testID={`search-upcoming-result-${result.upcoming.id}`}
                    />
                    <Text style={styles.resultMeta}>{formatUpcomingMeta(result)}</Text>
                  </Pressable>
                  <View style={styles.resultSupplement}>
                    <View style={styles.chipRow}>
                      <View style={styles.resultChip}>
                        <Text style={styles.resultChipLabel}>{resolveUpcomingMatchLabel(result.matchKind)}</Text>
                      </View>
                    </View>
                    {result.upcoming.sourceUrl ? (
                      <SourceLinkRow
                        links={[
                          {
                            key: `${result.upcoming.id}-source`,
                            label: resolveUpcomingSourceLabel(result.upcoming.sourceType),
                            onPress: () => void handleUpcomingSourcePress(result),
                            type: 'source',
                            url: result.upcoming.sourceUrl,
                          },
                        ]}
                        testID={`search-upcoming-source-row-${result.upcoming.id}`}
                      />
                    ) : null}
                  </View>
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
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
    },
    searchInput: {
      flex: 1,
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
    resultPressable: {
      gap: theme.space[8],
    },
    resultPressed: {
      opacity: 0.84,
    },
    resultSupplement: {
      gap: theme.space[8],
    },
    resultChip: {
      alignSelf: 'flex-start',
      borderRadius: theme.radius.chip,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[8],
    },
    resultChipLabel: {
      color: theme.colors.text.secondary,
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
