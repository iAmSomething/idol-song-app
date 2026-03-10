import React, { memo, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyStateBlock } from '../feedback/FeedbackState';
import { SheetHeader } from '../layout/SheetHeader';
import { ReleaseSummaryRow } from '../release/ReleaseSummaryRow';
import { UpcomingEventRow } from '../upcoming/UpcomingEventRow';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import type {
  ReleaseSummaryModel,
  UpcomingEventModel,
} from '../../types';

function buildMonogram(value: string): string {
  return value.slice(0, 2).toUpperCase();
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

interface DateDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPressRelease: (releaseId: string) => void;
  onPressTeam: (group: string) => void;
  scheduledRows: UpcomingEventModel[];
  summary?: string;
  title: string;
  verifiedRows: ReleaseSummaryModel[];
}

function DateDetailSheetComponent({
  isOpen,
  onClose,
  onPressRelease,
  onPressTeam,
  scheduledRows,
  summary,
  title,
  verifiedRows,
}: DateDetailSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEmpty = verifiedRows.length === 0 && scheduledRows.length === 0;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={isOpen}
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          accessible={false}
          testID="calendar-sheet-backdrop"
          style={styles.sheetBackdrop}
          onPress={onClose}
        />
        <View
          accessibilityLabel={`${title} 일정 상세`}
          accessibilityViewIsModal
          accessible
          testID="calendar-bottom-sheet"
          style={[
            styles.sheetPanel,
            isEmpty ? styles.sheetPanelEmpty : null,
          ]}
        >
          <SheetHeader
            closeButtonTestID="calendar-sheet-close"
            onClose={onClose}
            showCloseButton
            summary={summary}
            title={title}
          />

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            bounces={false}
          >
            {isEmpty ? (
              <EmptyStateBlock description="이 날짜에는 등록된 일정이 없습니다." message="일정 없음" />
            ) : (
              <>
                {verifiedRows.length ? (
                  <View style={styles.subsection}>
                    <Text style={styles.subsectionTitle}>Verified releases</Text>
                    {verifiedRows.map((release) => (
                      <ReleaseSummaryRow
                        key={release.id}
                        chips={
                          release.releaseKind
                            ? [
                                {
                                  key: 'kind',
                                  label: `${release.releaseKind}`.toUpperCase(),
                                },
                              ]
                            : []
                        }
                        date={formatReleaseRowMeta(release)}
                        primaryAction={{
                          label: '팀 페이지',
                          onPress: () => onPressTeam(release.group),
                        }}
                        secondaryAction={{
                          label: '상세 보기',
                          onPress: () => onPressRelease(release.id),
                        }}
                        team={{
                          meta: release.contextTags[0],
                          monogram: buildMonogram(release.displayGroup),
                          name: release.displayGroup,
                        }}
                        title={release.releaseTitle}
                      />
                    ))}
                  </View>
                ) : null}

                {scheduledRows.length ? (
                  <View style={styles.subsection}>
                    <Text style={styles.subsectionTitle}>Scheduled comebacks</Text>
                    {scheduledRows.map((event) => (
                      <UpcomingEventRow
                        key={event.id}
                        confidenceChip={event.confidence ? `신뢰 ${event.confidence}` : undefined}
                        headline={event.releaseLabel ?? event.headline}
                        primaryAction={{
                          label: '팀 페이지',
                          onPress: () => onPressTeam(event.group),
                        }}
                        scheduledDate={formatUpcomingLabel(event)}
                        sourceLinks={
                          event.sourceUrl
                            ? [
                                {
                                  key: `${event.id}-source`,
                                  label: '출처 보기',
                                  onPress: () => undefined,
                                  type: 'source',
                                  url: event.sourceUrl,
                                },
                              ]
                            : []
                        }
                        statusChip={event.status ?? '예정'}
                        team={{
                          monogram: buildMonogram(event.displayGroup),
                          name: event.displayGroup,
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.surface.overlay,
    },
    sheetBackdrop: {
      flex: 1,
    },
    sheetPanel: {
      maxHeight: '78%',
      borderTopLeftRadius: theme.radius.sheet,
      borderTopRightRadius: theme.radius.sheet,
      backgroundColor: theme.colors.surface.elevated,
      paddingHorizontal: theme.space[20],
      paddingTop: theme.space[12],
      paddingBottom: theme.space[24],
      gap: theme.space[16],
    },
    sheetPanelEmpty: {
      minHeight: 260,
    },
    sheetScroll: {
      flexGrow: 0,
    },
    sheetContent: {
      gap: theme.space[16],
      paddingBottom: theme.space[16],
    },
    subsection: {
      gap: theme.space[12],
    },
    subsectionTitle: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
  });
}

export const DateDetailSheet = memo(DateDetailSheetComponent);
