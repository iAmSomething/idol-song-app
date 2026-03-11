import React from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [isReducedMotionEnabled, setIsReducedMotionEnabled] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    const syncPreference = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) {
          setIsReducedMotionEnabled(enabled);
        }
      } catch {
        if (mounted) {
          setIsReducedMotionEnabled(false);
        }
      }
    };

    void syncPreference();

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setIsReducedMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return isReducedMotionEnabled;
}
