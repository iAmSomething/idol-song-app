import React, { memo, useMemo } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  resolveFallbackArtSource,
  type FallbackArtVariant,
} from '../../utils/assetRegistry';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface FallbackArtProps {
  height?: number;
  label?: string;
  shape?: 'circle' | 'rounded';
  testID?: string;
  variant: FallbackArtVariant;
  width?: number;
}

function FallbackArtComponent({
  height = 88,
  label,
  shape = 'rounded',
  testID,
  variant,
  width = height,
}: FallbackArtProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const borderRadius = shape === 'circle' ? Math.min(width, height) / 2 : theme.radius.card;

  return (
    <ImageBackground
      imageStyle={{ borderRadius }}
      source={resolveFallbackArtSource(variant)}
      style={[
        styles.frame,
        {
          width,
          height,
          borderRadius,
        },
      ]}
      testID={testID}
    >
      {label ? (
        <View style={styles.labelPill}>
          <Text allowFontScaling={false} numberOfLines={1} style={styles.label}>
            {label}
          </Text>
        </View>
      ) : null}
    </ImageBackground>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    frame: {
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.surface.subtle,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      padding: theme.space[8],
    },
    labelPill: {
      minHeight: 28,
      maxWidth: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.surface.overlay,
    },
    label: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.inverse,
      letterSpacing: 0.6,
    },
  });
}

export const FallbackArt = memo(FallbackArtComponent);
