import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
import { ActionButton } from '../../src/components/actions/ActionButton';
import {
  ServiceButtonGroup,
  type ServiceButtonGroupItem,
} from '../../src/components/actions/ServiceButtonGroup';
import { AppBar } from '../../src/components/layout/AppBar';
import { CompactHero } from '../../src/components/surfaces/CompactHero';
import { InsetSection } from '../../src/components/surfaces/InsetSection';
import { TonalPanel } from '../../src/components/surfaces/TonalPanel';
import { FallbackArt } from '../../src/components/visual/FallbackArt';
import {
  buildDatasetRiskDisclosure,
  buildEntitySourceDisclosure,
} from '../../src/features/surfaceDisclosures';
import {
  MOBILE_COPY,
  formatMonthOnlyDateLabel,
  resolveUpcomingConfidenceLabel as resolveUpcomingConfidenceChipLabel,
  resolveUpcomingStatusWithFallback,
} from '../../src/copy/mobileCopy';
import { useActiveDatasetScreen } from '../../src/features/useActiveDatasetScreen';
import { selectEntityDetailSnapshot } from '../../src/selectors';
import { loadActiveMobileDataset } from '../../src/services/activeDataset';
import { adaptBackendEntityDetail } from '../../src/services/backendDisplayAdapters';
import { BackendReadError, type BackendReadClient } from '../../src/services/backendReadClient';
import {
  classifyExternalLinkFailureCategory,
  classifyServiceHandoffFailureCategory,
  trackAnalyticsEvent,
  trackFailureObserved,
} from '../../src/services/analytics';
import { openExternalLink, normalizeExternalLinkUrl } from '../../src/services/externalLinks';
import {
  describeServiceHandoffBehavior,
  openServiceHandoff,
  resolveServiceHandoff,
  type ServiceHandoffFailure,
  type ServiceHandoffResolution,
} from '../../src/services/handoff';
import {
  runWithPendingRouteResume,
  type RouteResumeTarget,
} from '../../src/services/routeResume';
import { useOptionalSafeAreaInsets } from '../../src/hooks/useOptionalSafeAreaInsets';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../src/tokens/accessibility';
import { useAppTheme } from '../../src/tokens/theme';
import { resolveBadgeFallbackAssetKey } from '../../src/utils/assetRegistry';
import type {
  ReleaseSummaryModel,
  TeamSummaryModel,
  UpcomingEventModel,
} from '../../src/types';

type OfficialLinkItem = {
  key: string;
  label: string;
  url: string;
};

type EntityServiceButtonItem = ServiceButtonGroupItem & {
  handoff: ServiceHandoffResolution | ServiceHandoffFailure;
};

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatUpcomingMeta(event: UpcomingEventModel): string {
  if (event.datePrecision === 'exact' && event.scheduledDate) {
    return `${event.scheduledDate} · ${resolveUpcomingStatusWithFallback(event.status)}`;
  }

  if (event.scheduledMonth) {
    return `${formatMonthOnlyDateLabel(event.scheduledMonth)} · ${resolveUpcomingStatusWithFallback(event.status)}`;
  }

  return resolveUpcomingStatusWithFallback(event.status);
}

function formatReleaseMeta(release: ReleaseSummaryModel): string {
  return `${release.releaseDate} · ${release.releaseKind ?? 'release'}`;
}

function buildOfficialLinks(team: TeamSummaryModel): OfficialLinkItem[] {
  return [
    team.officialXUrl
      ? {
          key: 'x',
          label: 'X',
          url: team.officialXUrl,
        }
      : null,
    team.officialInstagramUrl
      ? {
          key: 'instagram',
          label: 'Instagram',
          url: team.officialInstagramUrl,
        }
      : null,
    team.officialYoutubeUrl
      ? {
          key: 'youtube',
          label: 'YouTube',
          url: team.officialYoutubeUrl,
        }
      : null,
  ].filter((item): item is OfficialLinkItem => item !== null);
}

