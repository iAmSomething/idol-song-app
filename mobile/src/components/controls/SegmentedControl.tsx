import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';

export interface SegmentedControlItem {
  key: string;
  label: string;
  count?: number;
}

export interface SegmentedControlProps {
  density?: 'regular' | 'compact';
  items: SegmentedControlItem[];
  isSticky?: boolean;
  onChange: (key: string) => void;
  selectedKey: string;
  testID?: string;
}

function SegmentedControlComponent({
  density = 'regular',
  items,
  isSticky = false,
  onChange,
  selectedKey,
  testID,
}: SegmentedControlProps) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const labelMultiplier = fontScale >= 1.4 ? MOBILE_TEXT_SCALE_LIMITS.buttonService : MOBILE_TEXT_SCALE_LIMITS.buttonPrimary;

  return (
    <View
      style={[
        styles.row,
        density === 'compact' ? styles.rowCompact : null,
        isSticky ? styles.stickyRow : null,
      ]}
      testID={testID}
    >
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
              density === 'compact' ? styles.segmentCompact : null,
              active ? styles.segmentActive : null,
              pressed ? styles.pressed : null,
            ]}
            testID={testID ? `${testID}-${item.key}` : undefined}
          >
            <Text allowFontScaling maxFontSizeMultiplier={labelMultiplier} style={active ? styles.activeLabel : styles.label}>
              {item.label}
            </Text>
            {item.count !== undefined ? (
              <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={active ? styles.activeCount : styles.count}>
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
    rowCompact: {
      gap: theme.space[4],
      padding: theme.space[4],
      borderRadius: theme.radius.sheet,
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
    segmentCompact: {
      flexBasis: 80,
      minHeight: 38,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.chip,
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
