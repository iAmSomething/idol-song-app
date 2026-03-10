import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
} from 'react-native';

import {
  InlineFeedbackNotice,
  ScreenFeedbackState,
} from '../../src/components/feedback/FeedbackState';
import { AppBar } from '../../src/components/layout/AppBar';
import {
  ServiceButtonGroup,
  type ServiceButtonGroupItem,
} from '../../src/components/actions/ServiceButtonGroup';
import { SourceLinkRow } from '../../src/components/meta/SourceLinkRow';
import { TeamIdentityRow } from '../../src/components/identity/TeamIdentityRow';
import { TrackRow } from '../../src/components/release/TrackRow';
import {
  buildDatasetRiskDisclosure,
  buildReleaseDependencyDisclosure,
} from '../../src/features/surfaceDisclosures';
import { useActiveDatasetScreen } from '../../src/features/useActiveDatasetScreen';
import { selectReleaseDetailById } from '../../src/selectors';
import { getFeatureGateState } from '../../src/config/featureGates';
import { loadActiveMobileDataset } from '../../src/services/activeDataset';
import { adaptBackendReleaseDetail } from '../../src/services/backendDisplayAdapters';
import {
  BackendReadError,
  type BackendReadClient,
} from '../../src/services/backendReadClient';
import { cloneBundledDatasetFixture } from '../../src/services/bundledDatasetFixture';
import {
  openServiceHandoff,
  resolveServiceHandoff,
  resolveServiceHandoffGroup,
  type ServiceHandoffFailure,
  type ServiceHandoffResolution,
} from '../../src/services/handoff';
import {
  trackAnalyticsEvent,
} from '../../src/services/analytics';
import { useAppTheme } from '../../src/tokens/theme';
import type { MobileTheme } from '../../src/tokens/theme';
import type { ReleaseDetailModel, TrackModel, YoutubeVideoStatus } from '../../src/types';

type ReleaseServiceButtonItem = ServiceButtonGroupItem & {
  handoff: ServiceHandoffResolution | ServiceHandoffFailure;
};

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getReleaseKindLabel(detail: ReleaseDetailModel): string {
  if (detail.releaseKind?.trim()) {
    return detail.releaseKind.trim().toUpperCase();
  }

  if (detail.stream === 'song') {
    return 'SONG';
  }

  if (detail.stream === 'album') {
    return 'ALBUM';
  }

  return 'RELEASE';
}

function getCoverMonogram(detail: ReleaseDetailModel): string {
  const token = detail.displayGroup.trim() || detail.releaseTitle.trim();
  return token.slice(0, 2).toUpperCase();
}

function resolveYoutubeMvUrl(detail: ReleaseDetailModel): string | null {
  if (detail.youtubeVideoUrl) {
    return detail.youtubeVideoUrl;
  }

  if (detail.youtubeVideoId) {
    return `https://www.youtube.com/watch?v=${detail.youtubeVideoId}`;
  }

  return null;
}

function formatReleaseMeta(detail: ReleaseDetailModel): string {
  return `${detail.releaseDate} · ${getReleaseKindLabel(detail)}`;
}

function getMvStatusCopy(status?: YoutubeVideoStatus): string | null {
  switch (status) {
    case 'manual_override':
      return '공식 MV 링크가 정리됐지만 앱 임베드 대신 외부 재생으로 엽니다.';
    case 'relation_match':
      return '공식 MV가 확인돼 외부 서비스로 바로 열 수 있습니다.';
    case 'needs_review':
      return '공식 MV 후보가 있어도 아직 검토가 끝나지 않았습니다.';
    case 'no_mv':
      return '현재는 공식 MV가 등록되지 않았습니다.';
    case 'unresolved':
      return '공식 MV가 아직 확정되지 않았습니다.';
    default:
      return null;
  }
}

