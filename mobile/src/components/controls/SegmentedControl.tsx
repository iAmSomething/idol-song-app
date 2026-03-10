import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface SegmentedControlItem {
  key: string;
  label: string;
  count?: number;
}

export interface SegmentedControlProps {
  items: SegmentedControlItem[];
  isSticky?: boolean;
  onChange: (key: string) => void;
  selectedKey: string;
  testID?: string;
}

function SegmentedControlComponent({
  items,
  isSticky = false,
  onChange,
  selectedKey,
  testID,
}: SegmentedControlProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.row, isSticky ? styles.stickyRow : null]} testID={testID}>
      {items.map((item) => {
        const active = item.key === selectedKey;

        return (
          <Pressable
            key={item.key}
            accessibilityLabel={
              item.count === undefined ? item.label : `${item.label} ${item.count}건`
            }
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.segment,
              active ? styles.segmentActive : null,
              pressed ? styles.pressed : null,
            ]}
            testID={testID ? `${testID}-${item.key}` : undefined}
          >
            <Text allowFontScaling style={active ? styles.activeLabel : styles.label}>
              {item.label}
            </Text>
            {item.count !== undefined ? (
              <Text allowFontScaling style={active ? styles.activeCount : styles.count}>
                {item.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  const { lineHeight: _buttonServiceLineHeight, ...buttonServiceTypography } =
    theme.typography.buttonService;
  const { lineHeight: _metaLineHeight, ...metaTypography } = theme.typography.meta;

  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
      padding: theme.space[4],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.subtle,
    },
    stickyRow: {
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    segment: {
      flexGrow: 1,
      flexBasis: 96,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[4],
      borderRadius: theme.radius.button,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[8],
    },
    segmentActive: {
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    pressed: {
      opacity: 0.84,
    },
    label: {
      ...buttonServiceTypography,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    activeLabel: {
      ...buttonServiceTypography,
      color: theme.colors.text.primary,
      textAlign: 'center',
    },
    count: {
      ...metaTypography,
      color: theme.colors.text.tertiary,
    },
    activeCount: {
      ...metaTypography,
      color: theme.colors.text.brand,
    },
  });
}

export const SegmentedControl = memo(SegmentedControlComponent);
