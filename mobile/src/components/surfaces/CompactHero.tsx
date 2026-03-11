import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface CompactHeroProps {
  body?: string;
  eyebrow?: string;
  footer?: React.ReactNode;
  media: React.ReactNode;
  meta?: string;
  secondaryMeta?: string;
  testID?: string;
  title: string;
  titleTestID?: string;
}

function CompactHeroComponent({
  body,
  eyebrow,
  footer,
  media,
  meta,
  secondaryMeta,
  testID,
  title,
  titleTestID,
}: CompactHeroProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.hero} testID={testID}>
      <View style={styles.band} />
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.media}>{media}</View>
          <View style={styles.copy}>
            {eyebrow ? (
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta}
                style={styles.eyebrow}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Text
              accessibilityRole="header"
              allowFontScaling
              maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.screenTitle}
              numberOfLines={2}
              style={styles.title}
              testID={titleTestID}
            >
              {title}
            </Text>
            {meta ? (
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
                numberOfLines={2}
                style={styles.meta}
              >
                {meta}
              </Text>
            ) : null}
            {secondaryMeta ? (
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
                numberOfLines={2}
                style={styles.secondaryMeta}
              >
                {secondaryMeta}
              </Text>
            ) : null}
            {body ? (
              <Text
                allowFontScaling
                maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
                numberOfLines={3}
                style={styles.body}
              >
                {body}
              </Text>
            ) : null}
          </View>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    hero: {
      overflow: 'hidden',
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
    },
    band: {
      height: 8,
      backgroundColor: theme.colors.text.brand,
    },
    content: {
      gap: theme.space[8],
      padding: theme.space[12],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: theme.space[16],
    },
    media: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.space[4],
    },
    eyebrow: {
      ...theme.typography.meta,
      color: theme.colors.text.brand,
      textTransform: 'uppercase',
    },
    title: {
      ...theme.typography.screenTitle,
      color: theme.colors.text.primary,
    },
    meta: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    secondaryMeta: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
    body: {
      paddingTop: theme.space[4],
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    footer: {
      gap: theme.space[8],
    },
  });
}

export const CompactHero = memo(CompactHeroComponent);
