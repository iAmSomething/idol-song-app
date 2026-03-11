import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';

export type InfoChipTone = 'default' | 'title';

export interface InfoChipProps {
  label: string;
  testID?: string;
  tone?: InfoChipTone;
}

function InfoChipComponent({ label, testID, tone = 'default' }: InfoChipProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.chip, tone === 'title' ? styles.titleChip : null]}
      testID={testID}
    >
      <Text
        allowFontScaling
        maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta}
        style={[styles.label, tone === 'title' ? styles.titleLabel : null]}
      >
        {label}
      </Text>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    chip: {
      minHeight: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    titleChip: {
      backgroundColor: theme.colors.status.title.bg,
      borderColor: 'transparent',
    },
    label: {
      ...theme.typography.chip,
      color: theme.colors.text.secondary,
    },
    titleLabel: {
      color: theme.colors.status.title.text,
    },
  });
}

export const InfoChip = memo(InfoChipComponent);