function buildAlbumServiceButtons(detail: ReleaseDetailModel): ReleaseServiceButtonItem[] {
  const query = `${detail.displayGroup} ${detail.releaseTitle}`;
  const handoffs = resolveServiceHandoffGroup({
    query,
    spotifyUrl: detail.spotifyUrl,
    youtubeMusicUrl: detail.youtubeMusicUrl,
    youtubeMvUrl: resolveYoutubeMvUrl(detail),
  });

  const buttons: ReleaseServiceButtonItem[] = [
    {
      accessibilityLabel: `Spotify에서 ${detail.releaseTitle} 열기`,
      key: 'spotify',
      label: 'Spotify',
      handoff: handoffs.spotify,
      testID: 'release-service-spotify',
      tone: 'spotify',
    },
    {
      accessibilityLabel: `YouTube Music에서 ${detail.releaseTitle} 열기`,
      key: 'youtubeMusic',
      label: 'YouTube Music',
      handoff: handoffs.youtubeMusic,
      testID: 'release-service-youtube-music',
      tone: 'youtubeMusic',
    },
    {
      accessibilityLabel: `YouTube에서 ${detail.releaseTitle} 공식 MV 열기`,
      key: 'youtubeMv',
      label: 'YouTube MV',
      handoff: handoffs.youtubeMv,
      testID: 'release-service-youtube-mv',
      tone: 'youtubeMv',
    },
  ];

  return buttons.filter((item) => item.key !== 'youtubeMv' || resolveYoutubeMvUrl(detail) !== null);
}

function buildTrackServiceButtons(detail: ReleaseDetailModel, track: TrackModel): ReleaseServiceButtonItem[] {
  const query = `${detail.displayGroup} ${track.title}`;

  return [
    {
      accessibilityLabel: `Spotify에서 ${track.title} 트랙 열기`,
      key: 'spotify',
      label: 'Spotify',
      handoff: resolveServiceHandoff({
        service: 'spotify',
        query,
        canonicalUrl: track.spotifyUrl,
      }),
      service: 'spotify',
      testID: `release-track-${track.order}-spotify`,
      tone: 'spotify',
    },
    {
      accessibilityLabel: `YouTube Music에서 ${track.title} 트랙 열기`,
      key: 'youtubeMusic',
      label: 'YouTube Music',
      handoff: resolveServiceHandoff({
        service: 'youtubeMusic',
        query,
        canonicalUrl: track.youtubeMusicUrl,
      }),
      service: 'youtubeMusic',
      testID: `release-track-${track.order}-youtube-music`,
      tone: 'youtubeMusic',
    },
  ];
}

function ReleaseCover({
  detail,
  styles,
}: {
  detail: ReleaseDetailModel;
  styles: ReturnType<typeof createStyles>;
}) {
  if (detail.coverImageUrl) {
    return <Image source={{ uri: detail.coverImageUrl }} style={styles.coverImage} />;
  }

  return (
    <View style={styles.coverFallback}>
      <Text style={styles.coverFallbackText}>{getCoverMonogram(detail)}</Text>
    </View>
  );
}

async function openExternalUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // Keep the current route stack stable when external handoff fails.
  }
}