function buildOfficialLinkAccessibilityLabel(team: TeamSummaryModel, link: OfficialLinkItem): string {
  return `${team.displayName} 공식 ${link.label} 열기`;
}

function getReleaseKindLabel(release: ReleaseSummaryModel): string {
  if (release.releaseKind?.trim()) {
    return release.releaseKind.trim().toUpperCase();
  }

  if (release.stream === 'song') {
    return 'SONG';
  }

  if (release.stream === 'album') {
    return 'ALBUM';
  }

  return 'RELEASE';
}

function resolveUpcomingTimingLabel(event: UpcomingEventModel): string {
  if (event.datePrecision === 'exact' && event.scheduledDate) {
    return event.scheduledDate;
  }

  if (event.scheduledMonth) {
    return formatMonthOnlyDateLabel(event.scheduledMonth);
  }

  return MOBILE_COPY.date.unknown;
}

function resolveHandoffModeHintLabel(mode: 'canonical' | 'searchFallback'): string {
  return mode === 'canonical' ? MOBILE_COPY.handoff.appPreferred : MOBILE_COPY.handoff.searchFallback;
}

function buildLatestReleaseServiceButtons(release: ReleaseSummaryModel): EntityServiceButtonItem[] {
  const releaseQuery = `${release.displayGroup} ${release.releaseTitle}`;
  const mvQuery = `${release.displayGroup} ${release.representativeSongTitle ?? release.releaseTitle}`;
  const spotifyHandoff = resolveServiceHandoff({
    service: 'spotify',
    query: releaseQuery,
    canonicalUrl: release.spotifyUrl,
  });
  const youtubeMusicHandoff = resolveServiceHandoff({
    service: 'youtubeMusic',
    query: releaseQuery,
    canonicalUrl: release.youtubeMusicUrl,
  });
  const youtubeMvHandoff = resolveServiceHandoff({
    service: 'youtubeMv',
    query: mvQuery,
    canonicalUrl: release.youtubeMvUrl,
  });

  return [
    {
      accessibilityLabel: `Spotify에서 ${release.releaseTitle} 열기`,
      accessibilityHint: describeServiceHandoffBehavior(spotifyHandoff),
      key: 'spotify',
      label: 'Spotify',
      modeHintLabel: resolveHandoffModeHintLabel(spotifyHandoff.mode),
      handoff: spotifyHandoff,
      testID: 'entity-latest-release-service-spotify',
      tone: 'spotify',
    },
    {
      accessibilityLabel: `YouTube Music에서 ${release.releaseTitle} 열기`,
      accessibilityHint: describeServiceHandoffBehavior(youtubeMusicHandoff),
      key: 'youtubeMusic',
      label: 'YouTube Music',
      modeHintLabel: resolveHandoffModeHintLabel(youtubeMusicHandoff.mode),
      handoff: youtubeMusicHandoff,
      testID: 'entity-latest-release-service-youtube-music',
      tone: 'youtubeMusic',
    },
    {
      accessibilityLabel: `YouTube에서 ${release.releaseTitle} 공식 MV 열기`,
      accessibilityHint: describeServiceHandoffBehavior(youtubeMvHandoff),
      key: 'youtubeMv',
      label: 'YouTube MV',
      modeHintLabel: resolveHandoffModeHintLabel(youtubeMvHandoff.mode),
      handoff: youtubeMvHandoff,
      testID: 'entity-latest-release-service-youtube-mv',
      tone: 'youtubeMv',
    },
  ];
}

function EntityBadge({
  team,
  styles,
}: {
  team: TeamSummaryModel;
  styles: ReturnType<typeof createStyles>;
}) {
  if (team.badge?.imageUrl) {
    return <Image source={{ uri: team.badge.imageUrl }} style={styles.heroImage} />;
  }

  return (
    <FallbackArt
      height={88}
      label={team.badge?.monogram ?? team.displayName.slice(0, 2).toUpperCase()}
      testID="entity-hero-fallback-art"
      variant={resolveBadgeFallbackAssetKey(team.actType)}
      width={88}
    />
  );
}

