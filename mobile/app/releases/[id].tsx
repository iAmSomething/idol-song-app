import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { selectReleaseDetailById } from '../../src/selectors';
import {
  loadActiveMobileDataset,
  type ActiveMobileDataset,
} from '../../src/services/activeDataset';
import {
  openServiceHandoff,
  resolveServiceHandoff,
  resolveServiceHandoffGroup,
  type MusicService,
  type ServiceHandoffFailure,
  type ServiceHandoffResolution,
} from '../../src/services/handoff';
import { useAppTheme } from '../../src/tokens/theme';
import type { MobileTheme } from '../../src/tokens/theme';
import type { ReleaseDetailModel, TrackModel, YoutubeVideoStatus } from '../../src/types';

type ReleaseDetailScreenState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'missing'; reason: string }
  | { kind: 'ready'; source: ActiveMobileDataset; detail: ReleaseDetailModel };

type ServiceButtonSpec = {
  key: MusicService;
  label: string;
  handoff: ServiceHandoffResolution | ServiceHandoffFailure;
  testID: string;
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

function buildAlbumServiceButtons(detail: ReleaseDetailModel): ServiceButtonSpec[] {
  const query = `${detail.displayGroup} ${detail.releaseTitle}`;
  const handoffs = resolveServiceHandoffGroup({
    query,
    spotifyUrl: detail.spotifyUrl,
    youtubeMusicUrl: detail.youtubeMusicUrl,
    youtubeMvUrl: resolveYoutubeMvUrl(detail),
  });

  const buttons: ServiceButtonSpec[] = [
    {
      key: 'spotify',
      label: 'Spotify',
      handoff: handoffs.spotify,
      testID: 'release-service-spotify',
    },
    {
      key: 'youtubeMusic',
      label: 'YouTube Music',
      handoff: handoffs.youtubeMusic,
      testID: 'release-service-youtube-music',
    },
    {
      key: 'youtubeMv',
      label: 'YouTube MV',
      handoff: handoffs.youtubeMv,
      testID: 'release-service-youtube-mv',
    },
  ];

  return buttons.filter((item) => item.key !== 'youtubeMv' || resolveYoutubeMvUrl(detail) !== null);
}

function buildTrackServiceButtons(detail: ReleaseDetailModel, track: TrackModel): ServiceButtonSpec[] {
  const query = `${detail.displayGroup} ${track.title}`;

  return [
    {
      key: 'spotify',
      label: 'Spotify',
      handoff: resolveServiceHandoff({
        service: 'spotify',
        query,
        canonicalUrl: track.spotifyUrl,
      }),
      testID: `release-track-${track.order}-spotify`,
    },
    {
      key: 'youtubeMusic',
      label: 'YT Music',
      handoff: resolveServiceHandoff({
        service: 'youtubeMusic',
        query,
        canonicalUrl: track.youtubeMusicUrl,
      }),
      testID: `release-track-${track.order}-youtube-music`,
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

function ServiceButton({
  label,
  onPress,
  styles,
  tone,
  testID,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  tone: 'spotify' | 'youtubeMusic' | 'youtubeMv';
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.serviceButton, styles[`${tone}Button`]]}
      testID={testID}
    >
      <Text style={[styles.serviceButtonLabel, styles[`${tone}ButtonLabel`]]}>{label}</Text>
    </Pressable>
  );
}

export default function ReleaseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const releaseId = getSingleParam(params.id)?.trim() ?? '';
  const [reloadCount, setReloadCount] = useState(0);
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null);
  const [state, setState] = useState<ReleaseDetailScreenState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    if (!releaseId) {
      setState({
        kind: 'missing',
        reason: '릴리즈 ID가 없거나 잘못되어 상세 화면을 열 수 없습니다.',
      });
      return () => {
        cancelled = true;
      };
    }

    setHandoffFeedback(null);
    setState({ kind: 'loading' });

    void loadActiveMobileDataset()
      .then((source) => {
        if (cancelled) {
          return;
        }

        const detail = selectReleaseDetailById(source.dataset, releaseId);
        if (!detail) {
          setState({
            kind: 'missing',
            reason: '해당 릴리즈 상세 데이터를 찾지 못했습니다.',
          });
          return;
        }

        setState({
          kind: 'ready',
          source,
          detail,
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
              : '릴리즈 상세 데이터를 불러오지 못했습니다.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [releaseId, reloadCount]);

  async function handleHandoff(
    handoff: ServiceHandoffResolution | ServiceHandoffFailure,
  ) {
    const result = await openServiceHandoff(handoff);

    if (!result.ok) {
      setHandoffFeedback(result.feedback.message);
      return;
    }

    setHandoffFeedback(null);
  }

  const screenTitle =
    state.kind === 'ready' ? state.detail.releaseTitle : releaseId || 'Release Detail';

  if (state.kind === 'loading') {
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

  if (state.kind === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: '다시 시도',
            onPress: () => setReloadCount((count) => count + 1),
          }}
          body={state.message}
          eyebrow="LOAD ERROR"
          title="Release Detail"
          variant="error"
        />
      </>
    );
  }

  if (state.kind === 'missing') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          action={{
            label: '이전 화면으로',
            onPress: () => router.back(),
          }}
          body={state.reason}
          eyebrow="MISSING DETAIL"
          testID="release-missing-state"
          title="Release Detail"
          variant="empty"
        />
      </>
    );
  }

  const { detail, source } = state;
  const albumServiceButtons = buildAlbumServiceButtons(detail);
  const mvUrl = resolveYoutubeMvUrl(detail);
  const mvStatusCopy = getMvStatusCopy(detail.youtubeVideoStatus);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: detail.releaseTitle }} />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonLabel}>뒤로</Text>
      </Pressable>

      <Text style={styles.eyebrow}>{source.sourceLabel}</Text>

      <View style={styles.heroCard}>
        <ReleaseCover detail={detail} styles={styles} />
        <View style={styles.heroCopy}>
          <Text style={styles.releaseTitle} testID="release-detail-title">
            {detail.releaseTitle}
          </Text>
          <Text style={styles.releaseMeta}>{formatReleaseMeta(detail)}</Text>
          <View style={styles.identityRow}>
            <View style={styles.kindChip}>
              <Text style={styles.kindChipLabel}>{getReleaseKindLabel(detail)}</Text>
            </View>
            <Text style={styles.groupLabel}>{detail.displayGroup}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앨범 액션</Text>
        <View style={styles.serviceButtonRow}>
          {albumServiceButtons.map((button) => (
            <ServiceButton
              key={button.key}
              label={button.label}
              onPress={() => void handleHandoff(button.handoff)}
              styles={styles}
              tone={button.key}
              testID={button.testID}
            />
          ))}
        </View>
      </View>

      {handoffFeedback ? (
        <InlineFeedbackNotice body={handoffFeedback} testID="release-handoff-feedback" tone="error" />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>트랙 리스트</Text>
        {detail.tracks.length > 0 ? (
          <View style={styles.trackList}>
            {detail.tracks.map((track) => (
              <View
                key={`${detail.id}-${track.order}`}
                style={styles.trackRow}
                testID={`release-track-row-${track.order}`}
              >
                <Text style={styles.trackOrder}>{track.order}</Text>
                <View style={styles.trackCopy}>
                  <View style={styles.trackTitleRow}>
                    <Text style={styles.trackTitle}>{track.title}</Text>
                    {track.isTitleTrack ? (
                      <View
                        style={styles.titleTrackBadge}
                        testID={`release-track-title-badge-${track.order}`}
                      >
                        <Text style={styles.titleTrackBadgeLabel}>타이틀</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.trackServiceButtons}>
                  {buildTrackServiceButtons(detail, track).map((button) => (
                    <ServiceButton
                      key={`${track.order}-${button.key}`}
                      label={button.label}
                      onPress={() => void handleHandoff(button.handoff)}
                      styles={styles}
                      tone={button.key}
                      testID={button.testID}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <InlineFeedbackNotice
            body="트랙 정보가 아직 정리되지 않았습니다."
            testID="release-empty-tracks"
          />
        )}
      </View>

      {detail.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>메모</Text>
          <View style={styles.metaCard}>
            <Text style={styles.metaBody}>{detail.notes}</Text>
          </View>
        </View>
      ) : null}

      {mvUrl ? (
        <View style={styles.section} testID="release-mv-card">
          <Text style={styles.sectionTitle}>공식 MV</Text>
          <View style={styles.metaCard}>
            {mvStatusCopy ? <Text style={styles.metaBody}>{mvStatusCopy}</Text> : null}
            <ServiceButton
              label="YouTube MV"
              onPress={() =>
                void handleHandoff(
                  resolveServiceHandoff({
                    service: 'youtubeMv',
                    query: `${detail.displayGroup} ${detail.releaseTitle}`,
                    canonicalUrl: mvUrl,
                  }),
                )
              }
              styles={styles}
              tone="youtubeMv"
              testID="release-mv-button"
            />
          </View>
        </View>
      ) : detail.youtubeVideoStatus ? (
        <View style={styles.section} testID="release-mv-state">
          <Text style={styles.sectionTitle}>MV 상태</Text>
          <InlineFeedbackNotice
            body={mvStatusCopy ?? '공식 MV 정보가 아직 정리되지 않았습니다.'}
            title={detail.youtubeVideoProvenance}
          />
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
    backButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
    },
    backButtonLabel: {
      ...theme.typography.buttonService,
      color: theme.colors.text.primary,
    },
    heroCard: {
      flexDirection: 'row',
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
    groupLabel: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
    section: {
      gap: theme.space[12],
    },
    sectionTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    serviceButtonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    serviceButton: {
      minHeight: 40,
      minWidth: 104,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.button,
    },
    spotifyButton: {
      backgroundColor: theme.colors.service.spotify.bg,
    },
    youtubeMusicButton: {
      backgroundColor: theme.colors.service.youtubeMusic.bg,
    },
    youtubeMvButton: {
      backgroundColor: theme.colors.service.youtubeMv.bg,
    },
    serviceButtonLabel: {
      ...theme.typography.buttonService,
    },
    spotifyButtonLabel: {
      color: theme.colors.service.spotify.icon,
    },
    youtubeMusicButtonLabel: {
      color: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMvButtonLabel: {
      color: theme.colors.service.youtubeMv.icon,
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
    trackRow: {
      flexDirection: 'row',
      gap: theme.space[12],
      alignItems: 'flex-start',
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    trackOrder: {
      ...theme.typography.cardTitle,
      width: 18,
      color: theme.colors.text.secondary,
    },
    trackCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    trackTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
      flexWrap: 'wrap',
    },
    trackTitle: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
      flexShrink: 1,
    },
    titleTrackBadge: {
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.status.title.bg,
    },
    titleTrackBadgeLabel: {
      ...theme.typography.chip,
      color: theme.colors.status.title.text,
    },
    trackServiceButtons: {
      gap: theme.space[8],
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
    metaSubtle: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
  });
}
