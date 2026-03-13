import React, { memo, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FallbackArt } from '../visual/FallbackArt';
import { resolveBadgeFallbackAssetKey, type BadgeFallbackAssetKey } from '../../utils/assetRegistry';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface TeamIdentityRowProps {
  badgeImageUrl?: string;
  fallbackAssetKey?: BadgeFallbackAssetKey;
  meta?: string;
  monogram?: string;
  name: string;
  nameNumberOfLines?: number;
  onPress?: () => void;
  testID?: string;
}

function TeamIdentityRowComponent({
  badgeImageUrl,
  fallbackAssetKey,
  meta,
  monogram,
  name,
  nameNumberOfLines = 1,
  onPress,
  testID,
}: TeamIdentityRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const content = (
    <>
      <View style={styles.badgeWrap}>
        {badgeImageUrl ? (
          <Image
            source={{ uri: badgeImageUrl }}
            style={styles.badgeImage}
            testID={testID ? `${testID}-badge-image` : undefined}
          />
        ) : (
          <FallbackArt
            height={40}
            label={(monogram ?? name.slice(0, 2)).toUpperCase()}
            shape="circle"
            testID={testID ? `${testID}-fallback-badge` : undefined}
            variant={fallbackAssetKey ?? resolveBadgeFallbackAssetKey()}
            width={40}
          />
        )}
      </View>
      <View style={styles.copy}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
          numberOfLines={nameNumberOfLines}
          style={styles.name}
        >
          {name}
        </Text>
        {meta ? (
          <Text
            allowFontScaling
            maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta}
            numberOfLines={2}
            style={styles.meta}
          >
            {meta}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={`${name} 팀 열기`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} testID={testID}>
      {content}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.size.row.minHeight,
      gap: theme.space[12],
    },
    pressed: {
      opacity: 0.84,
    },
    badgeWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface.interactive,
    },
    badgeImage: {
      width: '100%',
      height: '100%',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.space[4],
    },
    name: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
    },
    meta: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
  });
}

export const TeamIdentityRow = memo(TeamIdentityRowComponent);
