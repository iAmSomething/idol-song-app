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
import {
  ReleaseSummaryRow,
  type ReleaseSummaryRowProps,
} from '../release/ReleaseSummaryRow';
import {
  UpcomingEventRow,
  type UpcomingEventRowProps,
} from '../upcoming/UpcomingEventRow';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

interface DateDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledRows: UpcomingEventRowProps[];
  summary: string;
  title: string;
  verifiedRows: ReleaseSummaryRowProps[];
}

function DateDetailSheetComponent({
  isOpen,
  onClose,
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
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={isOpen}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={styles.sheetBackdrop}
          testID="calendar-sheet-backdrop"
        />
        <View
          accessibilityLabel={`${title} 일정 상세`}
          accessibilityViewIsModal
          accessible
          style={[styles.sheetPanel, isEmpty ? styles.sheetPanelEmpty : null]}
          testID="calendar-bottom-sheet"
        >
          <SheetHeader
            closeButtonTestID="calendar-sheet-close"
            onClose={onClose}
            showCloseButton
            summary={summary}
            title={title}
          />

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
          >
            {isEmpty ? (
              <EmptyStateBlock
                description="이 날짜에는 등록된 일정이 없습니다."
                message="일정 없음"
              />
            ) : null}

            {verifiedRows.length > 0 ? (
              <View style={styles.subsection}>
                <Text allowFontScaling style={styles.subsectionTitle}>
                  Verified releases
                </Text>
                {verifiedRows.map((row) => (
                  <ReleaseSummaryRow key={row.testID ?? `${row.team.name}-${row.title}`} {...row} />
                ))}
              </View>
            ) : null}

            {scheduledRows.length > 0 ? (
              <View style={styles.subsection}>
                <Text allowFontScaling style={styles.subsectionTitle}>
                  Scheduled comebacks
                </Text>
                {scheduledRows.map((row) => (
                  <UpcomingEventRow key={row.testID ?? `${row.team.name}-${row.headline}`} {...row} />
                ))}
              </View>
            ) : null}
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
      gap: theme.space[16],
      paddingHorizontal: theme.space[20],
      paddingTop: theme.space[12],
      paddingBottom: theme.space[24],
      borderTopLeftRadius: theme.radius.sheet,
      borderTopRightRadius: theme.radius.sheet,
      backgroundColor: theme.colors.surface.elevated,
    },
    sheetPanelEmpty: {
      minHeight: '45%',
    },
    sheetScroll: {
      flexGrow: 0,
    },
    sheetContent: {
      gap: theme.space[16],
      paddingBottom: theme.space[8],
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