export default function ReleaseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const releaseId = getSingleParam(params.id)?.trim() ?? '';
  const [reloadCount, setReloadCount] = useState(0);
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null);
  const bundledProfiles = useMemo(() => cloneBundledDatasetFixture().artistProfiles, []);
  const loadBundledDetail = useCallback(async () => {
    const activeDataset = await loadActiveMobileDataset();
    return releaseId ? selectReleaseDetailById(activeDataset.dataset, releaseId) : null;
  }, [releaseId]);
  const loadBackendDetail = useCallback(
    async (client: BackendReadClient) => {
      if (!releaseId) {
        return {
          data: null,
          generatedAt: null,
        };
      }

      try {
        const resolved = await client.getReleaseDetailByLegacyId(releaseId);
        return {
          data: adaptBackendReleaseDetail(resolved.detail.data),
          generatedAt: resolved.detail.meta?.generatedAt ?? resolved.lookup.meta?.generatedAt ?? null,
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
    [releaseId],
  );
  const datasetState = useActiveDatasetScreen({
    surface: 'release_detail',
    reloadKey: reloadCount,
    cacheKey: `release:${releaseId || 'missing'}`,
    fallbackErrorMessage: '릴리즈 상세 데이터를 불러오지 못했습니다.',
    loadBundled: loadBundledDetail,
    loadBackend: loadBackendDetail,
  });
  const detail = datasetState.kind === 'ready' ? datasetState.source.data : null;
  const teamProfile =
    detail
      ? bundledProfiles.find((profile) => profile.slug === detail.group || profile.group === detail.group) ?? null
      : null;

  useEffect(() => {
    setHandoffFeedback(null);
  }, [releaseId, reloadCount]);

  async function handleHandoff(
    handoff: ServiceHandoffResolution | ServiceHandoffFailure,
  ) {
    trackAnalyticsEvent('service_handoff_attempted', {
      surface: 'release_detail',
      service: handoff.service,
      mode: handoff.mode,
    });
    const result = await openServiceHandoff(handoff);
    trackAnalyticsEvent('service_handoff_completed', {
      surface: 'release_detail',
      service: result.service,
      mode: result.mode,
      ok: result.ok,
      target: result.target ?? null,
      failureCode: result.ok ? null : result.code,
    });

    if (!result.ok) {
      setHandoffFeedback(result.feedback.message);
      return;
    }

    setHandoffFeedback(null);
  }

  const screenTitle = detail?.releaseTitle ?? releaseId ?? 'Release Detail';

  if (!releaseId) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: '이전 화면으로',
            onPress: () => router.back(),
          }}
          body="릴리즈 ID가 없거나 잘못되어 상세 화면을 열 수 없습니다."
          eyebrow="MISSING DETAIL"
          testID="release-missing-state"
          title="Release Detail"
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
          body="앨범 액션, 트랙 리스트, MV 상태를 불러오는 중입니다."
          eyebrow="DETAIL LOADING"
          title="Release Detail"
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
            label: '다시 시도',
            onPress: () => setReloadCount((count) => count + 1),
          }}
          body={datasetState.message}
          eyebrow="LOAD ERROR"
          title="Release Detail"
          variant="error"
        />
      </>
    );
  }

  if (!detail || datasetState.kind !== 'ready') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: '이전 화면으로',
            onPress: () => router.back(),
          }}
          body="해당 릴리즈 상세 데이터를 찾지 못했습니다."
          eyebrow="MISSING DETAIL"
          testID="release-missing-state"
          title="Release Detail"
          variant="empty"
        />
      </>
    );
  }

  const datasetRiskDisclosure = buildDatasetRiskDisclosure(
    datasetState.source,
    '릴리즈 상세',
    'release-dataset-risk-notice',
  );
  const releaseDependencyDisclosure = buildReleaseDependencyDisclosure(detail);
  const albumServiceButtons = buildAlbumServiceButtons(detail);
  const mvUrl = resolveYoutubeMvUrl(detail);
  const mvStatusCopy = getMvStatusCopy(detail.youtubeVideoStatus);
  const mvEmbedGate = getFeatureGateState('mvEmbed');
  const supportingLinks = [
    detail.sourceUrl
      ? {
          key: 'release-source',
          label: '출처 보기',
          onPress: () => void openExternalUrl(detail.sourceUrl!),
          type: 'source' as const,
          url: detail.sourceUrl,
        }
      : null,
  ].filter((link): link is NonNullable<typeof link> => link !== null);
  const hasSupportingInfo = Boolean(detail.notes) || supportingLinks.length > 0;
  const mvDisclosure =
    mvUrl && !mvEmbedGate.enabled
      ? '이 빌드에서는 앱 내 MV 임베드를 끄고 외부 YouTube 재생만 제공합니다.'
      : mvStatusCopy ?? '공식 MV를 외부 YouTube에서 바로 열 수 있습니다.';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: detail.releaseTitle }} />

      <AppBar
        leadingAction={{
          accessibilityHint: '이전 화면으로 돌아갑니다.',
          accessibilityLabel: '이전으로',
          label: '이전으로',
          onPress: () => router.back(),
          testID: 'release-appbar-back',
        }}
        testID="release-appbar"
        title={detail.releaseTitle}
        titleTestID="release-detail-appbar-title"
        trailingActions={
          teamProfile
            ? [
                {
                  key: 'team-page',
                  accessibilityLabel: `${detail.displayGroup} 팀 페이지 열기`,
                  label: '팀 페이지',
                  onPress: () => router.push(`/artists/${teamProfile.slug}`),
                  testID: 'release-appbar-team-page',
                },
              ]
            : []
        }
      />

      <Text style={styles.eyebrow}>{datasetState.source.sourceLabel}</Text>

      {datasetRiskDisclosure ? (
        <InlineFeedbackNotice
          body={datasetRiskDisclosure.body}
          testID={datasetRiskDisclosure.testID}
          title={datasetRiskDisclosure.title}
        />
      ) : null}

      <View style={styles.heroCard}>
        <ReleaseCover detail={detail} styles={styles} />
        <View style={styles.heroCopy}>
          <Text accessibilityRole="header" style={styles.releaseTitle} testID="release-detail-title">
            {detail.releaseTitle}
          </Text>
          <Text style={styles.releaseMeta}>{formatReleaseMeta(detail)}</Text>
          <View style={styles.identityRow}>
            <View style={styles.kindChip}>
              <Text style={styles.kindChipLabel}>{getReleaseKindLabel(detail)}</Text>
            </View>
          </View>
          <TeamIdentityRow
            badgeImageUrl={teamProfile?.badge_image_url ?? teamProfile?.representative_image_url ?? undefined}
            monogram={detail.displayGroup.slice(0, 2).toUpperCase()}
            name={detail.displayGroup}
            testID="release-team-identity"
          />
        </View>
      </View>

      <View style={styles.section} testID="release-album-actions-section">
        <Text accessibilityRole="header" style={styles.sectionTitle}>앨범 액션</Text>
        <ServiceButtonGroup
          buttons={albumServiceButtons.map((button) => ({
            ...button,
            onPress: () => void handleHandoff(button.handoff),
          }))}
          testID="release-service-buttons"
        />
      </View>

      {handoffFeedback ? (
        <InlineFeedbackNotice body={handoffFeedback} testID="release-handoff-feedback" tone="error" />
      ) : null}

      {releaseDependencyDisclosure ? (
        <InlineFeedbackNotice
          body={releaseDependencyDisclosure.body}
          testID={releaseDependencyDisclosure.testID}
          title={releaseDependencyDisclosure.title}
        />
      ) : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>트랙 리스트</Text>
        {detail.tracks.length > 0 ? (
          <View style={styles.trackList}>
            {detail.tracks.map((track) => (
              (() => {
                const trackButtons = buildTrackServiceButtons(detail, track);
                const spotifyButton = trackButtons.find((button) => button.service === 'spotify');
                const youtubeMusicButton = trackButtons.find((button) => button.service === 'youtubeMusic');

                return (
                  <TrackRow
                    key={`${detail.id}-${track.order}`}
                    isTitleTrack={track.isTitleTrack}
                    order={track.order}
                    spotifyButton={
                      spotifyButton
                        ? {
                            accessibilityHint: spotifyButton.accessibilityHint,
                            accessibilityLabel: spotifyButton.accessibilityLabel,
                            disabled: spotifyButton.disabled,
                            label: spotifyButton.label,
                            mode: spotifyButton.mode,
                            onPress: () => void handleHandoff(spotifyButton.handoff),
                            testID: spotifyButton.testID,
                          }
                        : undefined
                    }
                    testIDPrefix="release-track-row"
                    title={track.title}
                    youtubeMusicButton={
                      youtubeMusicButton
                        ? {
                            accessibilityHint: youtubeMusicButton.accessibilityHint,
                            accessibilityLabel: youtubeMusicButton.accessibilityLabel,
                            disabled: youtubeMusicButton.disabled,
                            label: youtubeMusicButton.label,
                            mode: youtubeMusicButton.mode,
                            onPress: () => void handleHandoff(youtubeMusicButton.handoff),
                            testID: youtubeMusicButton.testID,
                          }
                        : undefined
                    }
                  />
                );
              })()
            ))}
          </View>
        ) : (
          <InlineFeedbackNotice
            body="이 릴리즈에는 신뢰 가능한 canonical tracklist가 아직 연결되지 않았습니다. placeholder 트랙은 표시하지 않습니다."
            testID="release-empty-tracks"
          />
        )}
      </View>

      <View style={styles.section} testID="release-supporting-info">
        <Text accessibilityRole="header" style={styles.sectionTitle}>추가 정보</Text>
        {hasSupportingInfo ? (
          <>
            {detail.notes ? (
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>메모</Text>
                <Text style={styles.metaBody}>{detail.notes}</Text>
              </View>
            ) : null}
            {supportingLinks.length > 0 ? (
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>출처</Text>
                <SourceLinkRow links={supportingLinks} testID="release-supporting-links" />
              </View>
            ) : null}
          </>
        ) : (
          <InlineFeedbackNotice
            body="추가 메타데이터와 출처 링크는 아직 정리되지 않았습니다."
            testID="release-supporting-info-empty"
          />
        )}
      </View>

      {mvUrl ? (
        <View style={styles.section} testID="release-mv-card">
          <Text accessibilityRole="header" style={styles.sectionTitle}>공식 MV</Text>
          <View style={styles.metaCard}>
            <Text style={styles.metaBody}>{mvDisclosure}</Text>
            <ServiceButtonGroup
              buttons={[
                {
                  accessibilityLabel: `YouTube에서 ${detail.releaseTitle} 공식 MV 열기`,
                  key: 'youtubeMv',
                  label: 'YouTube MV',
                  onPress: () =>
                    void handleHandoff(
                      resolveServiceHandoff({
                        service: 'youtubeMv',
                        query: `${detail.displayGroup} ${detail.releaseTitle}`,
                        canonicalUrl: mvUrl,
                      }),
                    ),
                  testID: 'release-mv-button',
                  tone: 'youtubeMv',
                },
              ]}
              testID="release-mv-button-group"
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.surface.base,
    },
    content: {
      paddingHorizontal: theme.space[20],
      paddingTop: theme.space[24],
      paddingBottom: theme.space[32],
      gap: theme.space[20],
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.space[24],
      backgroundColor: theme.colors.surface.base,
    },
    eyebrow: {
      ...theme.typography.meta,
      marginBottom: theme.space[8],
      color: theme.colors.text.brand,
      textTransform: 'uppercase',
    },
    stateTitle: {
      ...theme.typography.screenTitle,
      marginBottom: theme.space[12],
      color: theme.colors.text.primary,
    },
    stateBody: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    retryButton: {
      alignSelf: 'flex-start',
      marginTop: theme.space[16],
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
    },
    retryButtonLabel: {
      ...theme.typography.buttonPrimary,
      color: theme.colors.text.primary,
    },
    heroCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[16],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    coverImage: {
      width: 120,
      height: 120,
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.subtle,
    },
    coverFallback: {
      width: 120,
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    coverFallbackText: {
      ...theme.typography.screenTitle,
      color: theme.colors.text.brand,
    },
    heroCopy: {
      flex: 1,
      justifyContent: 'space-between',
      gap: theme.space[8],
    },
    releaseTitle: {
      ...theme.typography.screenTitle,
      color: theme.colors.text.primary,
    },
    releaseMeta: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
      flexWrap: 'wrap',
    },
    kindChip: {
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.interactive,
    },
    kindChipLabel: {
      ...theme.typography.chip,
      color: theme.colors.text.brand,
    },
    section: {
      gap: theme.space[12],
    },
    sectionTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    feedbackCard: {
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    feedbackText: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
    trackList: {
      gap: theme.space[12],
    },
    emptyCard: {
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    emptyCardText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    metaCard: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    metaBody: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    metaLabel: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
      textTransform: 'uppercase',
    },
    metaSubtle: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
  });
}
