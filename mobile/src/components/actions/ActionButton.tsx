import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export type ActionButtonTone = 'primary' | 'secondary' | 'meta';

export interface ActionButtonProps {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
  tone?: ActionButtonTone;
}

function ActionButtonComponent({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  fullWidth = false,
  label,
  loading = false,
  onPress,
  testID,
  tone = 'primary',
}: ActionButtonProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' ? styles.primaryButton : null,
        tone === 'secondary' ? styles.secondaryButton : null,
        tone === 'meta' ? styles.metaButton : null,
        tone === 'primary' ? styles.primarySize : null,
        tone === 'secondary' ? styles.secondarySize : null,
        fullWidth ? styles.fullWidthButton : null,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator
            color={tone === 'primary' ? theme.colors.text.inverse : theme.colors.text.primary}
            size="small"
          />
          <Text
            allowFontScaling
            numberOfLines={2}
            style={[
              styles.label,
              tone === 'primary' ? styles.primaryLabel : styles.secondaryLabel,
            ]}
          >
            {label}
          </Text>
        </View>
      ) : (
        <Text
          allowFontScaling
          numberOfLines={tone === 'meta' ? 1 : 2}
          style={[
            styles.label,
            tone === 'primary' ? styles.primaryLabel : null,
            tone === 'secondary' ? styles.secondaryLabel : null,
            tone === 'meta' ? styles.metaLabel : null,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(theme: MobileTheme) {
  const { lineHeight: _buttonPrimaryLineHeight, ...buttonPrimaryTypography } =
    theme.typography.buttonPrimary;
  const { lineHeight: _metaLineHeight, ...metaTypography } = theme.typography.meta;

  return StyleSheet.create({
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.button,
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
    },
    fullWidthButton: {
      width: '100%',
    },
    primaryButton: {
      backgroundColor: theme.colors.text.brand,
    },
    primarySize: {
      minHeight: theme.size.button.heightPrimary,
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    secondarySize: {
      minHeight: theme.size.button.heightSecondary,
    },
    metaButton: {
      alignSelf: 'flex-start',
      minHeight: 32,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    pressed: {
      opacity: 0.84,
    },
    disabled: {
      opacity: 0.5,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
    },
    label: {
      ...buttonPrimaryTypography,
      flexShrink: 1,
      textAlign: 'center',
    },
    primaryLabel: {
      color: theme.colors.text.inverse,
    },
    secondaryLabel: {
      color: theme.colors.text.primary,
    },
    metaLabel: {
      ...metaTypography,
      color: theme.colors.text.secondary,
      textDecorationLine: 'underline',
    },
  });
}

export const ActionButton = memo(ActionButtonComponent);
