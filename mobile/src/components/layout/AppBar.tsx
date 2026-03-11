import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ActionButton, type ActionButtonProps } from '../actions/ActionButton';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import { MOBILE_TEXT_SCALE_LIMITS, isLargeTextMode } from '../../tokens/accessibility';

export interface AppBarAction extends Omit<ActionButtonProps, 'tone'> {
  key: string;
}

export interface AppBarProps {
  isLoading?: boolean;
  leadingAction?: Omit<ActionButtonProps, 'tone'>;
  subtitle?: string;
  testID?: string;
  title: string;
  titleTestID?: string;
  trailingActions?: AppBarAction[];
}

function AppBarComponent({
  isLoading = false,
  leadingAction,
  subtitle,
  testID,
  title,
  titleTestID,
  trailingActions = [],
}: AppBarProps) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasActions = Boolean(leadingAction) || trailingActions.length > 0;
  const largeTextMode = isLargeTextMode(fontScale);

  return (
    <View style={styles.container} testID={testID}>
      {hasActions ? (
        <View style={[styles.actionRow, largeTextMode ? styles.actionRowLargeText : null]}>
          <View style={[styles.leadingAction, largeTextMode ? styles.leadingActionLargeText : null]}>
            {leadingAction ? <ActionButton {...leadingAction} fullWidth={largeTextMode} tone="secondary" /> : null}
          </View>
          <View style={[styles.trailingActions, largeTextMode ? styles.trailingActionsLargeText : null]}>
            {trailingActions.slice(0, 2).map(({ key, ...action }) => (
              <ActionButton key={key} {...action} fullWidth={largeTextMode} tone="secondary" />
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.copy}>
        {isLoading ? <ActivityIndicator color={theme.colors.text.brand} size="small" /> : null}
        <Text
          accessibilityRole="header"
          allowFontScaling
          maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.sectionTitle}
          numberOfLines={2}
          style={styles.title}
          testID={titleTestID}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  const { lineHeight: _titleLineHeight, ...sectionTitleTypography } = theme.typography.sectionTitle;
  const { lineHeight: _bodyLineHeight, ...bodyTypography } = theme.typography.body;

  return StyleSheet.create({
    container: {
      gap: theme.space[12],
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      rowGap: theme.space[8],
      gap: theme.space[12],
    },
    actionRowLargeText: {
      width: '100%',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: theme.space[8],
    },
    leadingAction: {
      alignItems: 'flex-start',
      maxWidth: '100%',
    },
    leadingActionLargeText: {
      width: '100%',
      alignItems: 'stretch',
    },
    copy: {
      gap: theme.space[4],
    },
    title: {
      ...sectionTitleTypography,
      color: theme.colors.text.primary,
    },
    subtitle: {
      ...bodyTypography,
      color: theme.colors.text.secondary,
    },
    trailingActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
      justifyContent: 'flex-start',
      maxWidth: '100%',
    },
    trailingActionsLargeText: {
      width: '100%',
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  });
}

export const AppBar = memo(AppBarComponent);
