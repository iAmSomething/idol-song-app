import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme, type MobileTheme } from '../../tokens/theme';

type FeedbackTone = 'neutral' | 'error';

type FeedbackAction = {
  label: string;
  onPress: () => void;
  testID?: string;
};

type ScreenFeedbackStateProps = {
  body: string;
  eyebrow: string;
  title: string;
  variant: 'loading' | 'empty' | 'error';
  action?: FeedbackAction;
  testID?: string;
};

type InlineFeedbackNoticeProps = {
  body: string;
  title?: string;
  tone?: FeedbackTone;
  action?: FeedbackAction;
  testID?: string;
};

export function ScreenFeedbackState({
  action,
  body,
  eyebrow,
  testID,
  title,
  variant,
}: ScreenFeedbackStateProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.screenContainer} testID={testID}>
      {variant === 'loading' ? <ActivityIndicator color={theme.colors.text.brand} /> : null}
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed ? styles.primaryActionPressed : null,
          ]}
          testID={action.testID}
        >
          <Text style={styles.primaryActionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InlineFeedbackNotice({
  action,
  body,
  testID,
  title,
  tone = 'neutral',
}: InlineFeedbackNoticeProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={[styles.inlineCard, tone === 'error' ? styles.inlineCardError : null]}
      testID={testID}
    >
      {title ? <Text style={styles.inlineTitle}>{title}</Text> : null}
      <Text
        style={[styles.body, tone === 'error' ? styles.inlineBodyError : null]}
      >
        {body}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed ? styles.secondaryActionPressed : null,
          ]}
          testID={action.testID}
        >
          <Text style={styles.secondaryActionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.space[24],
      gap: theme.space[12],
      backgroundColor: theme.colors.surface.base,
    },
    eyebrow: {
      ...theme.typography.meta,
      color: theme.colors.text.brand,
      textTransform: 'uppercase',
    },
    screenTitle: {
      ...theme.typography.screenTitle,
      color: theme.colors.text.primary,
    },
    body: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    primaryAction: {
      alignSelf: 'flex-start',
      marginTop: theme.space[4],
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
    },
    primaryActionPressed: {
      opacity: 0.84,
    },
    primaryActionLabel: {
      ...theme.typography.buttonPrimary,
      color: theme.colors.text.primary,
    },
    inlineCard: {
      gap: theme.space[8],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.base,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    inlineCardError: {
      borderColor: theme.colors.text.danger,
      backgroundColor: theme.colors.surface.elevated,
    },
    inlineTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    inlineBodyError: {
      color: theme.colors.text.danger,
    },
    secondaryAction: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.interactive,
    },
    secondaryActionPressed: {
      opacity: 0.84,
    },
    secondaryActionLabel: {
      ...theme.typography.buttonService,
      color: theme.colors.text.primary,
    },
  });
}
