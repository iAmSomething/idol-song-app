import React from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppTheme, type MobileTheme } from '../../tokens/theme';

const APP_ICON = require('../../../assets/app-icon/icon-adaptive-foreground.png');

export interface LaunchGateProps {
  children: React.ReactNode;
}

export function LaunchGate({ children }: LaunchGateProps) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const progress = React.useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    if (reducedMotion) {
      const timer = setTimeout(() => {
        if (!cancelled) {
          setIsVisible(false);
        }
      }, 120);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: theme.motion.launchEnter,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(theme.motion.launchHold),
      Animated.timing(progress, {
        toValue: 2,
        duration: theme.motion.launchExit,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (!cancelled && finished) {
        setIsVisible(false);
      }
    });

    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [progress, reducedMotion, theme.motion.launchEnter, theme.motion.launchExit, theme.motion.launchHold]);

  const overlayOpacity = reducedMotion
    ? 1
    : progress.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [1, 1, 0],
      });
  const cardOpacity = reducedMotion
    ? 1
    : progress.interpolate({
        inputRange: [0, 0.8, 1.4, 2],
        outputRange: [0.32, 1, 1, 0],
      });
  const cardScale = reducedMotion
    ? 1
    : progress.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0.96, 1, 1.02],
      });

  return (
    <View style={styles.root}>
      {children}
      {isVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { opacity: overlayOpacity }]}
          testID="launch-gate-overlay"
        >
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            <View style={styles.markRow}>
              <View style={styles.markBadge}>
                <Image source={APP_ICON} style={styles.markImage} />
              </View>
              <View style={styles.copyBlock}>
                <Text allowFontScaling={false} style={styles.kicker}>
                  IDOL SONG APP
                </Text>
                <Text allowFontScaling={false} style={styles.title}>
                  이번 주 발매와
                  {'\n'}
                  다음 컴백을 정리합니다
                </Text>
              </View>
            </View>
            <View style={styles.metaRail}>
              <Text allowFontScaling={false} style={styles.metaText}>
                CALENDAR
              </Text>
              <Text allowFontScaling={false} style={styles.metaDot}>
                ·
              </Text>
              <Text allowFontScaling={false} style={styles.metaText}>
                RADAR
              </Text>
              <Text allowFontScaling={false} style={styles.metaDot}>
                ·
              </Text>
              <Text allowFontScaling={false} style={styles.metaText}>
                RELEASES
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface.base,
      paddingHorizontal: theme.space[24],
    },
    card: {
      width: '100%',
      maxWidth: 360,
      gap: theme.space[16],
      paddingHorizontal: theme.space[24],
      paddingVertical: theme.space[24],
      borderRadius: theme.radius.sheet,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      shadowColor: '#000000',
      shadowOpacity: theme.scheme === 'dark' ? 0.32 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    markRow: {
      flexDirection: 'row',
      gap: theme.space[16],
      alignItems: 'center',
    },
    markBadge: {
      width: 72,
      height: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: theme.colors.surface.interactive,
    },
    markImage: {
      width: 48,
      height: 48,
      resizeMode: 'contain',
    },
    copyBlock: {
      flex: 1,
      gap: theme.space[8],
    },
    kicker: {
      ...theme.typography.meta,
      color: theme.colors.text.brand,
      letterSpacing: 1.2,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    metaRail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.space[8],
    },
    metaText: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
    metaDot: {
      ...theme.typography.meta,
      color: theme.colors.text.tertiary,
    },
  });
}
