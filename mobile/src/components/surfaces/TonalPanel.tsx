import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export type TonalPanelTone = 'default' | 'accent' | 'critical';

export interface TonalPanelProps {
  body?: string;
  children?: React.ReactNode;
  eyebrow?: string;
  footer?: React.ReactNode;
  testID?: string;
  title?: string;
  titleMaxFontSizeMultiplier?: number;
  titleTestID?: string;
  tone?: TonalPanelTone;
}

function TonalPanelComponent({
  body,
  children,
  eyebrow,
  footer,
  testID,
  title,
  titleMaxFontSizeMultiplier = MOBILE_TEXT_SCALE_LIMITS.sectionTitle,
  titleTestID,
  tone = 'default',
}: TonalPanelProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={[
        styles.panel,
        tone === 'accent' ? styles.panelAccent : null,
        tone === 'critical' ? styles.panelCritical : null,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.band,
          tone === 'accent' ? styles.bandAccent : null,
          tone === 'critical' ? styles.bandCritical : null,
        ]}
      />
      <View style={styles.content}>
        {eyebrow ? (
          <Text
            allowFontScaling
            maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta}
            style={[
              styles.eyebrow,
              tone === 'critical' ? styles.eyebrowCritical : null,
            ]}
          >
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text
            accessibilityRole="header"
            allowFontScaling
            maxFontSizeMultiplier={titleMaxFontSizeMultiplier}
            numberOfLines={2}
            style={styles.title}
            testID={titleTestID}
          >
            {title}
          </Text>
        ) : null}
        {body ? (
          <Text
            allowFontScaling
            maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
            numberOfLines={4}
            style={[
              styles.body,
              tone === 'critical' ? styles.bodyCritical : null,
            ]}
          >
            {body}
          </Text>
        ) : null}
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    panel: {
      overflow: 'hidden',
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
    },
    panelAccent: {
      backgroundColor: theme.colors.surface.interactive,
      borderColor: theme.colors.border.strong,
    },
    panelCritical: {
      borderColor: theme.colors.text.danger,
      backgroundColor: theme.colors.surface.elevated,
    },
    band: {
      height: 4,
      backgroundColor: theme.colors.border.strong,
    },
    bandAccent: {
      backgroundColor: theme.colors.text.brand,
    },
    bandCritical: {
      backgroundColor: theme.colors.text.danger,
    },
    content: {
      gap: theme.space[8],
      padding: theme.space[12],
    },
    eyebrow: {
      ...theme.typography.meta,
      color: theme.colors.text.brand,
      textTransform: 'uppercase',
    },
    eyebrowCritical: {
      color: theme.colors.text.danger,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    body: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    bodyCritical: {
      color: theme.colors.text.danger,
    },
    footer: {
      paddingTop: theme.space[4],
    },
  });
}

export const TonalPanel = memo(TonalPanelComponent);
