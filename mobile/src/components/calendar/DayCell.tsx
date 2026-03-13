import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import type {
  CalendarDayBadgeKind,
  CalendarDayCellModel,
} from '../../types';

function formatAccessibleDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function buildCalendarDayAccessibilityLabel(cell: CalendarDayCellModel): string {
  const segments = [formatAccessibleDateLabel(cell.isoDate)];

  if (cell.upcomingCount > 0) {
    segments.push(`예정 ${cell.upcomingCount}건`);
  }

  if (cell.releaseCount > 0) {
    segments.push(`확정 발매 ${cell.releaseCount}건`);
  }

  if (cell.overflowCount > 0) {
    segments.push(`추가 ${cell.overflowCount}건`);
  }

  if (cell.releaseCount === 0 && cell.upcomingCount === 0) {
    segments.push('등록된 일정 없음');
  }

  if (cell.isSelected) {
    segments.push('선택됨');
  }

  return segments.join(', ');
}

function getBadgePalette(
  theme: MobileTheme,
  kind: CalendarDayBadgeKind,
): { backgroundColor: string; color: string } {
  if (kind === 'release') {
    return {
      backgroundColor: theme.colors.status.title.bg,
      color: theme.colors.status.title.text,
    };
  }

  const token = theme.colors.status[kind];
  return {
    backgroundColor: token.bg,
    color: token.text,
  };
}

interface DayCellProps {
  badges: CalendarDayCellModel['badges'];
  dateNumber: number;
  extraCount?: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isoDate: string;
  onPress: () => void;
  releaseCount?: number;
  upcomingCount?: number;
  isToday?: boolean;
}

function DayCellComponent({
  badges,
  dateNumber,
  extraCount = 0,
  isCurrentMonth,
  isSelected,
  isoDate,
  isToday = false,
  onPress,
  releaseCount = 0,
  upcomingCount = 0,
}: DayCellProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cell: CalendarDayCellModel = {
    badges,
    dayNumber: dateNumber,
    isCurrentMonth,
    isSelected,
    isToday,
    isoDate,
    overflowCount: extraCount,
    releaseCount,
    upcomingCount,
  };

  return (
    <Pressable
      testID={`calendar-day-${isoDate}`}
      accessibilityHint="날짜 상세 시트를 엽니다."
      accessibilityLabel={buildCalendarDayAccessibilityLabel(cell)}
      accessibilityRole="button"
      accessibilityState={{ selected: cell.isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayCell,
        cell.isToday ? styles.dayCellToday : null,
        cell.isSelected ? styles.dayCellSelected : null,
        !cell.isCurrentMonth ? styles.dayCellDisabled : null,
        pressed ? styles.dayCellPressed : null,
      ]}
    >
      <View style={styles.dayCellHeader}>
        <Text
          allowFontScaling
          style={[
            styles.dayNumber,
            cell.isSelected ? styles.dayNumberSelected : null,
          ]}
        >
          {cell.dayNumber}
        </Text>
      </View>

      <View style={styles.badgeStack}>
        {cell.badges.map((badge) => {
          const palette = getBadgePalette(theme, badge.kind);
          return (
            <View
              key={badge.id}
              style={[
                styles.badgePill,
                {
                  backgroundColor: palette.backgroundColor,
                },
              ]}
            >
              <Text allowFontScaling style={[styles.badgeText, { color: palette.color }]}>
                {badge.monogram}
              </Text>
            </View>
          );
        })}
        {cell.overflowCount > 0 ? (
          <Text allowFontScaling style={styles.overflowLabel}>
            +{cell.overflowCount}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    dayCell: {
      flex: 1,
      minHeight: 88,
      gap: theme.space[4],
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
    },
    dayCellToday: {
      borderColor: theme.colors.border.focus,
    },
    dayCellSelected: {
      backgroundColor: theme.colors.surface.interactive,
      borderColor: theme.colors.border.focus,
    },
    dayCellPressed: {
      backgroundColor: theme.colors.surface.interactive,
    },
    dayCellDisabled: {
      opacity: 0.42,
    },
    dayCellHeader: {
      alignItems: 'flex-start',
    },
    dayNumber: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
      flexShrink: 1,
      fontSize: 18,
      lineHeight: 22,
    },
    dayNumberSelected: {
      color: theme.colors.text.brand,
    },
    badgeStack: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[4],
      alignItems: 'center',
    },
    badgePill: {
      minHeight: 22,
      minWidth: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radius.chip,
    },
    badgeText: {
      ...theme.typography.chip,
      textAlign: 'center',
    },
    overflowLabel: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
  });
}

export const DayCell = memo(DayCellComponent);
