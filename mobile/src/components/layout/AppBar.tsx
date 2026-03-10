import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton, type ActionButtonProps } from '../actions/ActionButton';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

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
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.actionSlot}>
        {leadingAction ? <ActionButton {...leadingAction} tone="secondary" /> : null}
      </View>
      <View style={styles.copy}>
        {isLoading ? <ActivityIndicator color={theme.colors.text.brand} size="small" /> : null}
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title} testID={titleTestID}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailingActions}>
        {trailingActions.slice(0, 2).map(({ key, ...action }) => (
          <ActionButton key={key} {...action} tone="secondary" />
        ))}
      </View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      minHeight: theme.size.button.heightPrimary,
      gap: theme.space[12],
    },
    actionSlot: {
      minWidth: 68,
      alignItems: 'flex-start',
    },
    copy: {
      flex: 1,
      gap: theme.space[4],
      paddingTop: theme.space[4],
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    trailingActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: theme.space[8],
      minWidth: 68,
    },
  });
}

export const AppBar = memo(AppBarComponent);
