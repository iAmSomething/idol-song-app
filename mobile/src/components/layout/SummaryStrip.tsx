import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface SummaryStripItem {
  key: string;
  label: string;
  value: string | number;
}

export interface SummaryStripProps {
  items: SummaryStripItem[];
  layout?: 'horizontal' | 'wrap';
  testID?: string;
}

function SummaryStripComponent({
  items,
  layout = 'horizontal',
  testID,
}: SummaryStripProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const useFullWidthCards = layout === 'wrap' && width <= 430;

  return (
    <View style={[styles.row, layout === 'wrap' ? styles.wrapRow : null]} testID={testID}>
      {items.map((item) => (
        <View key={item.key} style={[styles.card, useFullWidthCards ? styles.fullWidthCard : null]}>
          <Text allowFontScaling numberOfLines={2} style={styles.value}>
            {item.value}
          </Text>
          <Text allowFontScaling numberOfLines={2} style={styles.label}>
            {item.label}
          </Text>
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
    fullWidthCard: {
      flexBasis: '100%',
    },
    value: {
      ...sectionTitleTypography,
      color: theme.colors.text.primary,
    },
    label: {
      ...metaTypography,
      color: theme.colors.text.secondary,
    },
  });
}

export const SummaryStrip = memo(SummaryStripComponent);
