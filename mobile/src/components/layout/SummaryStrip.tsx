import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import { MOBILE_TEXT_SCALE_LIMITS, isLargeTextMode } from '../../tokens/accessibility';

export interface SummaryStripItem {
  detail?: string;
  kind?: 'metric' | 'focus';
  key: string;
  label: string;
  value: string | number;
}

export interface SummaryStripProps {
  density?: 'regular' | 'compact';
  items: SummaryStripItem[];
  layout?: 'horizontal' | 'wrap';
  testID?: string;
}

function SummaryStripComponent({
  density = 'regular',
  items,
  layout = 'horizontal',
  testID,
}: SummaryStripProps) {
  const theme = useAppTheme();
  const { fontScale, width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const largeTextMode = isLargeTextMode(fontScale);
  const useFullWidthCards = layout === 'wrap' && (width <= 360 || largeTextMode);

  return (
    <View style={[styles.row, layout === 'wrap' ? styles.wrapRow : null]} testID={testID}>
      {items.map((item) => (
        <View
          key={item.key}
          style={[
            styles.card,
            item.kind === 'focus' ? styles.focusCard : null,
            density === 'compact' ? styles.compactCard : null,
            useFullWidthCards || item.kind === 'focus' ? styles.fullWidthCard : null,
          ]}
          testID={testID ? `${testID}-item-${item.key}` : undefined}
        >
          {item.kind === 'focus' ? (
            <>
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.summaryLabel}
                numberOfLines={1}
                style={styles.focusLabel}
              >
                {item.label}
              </Text>
              <View style={styles.focusValueGroup}>
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.summaryValue}
                  numberOfLines={1}
                  style={[styles.value, styles.focusValue, largeTextMode ? styles.valueCompact : null]}
                >
                  {item.value}
                </Text>
                {item.detail ? (
                  <Text
                    allowFontScaling
                    maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.summaryLabel}
                    numberOfLines={1}
                    style={styles.focusDetail}
                  >
                    {item.detail}
                  </Text>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <View style={styles.valueGroup}>
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.summaryValue}
                  style={[
                    styles.value,
                    density === 'compact' ? styles.valueDense : null,
                    largeTextMode ? styles.valueCompact : null,
                  ]}
                >
                  {item.value}
                </Text>
                {item.detail ? (
                  <Text
                    allowFontScaling
                    maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.summaryLabel}
                    style={styles.detail}
                  >
                    {item.detail}
                  </Text>
                ) : null}
              </View>
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.summaryLabel}
                numberOfLines={density === 'compact' ? 1 : 2}
                style={styles.label}
              >
                {item.label}
              </Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  const { lineHeight: _sectionTitleLineHeight, ...sectionTitleTypography } =
    theme.typography.sectionTitle;
  const { lineHeight: _metaLineHeight, ...metaTypography } = theme.typography.meta;

  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.space[12],
    },
    wrapRow: {
      flexWrap: 'wrap',
    },
    card: {
      flex: 1,
      minWidth: 92,
      gap: theme.space[4],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    focusCard: {
      minWidth: 0,
      justifyContent: 'flex-start',
    },
    fullWidthCard: {
      flexBasis: '100%',
    },
    compactCard: {
      gap: theme.space[4],
      minWidth: 0,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.sheet,
    },
    valueGroup: {
      gap: theme.space[4],
      minHeight: 0,
    },
    focusValueGroup: {
      gap: theme.space[4],
    },
    value: {
      ...sectionTitleTypography,
      color: theme.colors.text.primary,
    },
    valueCompact: {
      fontSize: theme.typography.cardTitle.fontSize,
      fontWeight: theme.typography.cardTitle.fontWeight,
      letterSpacing: theme.typography.cardTitle.letterSpacing,
    },
    valueDense: {
      fontSize: theme.typography.cardTitle.fontSize,
      fontWeight: theme.typography.sectionTitle.fontWeight,
      letterSpacing: theme.typography.sectionTitle.letterSpacing,
    },
    detail: {
      ...metaTypography,
      color: theme.colors.text.secondary,
      fontWeight: '600',
    },
    focusLabel: {
      ...metaTypography,
      color: theme.colors.text.secondary,
      textTransform: 'none',
    },
    focusValue: {
      fontSize: theme.typography.cardTitle.fontSize,
      fontWeight: theme.typography.cardTitle.fontWeight,
      letterSpacing: theme.typography.cardTitle.letterSpacing,
    },
    focusDetail: {
      ...metaTypography,
      color: theme.colors.text.secondary,
      fontWeight: '600',
    },
    label: {
      ...metaTypography,
      color: theme.colors.text.secondary,
    },
  });
}

export const SummaryStrip = memo(SummaryStripComponent);
