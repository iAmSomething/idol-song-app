import React, { memo, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { serviceIconAssets } from '../../utils/assetRegistry';

export type ServiceButtonTone = 'spotify' | 'youtubeMusic' | 'youtubeMv';

export interface ServiceButtonProps {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  mode?: 'canonical' | 'searchFallback';
  onPress?: () => void;
  service?: ServiceButtonTone;
  testID?: string;
  tone?: ServiceButtonTone;
}

function ServiceButtonComponent({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  mode = 'canonical',
  onPress,
  service,
  testID,
  tone,
}: ServiceButtonProps) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedService = service ?? tone ?? 'spotify';
  const labelMultiplier = fontScale >= 1.4 ? MOBILE_TEXT_SCALE_LIMITS.buttonService : MOBILE_TEXT_SCALE_LIMITS.buttonPrimary;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`${resolvedService}Button`],
        pressed && !disabled ? (reducedMotion ? styles.buttonPressedReducedMotion : styles.buttonPressed) : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <View style={styles.buttonContent}>
        <View style={[styles.mark, styles[`${resolvedService}Mark`]]}>
          <Image
            source={serviceIconAssets[resolvedService]}
            style={[styles.markIcon, styles[`${resolvedService}MarkIcon`]]}
          />
        </View>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={labelMultiplier}
          numberOfLines={2}
          style={[
            styles.buttonLabel,
            styles[`${resolvedService}ButtonLabel`],
            disabled ? styles.buttonLabelDisabled : null,
          ]}
        >
          {label}
        </Text>
      </View>
      {mode === 'searchFallback' ? (
        <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.modeHint}>
          검색 결과
        </Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(theme: MobileTheme) {
  const { lineHeight: _buttonServiceLineHeight, ...buttonServiceTypography } =
    theme.typography.buttonService;
  const { lineHeight: _metaLineHeight, ...metaTypography } = theme.typography.meta;

  return StyleSheet.create({
    button: {
      minHeight: theme.size.button.heightService,
      minWidth: 104,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.button,
      gap: theme.space[4],
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
    },
    buttonPressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.84,
    },
    buttonPressedReducedMotion: {
      opacity: 0.88,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonLabel: {
      ...buttonServiceTypography,
      flexShrink: 1,
      textAlign: 'center',
    },
    mark: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    markIcon: {
      width: 14,
      height: 14,
      resizeMode: 'contain',
    },
    buttonLabelDisabled: {
      color: theme.colors.text.tertiary,
    },
    spotifyButton: {
      backgroundColor: theme.colors.service.spotify.bg,
    },
    spotifyButtonLabel: {
      color: theme.colors.service.spotify.icon,
    },
    spotifyMark: {
      backgroundColor: theme.colors.service.spotify.icon,
    },
    spotifyMarkIcon: {
      tintColor: theme.colors.text.inverse,
    },
    youtubeMusicButton: {
      backgroundColor: theme.colors.service.youtubeMusic.bg,
    },
    youtubeMusicButtonLabel: {
      color: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMusicMark: {
      backgroundColor: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMusicMarkIcon: {
      tintColor: theme.colors.text.inverse,
    },
    youtubeMvButton: {
      backgroundColor: theme.colors.service.youtubeMv.bg,
    },
    youtubeMvButtonLabel: {
      color: theme.colors.service.youtubeMv.icon,
    },
    youtubeMvMark: {
      backgroundColor: theme.colors.service.youtubeMv.icon,
    },
    youtubeMvMarkIcon: {
      tintColor: theme.colors.text.inverse,
    },
    modeHint: {
      ...metaTypography,
      color: theme.colors.text.tertiary,
    },
  });
}

export const ServiceButton = memo(ServiceButtonComponent);
