import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
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
import { selectEntityDetailSnapshot } from '../../src/selectors';
import {
  loadActiveMobileDataset,
  type ActiveMobileDataset,
} from '../../src/services/activeDataset';
import { useAppTheme } from '../../src/tokens/theme';
import type {
  EntityDetailSnapshotModel,
  ReleaseSummaryModel,
  TeamSummaryModel,
  UpcomingEventModel,
} from '../../src/types';

type EntityDetailScreenState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'missing'; reason: string }
  | { kind: 'ready'; source: ActiveMobileDataset; snapshot: EntityDetailSnapshotModel };

type OfficialLinkItem = {
  key: string;
  label: string;
  url: string;
};

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatUpcomingMeta(event: UpcomingEventModel): string {
  if (event.datePrecision === 'exact' && event.scheduledDate) {
    return `${event.scheduledDate} · ${event.status ?? '예정'}`;
  }

  if (event.scheduledMonth) {
    return `${event.scheduledMonth} · 날짜 미정 · ${event.status ?? '예정'}`;
  }

  return event.status ?? '예정';
}

function formatReleaseMeta(release: ReleaseSummaryModel): string {
  return `${release.releaseDate} · ${release.releaseKind ?? 'release'}`;
}

function buildOfficialLinks(team: TeamSummaryModel): OfficialLinkItem[] {
  return [
    team.officialYoutubeUrl
      ? {
          key: 'youtube',
          label: 'YouTube',
          url: team.officialYoutubeUrl,
        }
      : null,
    team.officialInstagramUrl
      ? {
          key: 'instagram',
          label: 'Instagram',
          url: team.officialInstagramUrl,
        }
      : null,
    team.officialXUrl
      ? {
          key: 'x',
          label: 'X',
          url: team.officialXUrl,
        }
      : null,
    team.artistSourceUrl
      ? {
          key: 'source',
          label: 'Source',
          url: team.artistSourceUrl,
        }
      : null,
  ].filter((item): item is OfficialLinkItem => item !== null);
}

