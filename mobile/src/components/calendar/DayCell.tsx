import React, { memo, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
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

  if (cell.badges.length > 0) {
    segments.push(`대표 팀 ${cell.badges.map((badge) => badge.label).join(', ')}`);
  }

  if (cell.isSelected) {
    segments.push('선택됨');
  }

  return segments.join(', ');
}

function getBadgePalette(
  theme: MobileTheme,
  kind: CalendarDayBadgeKind | 'upcoming' | string,
): { backgroundColor: string; color: string } {
  if (kind === 'release') {
    return {
      backgroundColor: theme.colors.status.title.bg,
      color: theme.colors.status.title.text,
    };
  }

  const normalizedKind = kind === 'upcoming' ? 'scheduled' : kind;
  const token =
    theme.colors.status[normalizedKind as keyof MobileTheme['colors']['status']] ??
    theme.colors.status.scheduled;
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
        <View
          style={[
            styles.dayNumberBadge,
            cell.isToday ? styles.dayNumberBadgeToday : null,
            cell.isSelected ? styles.dayNumberBadgeSelected : null,
          ]}
        >
          <Text
            allowFontScaling
            maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
            numberOfLines={1}
            style={[
              styles.dayNumber,
              cell.isToday ? styles.dayNumberToday : null,
              cell.isSelected ? styles.dayNumberSelected : null,
            ]}
          >
            {cell.dayNumber}
          </Text>
        </View>
      </View>

      <View style={styles.dayCellFooter}>
        <View style={styles.markerRow}>
          {cell.badges.map((badge) => {
            const { backgroundColor, color } = getBadgePalette(theme, badge.kind);
            return (
              <View
                key={badge.id}
                style={[
                  styles.badgeMarkerWrap,
                  {
                    backgroundColor,
                  },
                ]}
              >
                {badge.imageUrl ? (
                  <Image
                    source={{ uri: badge.imageUrl }}
                    style={styles.badgeMarkerImage}
                    testID={`calendar-day-badge-image-${badge.id}`}
                  />
                ) : (
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    testID={`calendar-day-badge-fallback-${badge.id}`}
                    style={[
                      styles.badgeMarkerText,
                      {
                        color,
                      },
                    ]}
                  >
                    {badge.monogram.slice(0, 2)}
                  </Text>
                )}
              </View>
            );
          })}
          {cell.overflowCount > 0 ? (
            <View style={styles.overflowPill}>
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta}
                numberOfLines={1}
                style={styles.overflowLabel}
              >
                +{cell.overflowCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    dayCell: {
      flex: 1,
      minHeight: 48,
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[8],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      backgroundColor: theme.colors.surface.base,
    },
    dayCellToday: {
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
    },
    dayCellSelected: {
      borderColor: theme.colors.border.focus,
      backgroundColor: theme.colors.surface.elevated,
    },
    dayCellPressed: {
      backgroundColor: theme.colors.surface.interactive,
    },
    dayCellDisabled: {
      opacity: 0.42,
    },
    dayCellHeader: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      minHeight: 20,
    },
    dayNumberBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: theme.space[4],
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumberBadgeToday: {
      backgroundColor: theme.colors.surface.interactive,
    },
    dayNumberBadgeSelected: {
      backgroundColor: theme.colors.text.brand,
    },
    dayNumber: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: '700',
      fontSize: 15,
      lineHeight: 17,
    },
    dayNumberToday: {
      color: theme.colors.text.brand,
    },
    dayNumberSelected: {
      color: theme.colors.text.inverse,
    },
    dayCellFooter: {
      minHeight: 10,
      justifyContent: 'flex-end',
    },
    markerRow: {
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'flex-start',
      alignItems: 'center',
      minHeight: 16,
    },
    badgeMarkerWrap: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.surface.base,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeMarkerImage: {
      width: '100%',
      height: '100%',
    },
    badgeMarkerText: {
      ...theme.typography.meta,
      fontSize: 8,
      lineHeight: 9,
      fontWeight: '800',
    },
    overflowPill: {
      minWidth: 16,
      minHeight: 12,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.interactive,
    },
    overflowLabel: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
      fontSize: 10,
      lineHeight: 12,
    },
  });
}

export const DayCell = memo(DayCellComponent);
