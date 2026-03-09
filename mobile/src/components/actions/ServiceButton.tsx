import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export type ServiceButtonTone = 'spotify' | 'youtubeMusic' | 'youtubeMv';

export interface ServiceButtonProps {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  testID?: string;
  tone: ServiceButtonTone;
}

function ServiceButtonComponent({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  testID,
  tone,
}: ServiceButtonProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        styles[`${tone}Button`],
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <Text
        allowFontScaling
        style={[
          styles.buttonLabel,
          styles[`${tone}ButtonLabel`],
          disabled ? styles.buttonLabelDisabled : null,
        ]}
      >
        {label}
      </Text>
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
    buttonLabelDisabled: {
      color: theme.colors.text.tertiary,
    },
    spotifyButton: {
      backgroundColor: theme.colors.service.spotify.bg,
    },
    spotifyButtonLabel: {
      color: theme.colors.service.spotify.icon,
    },
    youtubeMusicButton: {
      backgroundColor: theme.colors.service.youtubeMusic.bg,
    },
    youtubeMusicButtonLabel: {
      color: theme.colors.service.youtubeMusic.icon,
    },
    youtubeMvButton: {
      backgroundColor: theme.colors.service.youtubeMv.bg,
    },
    youtubeMvButtonLabel: {
      color: theme.colors.service.youtubeMv.icon,
    },
  });
}

export const ServiceButton = memo(ServiceButtonComponent);

