import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface InsetSectionProps {
  accessory?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  testID?: string;
  title: string;
}

function InsetSectionComponent({
  accessory,
  children,
  description,
  testID,
  title,
}: InsetSectionProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text
            accessibilityRole="header"
            allowFontScaling
            maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
            style={styles.title}
          >
            {title}
          </Text>
          {description ? (
            <Text
              allowFontScaling
              maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
              style={styles.description}
            >
              {description}
            </Text>
          ) : null}
        </View>
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    section: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.space[12],
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.space[4],
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    accessory: {
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
    },
    body: {
      gap: theme.space[12],
    },
  });
}

export const InsetSection = memo(InsetSectionComponent);
