import React from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAppTheme, type MobileTheme } from '../../tokens/theme';
import { MOBILE_COPY } from '../../copy/mobileCopy';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { ActionButton } from '../actions/ActionButton';
import { FallbackArt } from '../visual/FallbackArt';

type FeedbackTone = 'neutral' | 'error';

type FeedbackAction = {
  label: string;
  onPress: () => void;
  testID?: string;
};

type ScreenFeedbackStateProps = {
  body: string;
  eyebrow: string;
  loadingLayout?: 'generic' | 'calendar' | 'search' | 'radar' | 'detail';
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
  loadingLayout = 'generic',
  testID,
  title,
  variant,
}: ScreenFeedbackStateProps) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const titleMultiplier = fontScale >= 1.4 ? MOBILE_TEXT_SCALE_LIMITS.sectionTitle : MOBILE_TEXT_SCALE_LIMITS.screenTitle;
  const [showLoadingSkeleton, setShowLoadingSkeleton] = React.useState(variant !== 'loading');

  React.useEffect(() => {
    if (variant !== 'loading') {
      setShowLoadingSkeleton(true);
      return;
    }

    setShowLoadingSkeleton(false);
    const timer = setTimeout(() => {
      setShowLoadingSkeleton(true);
    }, theme.motion.loadingDelay);

    return () => clearTimeout(timer);
  }, [theme.motion.loadingDelay, variant]);

  return (
    <View style={styles.screenContainer} testID={testID}>
      {variant !== 'loading' ? (
        <FallbackArt
          height={104}
          testID={testID ? `${testID}-fallback-art` : undefined}
          variant="emptyState"
          width={104}
        />
      ) : null}
      <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" allowFontScaling maxFontSizeMultiplier={titleMultiplier} style={styles.screenTitle}>
        {title}
      </Text>
      <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.body}>{body}</Text>
      {variant === 'loading' ? (
        showLoadingSkeleton ? (
          <LoadingSkeleton layout={loadingLayout} />
        ) : (
          <View style={styles.loadingHoldFrame} testID={testID ? `${testID}-loading-hold` : undefined}>
            <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.loadingHint}>
              구조를 먼저 고정한 뒤 내용을 채우고 있습니다.
            </Text>
          </View>
        )
      ) : action ? (
        <ActionButton
          accessibilityLabel={action.label}
          fullWidth={false}
          label={action.label}
          onPress={action.onPress}
          testID={action.testID}
          tone={variant === 'error' ? 'primary' : 'secondary'}
        />
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
  const { fontScale } = useWindowDimensions();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const titleMultiplier = fontScale >= 1.4 ? MOBILE_TEXT_SCALE_LIMITS.body : MOBILE_TEXT_SCALE_LIMITS.sectionTitle;

  return (
    <View
      style={[styles.inlineCard, tone === 'error' ? styles.inlineCardError : null]}
      testID={testID}
    >
      {title ? (
        <Text accessibilityRole="header" allowFontScaling maxFontSizeMultiplier={titleMultiplier} style={styles.inlineTitle}>
          {title}
        </Text>
      ) : null}
      <Text
        allowFontScaling
        maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body}
        style={[styles.body, tone === 'error' ? styles.inlineBodyError : null]}
      >
        {body}
      </Text>
      {action ? (
        <ActionButton
          accessibilityLabel={action.label}
          label={action.label}
          onPress={action.onPress}
          testID={action.testID}
          tone={tone === 'error' ? 'primary' : 'secondary'}
        />
      ) : null}
    </View>
  );
}

export function EmptyStateBlock({
  action,
  description,
  message,
  testID,
}: {
  action?: FeedbackAction;
  description?: string;
  message: string;
  testID?: string;
}) {
  return (
    <InlineFeedbackNotice
      action={action}
      body={description ?? message}
      testID={testID}
      title={description ? message : undefined}
    />
  );
}

export function ErrorStateBlock({
  backAction,
  message,
  retryAction,
  testID,
}: {
  backAction?: FeedbackAction;
  message: string;
  retryAction?: FeedbackAction;
  testID?: string;
}) {
  return (
    <InlineFeedbackNotice
      action={retryAction ?? backAction}
      body={message}
      testID={testID}
      title={MOBILE_COPY.feedback.errorTitle}
      tone="error"
    />
  );
}

function LoadingSkeleton({ layout }: { layout: ScreenFeedbackStateProps['loadingLayout'] }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const pulse = React.useRef(new Animated.Value(reducedMotion ? 1 : 0.72)).current;

  React.useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: theme.motion.loadingPulse,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.72,
          duration: theme.motion.loadingPulse,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion, theme.motion.loadingPulse]);

  const animatedStyle = reducedMotion ? null : { opacity: pulse };
  const rows =
    layout === 'calendar'
      ? [styles.skeletonHero, styles.skeletonGridRow, styles.skeletonGridRow, styles.skeletonListRow]
      : layout === 'search'
        ? [styles.skeletonSearchBar, styles.skeletonSegmentRow, styles.skeletonResultRow, styles.skeletonResultRow]
        : layout === 'radar'
          ? [styles.skeletonHero, styles.skeletonWideRow, styles.skeletonWideRow, styles.skeletonListRow]
          : layout === 'detail'
            ? [styles.skeletonArtwork, styles.skeletonTitleRow, styles.skeletonTitleRowShort, styles.skeletonButtonRow]
            : [styles.skeletonWideRow, styles.skeletonWideRow, styles.skeletonListRow];

  return (
    <View style={styles.skeletonFrame} testID={`loading-skeleton-${layout ?? 'generic'}`}>
      {rows.map((rowStyle, index) => (
        <Animated.View key={`${layout ?? 'generic'}-${index}`} style={[styles.skeletonBlock, rowStyle, animatedStyle]} />
      ))}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      paddingHorizontal: theme.space[24],
      paddingTop: theme.space[24],
      justifyContent: 'flex-start',
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
    loadingHoldFrame: {
      width: '100%',
      paddingTop: theme.space[8],
    },
    loadingHint: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
    skeletonFrame: {
      width: '100%',
      gap: theme.space[12],
      paddingTop: theme.space[8],
    },
    skeletonBlock: {
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.interactive,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
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
    skeletonHero: {
      minHeight: 112,
    },
    skeletonGridRow: {
      minHeight: 72,
    },
    skeletonListRow: {
      minHeight: 52,
    },
    skeletonSearchBar: {
      minHeight: 54,
      borderRadius: theme.radius.button,
    },
    skeletonSegmentRow: {
      minHeight: 42,
      width: '72%',
      borderRadius: theme.radius.button,
    },
    skeletonResultRow: {
      minHeight: 68,
    },
    skeletonWideRow: {
      minHeight: 84,
    },
    skeletonArtwork: {
      minHeight: 168,
      borderRadius: theme.radius.sheet,
    },
    skeletonTitleRow: {
      minHeight: 20,
      width: '76%',
      borderRadius: theme.radius.chip,
    },
    skeletonTitleRowShort: {
      minHeight: 20,
      width: '48%',
      borderRadius: theme.radius.chip,
    },
    skeletonButtonRow: {
      minHeight: 48,
      width: '64%',
      borderRadius: theme.radius.button,
    },
  });
}