async function openExternalUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // Keep the current route stack stable when external handoff fails.
  }
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
    <View style={styles.heroMonogramWrap}>
      <Text style={styles.heroMonogram}>{team.badge?.monogram ?? team.displayName.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export default function ArtistDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slug = getSingleParam(params.slug)?.trim() ?? '';
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<EntityDetailScreenState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    if (!slug) {
      setState({
        kind: 'missing',
        reason: '팀 slug가 없거나 잘못되어 화면을 열 수 없습니다.',
      });
      return () => {
        cancelled = true;
      };
    }

    setState({ kind: 'loading' });

    void loadActiveMobileDataset()
      .then((source) => {
        if (cancelled) {
          return;
        }

        const snapshot = selectEntityDetailSnapshot(source.dataset, slug);
        if (!snapshot) {
          setState({
            kind: 'missing',
            reason: '해당 팀 데이터를 찾지 못했습니다.',
          });
          return;
        }

        setState({
          kind: 'ready',
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
              : '팀 상세 데이터를 불러오지 못했습니다.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount, slug]);

  const screenTitle =
    state.kind === 'ready'
      ? state.snapshot.team.displayName
      : slug || 'Team Detail';

  if (state.kind === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ScreenFeedbackState
          body="팀 요약, 다음 컴백, 최근 앨범을 불러오는 중입니다."
          eyebrow="DETAIL LOADING"
          title="팀 상세"
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
          title="팀 상세"
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
            label: '검색으로 이동',
            onPress: () => router.push('/(tabs)/search'),
          }}
          body={state.reason}
          eyebrow="SAFE RECOVERY"
          testID="entity-missing-state"
          title="팀 상세"
          variant="empty"
        />
      </>
    );
  }

  const { snapshot, source } = state;
  const officialLinks = buildOfficialLinks(snapshot.team);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: snapshot.team.displayName }} />

      <View style={styles.appBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.backButtonLabel}>뒤로</Text>
        </Pressable>
        <Text style={styles.appBarMeta}>{source.sourceLabel}</Text>
      </View>

      <View style={styles.heroCard}>
        <EntityBadge team={snapshot.team} styles={styles} />
        <View style={styles.heroCopy}>
          <Text testID="entity-detail-title" style={styles.heroTitle}>
            {snapshot.team.displayName}
          </Text>
          <Text style={styles.heroMeta}>{snapshot.team.agency ?? '소속사 정보 없음'}</Text>
          <Text style={styles.heroBody}>
            다음 컴백과 최신 발매를 한 화면에서 확인하는 팀 허브입니다.
          </Text>
        </View>
      </View>

      {officialLinks.length > 0 ? (
        <View style={styles.linkRow}>
          {officialLinks.map((link) => (
            <Pressable
              key={link.key}
              testID={`entity-official-link-${link.key}`}
              accessibilityRole="button"
              onPress={() => void openExternalUrl(link.url)}
              style={({ pressed }) => [styles.linkChip, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.linkChipLabel}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <SectionCard title="다음 컴백" styles={styles}>
        {snapshot.nextUpcoming ? (
          <View testID="entity-next-upcoming-card" style={styles.primaryCard}>
            <Text style={styles.primaryCardTitle}>
              {snapshot.nextUpcoming.releaseLabel ?? snapshot.nextUpcoming.headline}
            </Text>
            <Text style={styles.primaryCardMeta}>{formatUpcomingMeta(snapshot.nextUpcoming)}</Text>
            <Text style={styles.primaryCardBody}>{snapshot.nextUpcoming.headline}</Text>
            {snapshot.nextUpcoming.sourceUrl ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void openExternalUrl(snapshot.nextUpcoming!.sourceUrl!)}
                style={({ pressed }) => [styles.metaButton, pressed ? styles.buttonPressed : null]}
              >
                <Text style={styles.metaButtonLabel}>출처 보기</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.emptyCopy}>등록된 예정 컴백이 없습니다.</Text>
        )}
      </SectionCard>

      <SectionCard title="최신 발매" styles={styles}>
        {snapshot.latestRelease ? (
          <Pressable
            testID="entity-latest-release-card"
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/releases/[id]',
                params: { id: snapshot.latestRelease!.id },
              })
            }
            style={({ pressed }) => [styles.releaseCard, pressed ? styles.buttonPressed : null]}
          >
            <View style={styles.releaseArtwork}>
              {snapshot.latestRelease.coverImageUrl ? (
                <Image source={{ uri: snapshot.latestRelease.coverImageUrl }} style={styles.releaseArtworkImage} />
              ) : (
                <Text style={styles.releaseArtworkFallback}>
                  {snapshot.team.badge?.monogram ?? snapshot.team.displayName.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.releaseCopy}>
              <Text style={styles.primaryCardTitle}>{snapshot.latestRelease.releaseTitle}</Text>
              <Text style={styles.primaryCardMeta}>{formatReleaseMeta(snapshot.latestRelease)}</Text>
              <Text style={styles.primaryCardBody}>
                {snapshot.latestRelease.representativeSongTitle ?? '상세 화면으로 이동'}
              </Text>
            </View>
          </Pressable>
        ) : (
          <InlineFeedbackNotice body="최신 발매 정보가 없습니다." />
        )}
      </SectionCard>

      <SectionCard title="최근 앨범들" styles={styles}>
        {snapshot.recentAlbums.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRow}>
            {snapshot.recentAlbums.map((release) => (
              <Pressable
                key={release.id}
                testID={`entity-recent-album-card-${release.id}`}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/releases/[id]',
                    params: { id: release.id },
                  })
                }
                style={({ pressed }) => [styles.albumCard, pressed ? styles.buttonPressed : null]}
              >
                <View style={styles.albumArtwork}>
                  {release.coverImageUrl ? (
                    <Image source={{ uri: release.coverImageUrl }} style={styles.albumArtworkImage} />
                  ) : (
                    <Text style={styles.albumArtworkFallback}>
                      {snapshot.team.badge?.monogram ?? snapshot.team.displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.albumTitle}>{release.releaseTitle}</Text>
                <Text style={styles.albumMeta}>{formatReleaseMeta(release)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <InlineFeedbackNotice body="등록된 최근 앨범이 없습니다." />
        )}
      </SectionCard>

      <SectionCard title="소스 타임라인" styles={styles}>
        {snapshot.sourceTimeline.length > 0 ? (
          <View testID="entity-source-timeline" style={styles.timelineList}>
            {snapshot.sourceTimeline.map((item) => (
              <View key={item.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineCopy}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineMeta}>{item.meta}</Text>
                </View>
                {item.sourceUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void openExternalUrl(item.sourceUrl!)}
                    style={({ pressed }) => [styles.metaButton, pressed ? styles.buttonPressed : null]}
                  >
                    <Text style={styles.metaButtonLabel}>열기</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <InlineFeedbackNotice body="표시할 소스 타임라인이 없습니다." />
        )}
      </SectionCard>
    </ScrollView>
  );
}

function SectionCard({
  title,
  styles,
  children,
}: {
  title: string;
  styles: ReturnType<typeof createStyles>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    appBarMeta: {
      fontSize: theme.typography.meta.fontSize,
      lineHeight: theme.typography.meta.lineHeight,
      color: theme.colors.text.tertiary,
    },
    backButton: {
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    backButtonLabel: {
      fontSize: theme.typography.buttonService.fontSize,
      lineHeight: theme.typography.buttonService.lineHeight,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    heroCard: {
      flexDirection: 'row',
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
    linkChip: {
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border.default,
    },
    linkChipLabel: {
      fontSize: theme.typography.chip.fontSize,
      lineHeight: theme.typography.chip.lineHeight,
      fontWeight: '600',
      color: theme.colors.text.secondary,
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
      flexDirection: 'row',
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
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
    albumCard: {
      width: 172,
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
