import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedService = service ?? tone ?? 'spotify';
  const serviceMark =
    resolvedService === 'spotify' ? 'SP' : resolvedService === 'youtubeMusic' ? 'YM' : 'MV';

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
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <View style={styles.buttonContent}>
        <View style={[styles.mark, styles[`${resolvedService}Mark`]]}>
          <Text allowFontScaling style={styles.markLabel}>
            {serviceMark}
          </Text>
        </View>
        <Text
          allowFontScaling
          style={[
            styles.buttonLabel,
            styles[`${resolvedService}ButtonLabel`],
            disabled ? styles.buttonLabelDisabled : null,
          ]}
        >
          {label}
        </Text>
      </View>
      {mode === 'searchFallback' ? <Text style={styles.modeHint}>검색 결과</Text> : null}
    </Pressable>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    button: {
      minHeight: 48,
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
      opacity: 0.84,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonLabel: {
      ...theme.typography.buttonService,
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
    markLabel: {
      ...theme.typography.meta,
      color: theme.colors.text.inverse,
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
    youtubeMusicButton: {
      backgroundColor: theme.colors.service.youtubeMusic.bg,
    },
    youtubeMusicButtonLabel: {
      color: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMusicMark: {
      backgroundColor: theme.colors.service.youtubeMusic.icon,
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
    modeHint: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
  });
}

export const ServiceButton = memo(ServiceButtonComponent);
