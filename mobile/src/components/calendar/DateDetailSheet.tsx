import React, { memo, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyStateBlock } from '../feedback/FeedbackState';
import { BottomSheetFrame } from '../layout/BottomSheetFrame';
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
    <BottomSheetFrame
      accessibilityLabel={`${title} 일정 상세`}
      animationType="slide"
      backdropTestID="calendar-sheet-backdrop"
      closeButtonTestID="calendar-sheet-close"
      isOpen={isOpen}
      maxHeight="78%"
      minHeight={isEmpty ? '45%' : undefined}
      onClose={onClose}
      sheetTestID="calendar-bottom-sheet"
      summary={summary}
      title={title}
    >
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
    </BottomSheetFrame>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
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
