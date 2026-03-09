import React, { memo, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InlineFeedbackNotice } from '../feedback/FeedbackState';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import type {
  CalendarSelectedDayModel,
  ReleaseSummaryModel,
  UpcomingEventModel,
} from '../../types';

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

function formatSelectedDaySummary(selectedDay: CalendarSelectedDayModel): string {
  return `발매 ${selectedDay.releases.length} · 예정 ${selectedDay.exactUpcoming.length}`;
}

interface DateDetailSheetProps {
  onClose: () => void;
  selectedDay: CalendarSelectedDayModel;
  visible: boolean;
}

function DateDetailSheetComponent({
  onClose,
  selectedDay,
  visible,
}: DateDetailSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
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
          accessibilityLabel={`${selectedDay.label} 일정 상세`}
          accessibilityViewIsModal
          accessible
          testID="calendar-bottom-sheet"
          style={[
            styles.sheetPanel,
            selectedDay.isEmpty ? styles.sheetPanelEmpty : null,
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {selectedDay.label}
              </Text>
              <Text style={styles.sectionMeta}>{formatSelectedDaySummary(selectedDay)}</Text>
            </View>
            <Pressable
              testID="calendar-sheet-close"
              accessibilityLabel="날짜 상세 닫기"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.sheetCloseButton}
            >
              <Text style={styles.sheetCloseLabel}>닫기</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            bounces={false}
          >
            {selectedDay.isEmpty ? (
              <InlineFeedbackNotice body="이 날짜에는 등록된 일정이 없습니다." />
            ) : (
              <>
                {selectedDay.releases.length ? (
                  <View style={styles.subsection}>
                    <Text accessibilityRole="header" style={styles.subsectionTitle}>
                      Verified releases
                    </Text>
                    {selectedDay.releases.map((release) => (
                      <View key={release.id} style={styles.row}>
                        <Text style={styles.rowTitle}>{release.displayGroup}</Text>
                        <Text style={styles.rowBody}>{release.releaseTitle}</Text>
                        <Text style={styles.rowMeta}>{formatReleaseRowMeta(release)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedDay.exactUpcoming.length ? (
                  <View style={styles.subsection}>
                    <Text accessibilityRole="header" style={styles.subsectionTitle}>
                      Scheduled comebacks
                    </Text>
                    {selectedDay.exactUpcoming.map((event) => (
                      <View key={event.id} style={styles.row}>
                        <Text style={styles.rowTitle}>{event.displayGroup}</Text>
                        <Text style={styles.rowBody}>{event.releaseLabel ?? event.headline}</Text>
                        <Text style={styles.rowMeta}>{formatUpcomingLabel(event)}</Text>
                      </View>
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
    sheetHandle: {
      alignSelf: 'center',
      width: 52,
      height: 4,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.border.default,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.space[12],
      alignItems: 'flex-start',
    },
    sheetHeaderCopy: {
      flex: 1,
      gap: theme.space[4],
    },
    sheetCloseButton: {
      minHeight: 44,
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
    },
    sheetCloseLabel: {
      ...theme.typography.buttonService,
      color: theme.colors.text.primary,
      textAlign: 'center',
      flexShrink: 1,
    },
    sheetScroll: {
      flexGrow: 0,
    },
    sheetContent: {
      gap: theme.space[16],
      paddingBottom: theme.space[16],
    },
    sectionTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    sectionMeta: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
    subsection: {
      gap: theme.space[12],
    },
    subsectionTitle: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
    },
    row: {
      gap: theme.space[4],
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.base,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    rowTitle: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
    },
    rowBody: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    rowMeta: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
  });
}

export const DateDetailSheet = memo(DateDetailSheetComponent);