export default function ArtistDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const theme = useAppTheme();
  const insets = useOptionalSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollContentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingTop: theme.space[16] + insets.top,
        paddingBottom: theme.space[32] + insets.bottom,
      },
    ],
    [insets.bottom, insets.top, styles.content, theme.space],
  );
  const slug = getSingleParam(params.slug)?.trim() ?? '';
  const [reloadCount, setReloadCount] = useState(0);
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const loadBundledSnapshot = useCallback(async () => {
    const activeDataset = await loadActiveMobileDataset();
    return slug ? selectEntityDetailSnapshot(activeDataset.dataset, slug) : null;
  }, [slug]);
  const loadBackendSnapshot = useCallback(
    async (client: BackendReadClient) => {
      if (!slug) {
        return {
          data: null,
          generatedAt: null,
        };
      }

      try {
        const response = await client.getEntityDetail(slug);
        return {
          data: adaptBackendEntityDetail(response.data),
          generatedAt: response.meta?.generatedAt ?? null,
        };
      } catch (error) {
        if (error instanceof BackendReadError && error.status === 404) {
          return {
            data: null,
            generatedAt: null,
          };
        }

        throw error;
      }
    },
    [slug],
  );
  const datasetState = useActiveDatasetScreen({
    surface: 'entity_detail',
    reloadKey: reloadCount,
    cacheKey: `entity:${slug || 'missing'}`,
    fallbackErrorMessage: '팀 상세 데이터를 불러오지 못했습니다.',
    loadBundled: loadBundledSnapshot,
    loadBackend: loadBackendSnapshot,
  });
  const snapshot = datasetState.kind === 'ready' ? datasetState.source.data : null;
  const currentResumeTarget = useMemo<RouteResumeTarget>(
    () => ({
      pathname: '/artists/[slug]',
      params: slug ? { slug } : undefined,
    }),
    [slug],
  );

  useEffect(() => {
    setHandoffFeedback(null);
    setShowAdditionalInfo(false);
  }, [reloadCount, slug]);

  useEffect(() => {
    if (!slug) {
      return;
    }

    trackAnalyticsEvent('team_detail_viewed', {
      teamSlug: slug,
    });
  }, [slug]);

  async function handleHandoff(
    handoff: ServiceHandoffResolution | ServiceHandoffFailure,
  ) {
    trackAnalyticsEvent('service_handoff_attempted', {
      surface: 'entity_detail',
      service: handoff.service,
      mode: handoff.mode,
    });
    const result = await runWithPendingRouteResume(currentResumeTarget, () => openServiceHandoff(handoff));
    if (!result.ok) {
      trackAnalyticsEvent('service_handoff_completed', {
        surface: 'entity_detail',
        service: result.service,
        mode: result.mode,
        ok: false,
        target: result.target,
        failureCode: result.code,
      });
      trackAnalyticsEvent('service_handoff_failed', {
        surface: 'entity_detail',
        service: result.service,
        mode: result.mode,
        failureCode: result.code,
        retryable: result.feedback.retryable,
      });
      trackFailureObserved(
        'entity_detail',
        classifyServiceHandoffFailureCategory(result.code),
        result.code,
        result.feedback.retryable,
      );
      setHandoffFeedback(result.feedback.message);
      return;
    }

    trackAnalyticsEvent('service_handoff_completed', {
      surface: 'entity_detail',
      service: result.service,
      mode: result.mode,
      ok: true,
      target: result.target,
      failureCode: null,
    });
    trackAnalyticsEvent('service_handoff_opened', {
      surface: 'entity_detail',
      service: result.service,
      mode: result.mode,
      target: result.target,
    });
    setHandoffFeedback(null);
  }

  async function handleExternalLink(url: string, linkType: 'official' | 'source' | 'artist_source') {
    const opened = await runWithPendingRouteResume(currentResumeTarget, () =>
      openExternalLink(normalizeExternalLinkUrl(linkType, url)),
    );
    trackAnalyticsEvent('source_link_opened', {
      surface: 'entity_detail',
      linkType,
      host: opened.ok ? opened.host : opened.host,
      ok: opened.ok,
      failureCode: opened.ok ? null : opened.code,
    });

    if (!opened.ok) {
      trackFailureObserved(
        'entity_detail',
        classifyExternalLinkFailureCategory(opened.code),
        opened.code,
        opened.feedback.retryable,
      );
      setHandoffFeedback(opened.feedback.message);
      return;
    }

    setHandoffFeedback(null);
  }

  const screenTitle = snapshot?.team.displayName ?? slug ?? 'Team Detail';

  if (!slug) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: '검색으로 이동',
            onPress: () => router.push('/(tabs)/search'),
          }}
          body="팀 slug가 없거나 잘못되어 화면을 열 수 없습니다."
          eyebrow="안전 복구"
          testID="entity-missing-state"
          title="팀 상세"
          variant="empty"
        />
      </>
    );
  }

  if (datasetState.kind === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          body="팀 요약, 다음 컴백, 최근 앨범을 불러오는 중입니다."
          eyebrow="상세 로딩"
          loadingLayout="detail"
          title="팀 상세"
          variant="loading"
        />
      </>
    );
  }

  if (datasetState.kind === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: MOBILE_COPY.action.retry,
            onPress: () => setReloadCount((count) => count + 1),
          }}
          body={datasetState.message}
          eyebrow="로드 오류"
          title="팀 상세"
          variant="error"
        />
      </>
    );
  }

  if (!snapshot || datasetState.kind !== 'ready') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: '검색으로 이동',
            onPress: () => router.push('/(tabs)/search'),
          }}
          body="해당 팀 데이터를 찾지 못했습니다."
          eyebrow="안전 복구"
          testID="entity-missing-state"
          title="팀 상세"
          variant="empty"
        />
      </>
    );
  }

  const datasetRiskDisclosure = buildDatasetRiskDisclosure(
    datasetState.source,
    '팀 상세',
    'entity-dataset-risk-notice',
  );
  const entitySourceDisclosure = buildEntitySourceDisclosure(snapshot);
  const officialLinks = buildOfficialLinks(snapshot.team);
  const latestReleaseServiceButtons: EntityServiceButtonItem[] = snapshot.latestRelease
    ? buildLatestReleaseServiceButtons(snapshot.latestRelease)
    : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={scrollContentStyle}>
      <Stack.Screen options={{ title: snapshot.team.displayName }} />

      <AppBar
        leadingAction={{
          accessibilityHint: '이전 화면으로 돌아갑니다.',
          accessibilityLabel: '뒤로 가기',
          label: '뒤로',
          onPress: () => router.back(),
          testID: 'entity-detail-back',
        }}
        subtitle={MOBILE_COPY.action.teamPage}
        testID="entity-detail-app-bar"
        title={snapshot.team.displayName}
        trailingActions={[
          {
            key: 'notifications',
            accessibilityLabel: '알림 설정 열기',
            label: MOBILE_COPY.action.notifications,
            onPress: () => router.push('/settings/notifications'),
            testID: 'entity-detail-notifications-settings',
          },
        ]}
      />

      <CompactHero
        body="다음 컴백과 최신 발매를 빠르게 확인할 수 있습니다."
        eyebrow={snapshot.team.actType.toUpperCase()}
        footer={
          <>
            {officialLinks.length > 0 ? (
              <View style={styles.linkRow}>
                {officialLinks.map((link) => (
                  <Pressable
                    key={link.key}
                    testID={`entity-official-link-${link.key}`}
                    accessibilityLabel={buildOfficialLinkAccessibilityLabel(snapshot.team, link)}
                    accessibilityHint="외부 공식 페이지를 엽니다."
                    accessibilityRole="button"
                    onPress={() => void handleExternalLink(link.url, 'official')}
                    style={({ pressed }) => [styles.metaTextLink, pressed ? styles.buttonPressed : null]}
                  >
                    <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.metaTextLinkLabel}>
                      {link.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {snapshot.team.artistSourceUrl ? (
              <Pressable
                testID="entity-artist-source-link"
                accessibilityLabel={`${snapshot.team.displayName} 아티스트 출처 열기`}
                accessibilityHint="외부 기준 소스를 엽니다."
                accessibilityRole="button"
                onPress={() => void handleExternalLink(snapshot.team.artistSourceUrl!, 'artist_source')}
                style={({ pressed }) => [styles.metaTextLink, pressed ? styles.buttonPressed : null]}
              >
                <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.metaTextLinkLabel}>
                  아티스트 출처
                </Text>
              </Pressable>
            ) : null}
          </>
        }
        media={<EntityBadge team={snapshot.team} styles={styles} />}
        meta={snapshot.team.agency ?? '소속사 정보 없음'}
        testID="entity-detail-compact-hero"
        title={snapshot.team.displayName}
        titleTestID="entity-detail-title"
      />

      {datasetRiskDisclosure ? (
        <TonalPanel
          body={datasetRiskDisclosure.body}
          footer={
            <ActionButton
              accessibilityLabel="라이브 팀 상세 데이터 다시 시도"
              label={MOBILE_COPY.action.retry}
              onPress={() => setReloadCount((count) => count + 1)}
              testID="entity-dataset-risk-retry"
              tone="secondary"
            />
          }
          testID={datasetRiskDisclosure.testID}
          title={datasetRiskDisclosure.title}
          tone="accent"
        />
      ) : null}

      {entitySourceDisclosure ? (
        <TonalPanel
          body={entitySourceDisclosure.body}
          testID={entitySourceDisclosure.testID}
          title={entitySourceDisclosure.title}
        />
      ) : null}

      <InsetSection
        description="exact 일정이 있으면 가장 가까운 컴백을 먼저 보여 줍니다."
        testID="entity-next-upcoming-section"
        title="다음 컴백"
      >
        {snapshot.nextUpcoming ? (
          <View testID="entity-next-upcoming-card" style={styles.primaryCard}>
            <View style={styles.chipRow}>
              <InfoChip label={resolveUpcomingTimingLabel(snapshot.nextUpcoming)} styles={styles} />
              <InfoChip label={resolveUpcomingStatusWithFallback(snapshot.nextUpcoming.status)} styles={styles} />
              {resolveUpcomingConfidenceChipLabel(snapshot.nextUpcoming.confidence) ? (
                <InfoChip
                  label={resolveUpcomingConfidenceChipLabel(snapshot.nextUpcoming.confidence)!}
                  styles={styles}
                />
              ) : null}
            </View>
            <Text
              allowFontScaling
              maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
              numberOfLines={2}
              style={styles.primaryCardTitle}
            >
              {snapshot.nextUpcoming.releaseLabel ?? snapshot.nextUpcoming.headline}
            </Text>
            <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.primaryCardMeta}>
              {formatUpcomingMeta(snapshot.nextUpcoming)}
            </Text>
            <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.primaryCardBody}>
              {snapshot.nextUpcoming.headline}
            </Text>
            {snapshot.nextUpcoming.sourceUrl ? (
              <Pressable
                accessibilityLabel={`${snapshot.team.displayName} 다음 컴백 출처 열기`}
                accessibilityRole="button"
                onPress={() => void handleExternalLink(snapshot.nextUpcoming!.sourceUrl!, 'source')}
                style={({ pressed }) => [styles.metaButton, pressed ? styles.buttonPressed : null]}
              >
                <Text style={styles.metaButtonLabel}>{MOBILE_COPY.action.sourceView}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.emptyCopy}>등록된 예정 컴백이 없습니다.</Text>
        )}
      </InsetSection>

      <InsetSection
        description="가장 최근 verified release를 서비스 handoff와 함께 보여 줍니다."
        testID="entity-latest-release-section"
        title="최신 발매"
      >
        {snapshot.latestRelease ? (
          <View testID="entity-latest-release-card" style={styles.releaseCard}>
            <View style={styles.releaseHeroRow}>
              <View style={styles.releaseArtwork}>
                {snapshot.latestRelease.coverImageUrl ? (
                  <Image source={{ uri: snapshot.latestRelease.coverImageUrl }} style={styles.releaseArtworkImage} />
                ) : (
                  <FallbackArt
                    height={72}
                    label={snapshot.team.badge?.monogram ?? snapshot.team.displayName.slice(0, 2).toUpperCase()}
                    testID="entity-latest-release-fallback-art"
                    variant="cover"
                    width={72}
                  />
                )}
              </View>
              <View style={styles.releaseCopy}>
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
                  numberOfLines={2}
                  style={styles.primaryCardTitle}
                >
                  {snapshot.latestRelease.releaseTitle}
                </Text>
                <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.primaryCardMeta}>
                  {formatReleaseMeta(snapshot.latestRelease)}
                </Text>
                <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.primaryCardBody}>
                  {snapshot.latestRelease.representativeSongTitle ?? '상세 화면으로 이동'}
                </Text>
                <View style={styles.chipRow}>
                  <InfoChip label={getReleaseKindLabel(snapshot.latestRelease)} styles={styles} />
                </View>
              </View>
            </View>
            <Pressable
              testID="entity-latest-release-primary"
              accessibilityLabel={`${snapshot.latestRelease.releaseTitle} 릴리즈 상세 보기`}
              accessibilityRole="button"
              onPress={() => {
                trackAnalyticsEvent('team_detail_latest_release_opened', {
                  teamSlug: snapshot.team.slug,
                  releaseId: snapshot.latestRelease!.id,
                });
                router.push({
                  pathname: '/releases/[id]',
                  params: { id: snapshot.latestRelease!.id },
                });
              }}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.primaryButtonLabel}>{MOBILE_COPY.action.detailView}</Text>
            </Pressable>
            <ServiceButtonGroup
              buttons={latestReleaseServiceButtons.map((button) => ({
                ...button,
                onPress: () => void handleHandoff(button.handoff),
              }))}
              testID="entity-latest-release-service-buttons"
            />
            {snapshot.latestRelease.sourceUrl ? (
              <Pressable
                accessibilityLabel={`${snapshot.latestRelease.releaseTitle} 발매 출처 열기`}
                accessibilityRole="button"
                onPress={() => void handleExternalLink(snapshot.latestRelease!.sourceUrl!, 'source')}
                style={({ pressed }) => [styles.metaTextLink, pressed ? styles.buttonPressed : null]}
                testID="entity-latest-release-source-link"
              >
                <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.metaTextLinkLabel}>
                  {MOBILE_COPY.action.sourceView}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <InlineFeedbackNotice body="최신 발매 정보가 없습니다." />
        )}
        {handoffFeedback ? (
          <InlineFeedbackNotice
            body={handoffFeedback}
            testID="entity-latest-release-handoff-feedback"
            title={MOBILE_COPY.feedback.handoffFailedTitle}
            tone="error"
          />
        ) : null}
      </InsetSection>

      <InsetSection
        description="full release history 중 최근 앨범을 우선 노출합니다."
        testID="entity-recent-albums-section"
        title="최근 앨범들"
      >
        {snapshot.recentAlbums.length === 1 ? (
          <Pressable
            testID={`entity-recent-album-single-card-${snapshot.recentAlbums[0]!.id}`}
            accessibilityLabel={`${snapshot.recentAlbums[0]!.releaseTitle} 릴리즈 상세 열기`}
            accessibilityRole="button"
            onPress={() => {
              trackAnalyticsEvent('team_detail_album_opened', {
                teamSlug: snapshot.team.slug,
                releaseId: snapshot.recentAlbums[0]!.id,
              });
              router.push({
                pathname: '/releases/[id]',
                params: { id: snapshot.recentAlbums[0]!.id },
              });
            }}
            style={({ pressed }) => [styles.singleAlbumCard, pressed ? styles.buttonPressed : null]}
          >
            <View style={styles.singleAlbumArtwork}>
              {snapshot.recentAlbums[0]!.coverImageUrl ? (
                <Image source={{ uri: snapshot.recentAlbums[0]!.coverImageUrl }} style={styles.albumArtworkImage} />
              ) : (
                <FallbackArt
                  height={88}
                  label={snapshot.team.badge?.monogram ?? snapshot.team.displayName.slice(0, 2).toUpperCase()}
                  testID="entity-single-album-fallback-art"
                  variant="cover"
                  width={88}
                />
              )}
            </View>
            <View style={styles.singleAlbumCopy}>
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
                numberOfLines={2}
                style={styles.albumTitle}
              >
                {snapshot.recentAlbums[0]!.releaseTitle}
              </Text>
              <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.albumMeta}>
                {formatReleaseMeta(snapshot.recentAlbums[0]!)}
              </Text>
            </View>
          </Pressable>
        ) : snapshot.recentAlbums.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRow}>
            {snapshot.recentAlbums.map((release) => (
              <Pressable
                key={release.id}
                testID={`entity-recent-album-card-${release.id}`}
                accessibilityLabel={`${release.releaseTitle} 릴리즈 상세 열기`}
                accessibilityRole="button"
                onPress={() => {
                  trackAnalyticsEvent('team_detail_album_opened', {
                    teamSlug: snapshot.team.slug,
                    releaseId: release.id,
                  });
                  router.push({
                    pathname: '/releases/[id]',
                    params: { id: release.id },
                  });
                }}
                style={({ pressed }) => [styles.albumCard, pressed ? styles.buttonPressed : null]}
              >
                <View style={styles.albumArtwork}>
                  {release.coverImageUrl ? (
                    <Image source={{ uri: release.coverImageUrl }} style={styles.albumArtworkImage} />
                  ) : (
                    <FallbackArt
                      height={96}
                      label={snapshot.team.badge?.monogram ?? snapshot.team.displayName.slice(0, 2).toUpperCase()}
                      variant="cover"
                      width={96}
                    />
                  )}
                </View>
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
                  numberOfLines={2}
                  style={styles.albumTitle}
                >
                  {release.releaseTitle}
                </Text>
                <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.albumMeta}>
                  {formatReleaseMeta(release)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <InlineFeedbackNotice body="등록된 최근 앨범이 없습니다." />
        )}
      </InsetSection>

      {snapshot.sourceTimeline.length > 0 ? (
        <InsetSection
          description="artist source와 release/upcoming source를 묶어 보여 줍니다."
          testID="entity-source-timeline-section"
          title="추가 정보"
        >
          <Pressable
            accessibilityLabel={showAdditionalInfo ? MOBILE_COPY.action.hideSourceTimeline : MOBILE_COPY.action.showSourceTimeline}
            accessibilityRole="button"
            onPress={() => setShowAdditionalInfo((value) => !value)}
            style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
            testID="entity-source-timeline-toggle"
          >
            <Text style={styles.secondaryButtonLabel}>
              {showAdditionalInfo ? MOBILE_COPY.action.hideSourceTimeline : MOBILE_COPY.action.showSourceTimeline}
            </Text>
          </Pressable>
          {showAdditionalInfo ? (
            <View testID="entity-source-timeline" style={styles.timelineList}>
              {snapshot.sourceTimeline.map((item) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCopy}>
                    <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.timelineTitle}>
                      {item.title}
                    </Text>
                    <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.timelineMeta}>
                      {item.meta}
                    </Text>
                  </View>
                  {item.sourceUrl ? (
                    <Pressable
                      accessibilityLabel={`${item.title} 소스 링크 열기`}
                      accessibilityRole="button"
                      onPress={() => void handleExternalLink(item.sourceUrl!, 'source')}
                      style={({ pressed }) => [styles.metaButton, pressed ? styles.buttonPressed : null]}
                    >
                      <Text style={styles.metaButtonLabel}>{MOBILE_COPY.action.open}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </InsetSection>
      ) : null}
    </ScrollView>
  );
}

function InfoChip({
  label,
  styles,
}: {
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipLabel}>{label}</Text>
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
      paddingHorizontal: theme.space[20],
      paddingTop: theme.space[16],
      paddingBottom: theme.space[32],
      gap: theme.space[16],
    },
    heroBlock: {
      gap: theme.space[12],
    },
    heroCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: theme.space[16],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    heroImage: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.subtle,
    },
    heroMonogramWrap: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.card,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface.interactive,
    },
    heroMonogram: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text.brand,
    },
    heroCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
    heroMeta: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
    },
    heroBody: {
      marginTop: theme.space[4],
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
    },
    linkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    metaTextLink: {
      alignSelf: 'flex-start',
      minHeight: 36,
      justifyContent: 'center',
    },
    metaTextLinkLabel: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.secondary,
      textDecorationLine: 'underline',
      flexShrink: 1,
    },
    infoChip: {
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    infoChipLabel: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.secondary,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    primaryButton: {
      minHeight: theme.size.button.heightPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.text.brand,
    },
    primaryButtonLabel: {
      fontSize: theme.typography.buttonPrimary.fontSize,
      lineHeight: theme.typography.buttonPrimary.lineHeight,
      fontWeight: '700',
      color: theme.colors.text.inverse,
      flexShrink: 1,
      textAlign: 'center',
    },
    secondaryButton: {
      alignSelf: 'flex-start',
      minHeight: theme.size.button.heightSecondary,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    secondaryButtonLabel: {
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: '600',
      color: theme.colors.text.primary,
      flexShrink: 1,
      textAlign: 'center',
    },
    sectionCard: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    sectionTitle: {
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
    primaryCard: {
      gap: theme.space[8],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
    },
    primaryCardTitle: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
    primaryCardMeta: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.secondary,
    },
    primaryCardBody: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
    },
    releaseCard: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
    },
    releaseHeroRow: {
      flexDirection: 'row',
      gap: theme.space[12],
    },
    releaseArtwork: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface.subtle,
      overflow: 'hidden',
    },
    releaseArtworkImage: {
      width: '100%',
      height: '100%',
    },
    releaseArtworkFallback: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text.brand,
    },
    releaseCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    albumRow: {
      gap: theme.space[12],
      paddingRight: theme.space[8],
    },
    singleAlbumCard: {
      flexDirection: 'row',
      gap: theme.space[12],
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
    },
    singleAlbumArtwork: {
      width: 72,
      aspectRatio: 1,
      borderRadius: theme.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface.subtle,
      overflow: 'hidden',
    },
    singleAlbumCopy: {
      flex: 1,
      gap: theme.space[4],
      justifyContent: 'center',
    },
    albumCard: {
      width: '52%',
      minWidth: 188,
      gap: theme.space[8],
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
    },
    albumArtwork: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: theme.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface.subtle,
      overflow: 'hidden',
    },
    albumArtworkImage: {
      width: '100%',
      height: '100%',
    },
    albumArtworkFallback: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text.brand,
    },
    albumTitle: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
    albumMeta: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.secondary,
    },
    timelineList: {
      gap: theme.space[12],
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[12],
    },
    timelineDot: {
      width: 10,
      height: 10,
      marginTop: 6,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.text.brand,
    },
    timelineCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    timelineTitle: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    timelineMeta: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.secondary,
    },
    metaButton: {
      minHeight: theme.size.button.heightSecondary,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    metaButtonLabel: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.secondary,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'center',
    },
    emptyCopy: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.space[24],
      backgroundColor: theme.colors.surface.base,
      gap: theme.space[12],
    },
    eyebrow: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      letterSpacing: 1.2,
      fontWeight: '700',
      color: theme.colors.text.brand,
    },
    title: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
    body: {
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
    },
    retryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.text.brand,
    },
    retryButtonLabel: {
      fontSize: theme.typography.buttonPrimary.fontSize,
      lineHeight: theme.typography.buttonPrimary.lineHeight,
      fontWeight: '700',
      color: theme.colors.text.inverse,
    },
    buttonPressed: {
      opacity: 0.76,
    },
  });
}
