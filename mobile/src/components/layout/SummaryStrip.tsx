import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
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
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.row, layout === 'wrap' ? styles.wrapRow : null]} testID={testID}>
      {items.map((item) => (
        <View key={item.key} style={styles.card}>
          <Text allowFontScaling style={styles.value}>
            {item.value}
          </Text>
          <Text allowFontScaling style={styles.label}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
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
    value: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    label: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
  });
}

export const SummaryStrip = memo(SummaryStripComponent);
