import React, { memo, useEffect, useMemo, useState } from 'react';
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
import {
  resolveServiceIconFallbackGlyph,
  resolveServiceIconSource,
} from '../../utils/assetRegistry';

export type ServiceButtonTone = 'spotify' | 'youtubeMusic' | 'youtubeMv';

export interface ServiceButtonProps {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  mode?: 'canonical' | 'searchFallback';
  modeHintLabel?: string;
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
  modeHintLabel,
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
  const [iconLoadFailed, setIconLoadFailed] = useState(false);
  const serviceIconSource = resolveServiceIconSource(resolvedService);
  const fallbackGlyph = resolveServiceIconFallbackGlyph(resolvedService);

  useEffect(() => {
    setIconLoadFailed(false);
  }, [resolvedService]);

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
          {iconLoadFailed ? (
            <Text
              allowFontScaling={false}
              style={[styles.markFallbackGlyph, styles[`${resolvedService}MarkFallbackGlyph`]]}
              testID={testID ? `${testID}-fallback-glyph` : undefined}
            >
              {fallbackGlyph}
            </Text>
          ) : (
            <Image
              accessibilityIgnoresInvertColors
              fadeDuration={0}
              onError={() => setIconLoadFailed(true)}
              source={serviceIconSource}
              style={styles.markIcon}
              testID={testID ? `${testID}-icon` : undefined}
            />
          )}
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
      {modeHintLabel || mode === 'searchFallback' ? (
        <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.modeHint}>
          {modeHintLabel ?? '검색 결과'}
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
      minWidth: 112,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      gap: theme.space[4],
      borderWidth: 1,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
      minWidth: 0,
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
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
    },
    markIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    markFallbackGlyph: {
      ...metaTypography,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    buttonLabelDisabled: {
      color: theme.colors.text.tertiary,
    },
    spotifyButton: {
      backgroundColor: theme.colors.service.spotify.bg,
      borderColor: theme.colors.service.spotify.icon,
    },
    spotifyButtonLabel: {
      color: theme.colors.service.spotify.icon,
    },
    spotifyMark: {
      backgroundColor: theme.colors.service.spotify.icon,
    },
    spotifyMarkFallbackGlyph: {
      color: theme.colors.text.inverse,
    },
    youtubeMusicButton: {
      backgroundColor: theme.colors.service.youtubeMusic.bg,
      borderColor: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMusicButtonLabel: {
      color: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMusicMark: {
      backgroundColor: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMusicMarkFallbackGlyph: {
      color: theme.colors.text.inverse,
    },
    youtubeMvButton: {
      backgroundColor: theme.colors.service.youtubeMv.bg,
      borderColor: theme.colors.service.youtubeMv.icon,
    },
    youtubeMvButtonLabel: {
      color: theme.colors.service.youtubeMv.icon,
    },
    youtubeMvMark: {
      backgroundColor: theme.colors.service.youtubeMv.icon,
    },
    youtubeMvMarkFallbackGlyph: {
      color: theme.colors.text.inverse,
    },
    modeHint: {
      ...metaTypography,
      color: theme.colors.text.tertiary,
      textAlign: 'center',
    },
  });
}

export const ServiceButton = memo(ServiceButtonComponent);
