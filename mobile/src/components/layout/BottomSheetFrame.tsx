import React, { memo, useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SheetHeader } from './SheetHeader';
import { useOptionalSafeAreaInsets } from '../../hooks/useOptionalSafeAreaInsets';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface BottomSheetFrameProps {
  accessibilityLabel?: string;
  animationType?: 'none' | 'slide' | 'fade';
  backdropTestID?: string;
  children: React.ReactNode;
  closeButtonTestID?: string;
  footer?: React.ReactNode;
  isOpen: boolean;
  maxHeight?: ViewStyle['maxHeight'];
  minHeight?: ViewStyle['minHeight'];
  onClose: () => void;
  sheetTestID?: string;
  summary?: string;
  title: string;
}

function BottomSheetFrameComponent({
  accessibilityLabel,
  animationType,
  backdropTestID,
  children,
  closeButtonTestID,
  footer,
  isOpen,
  maxHeight,
  minHeight,
  onClose,
  sheetTestID,
  summary,
  title,
}: BottomSheetFrameProps) {
  const theme = useAppTheme();
  const insets = useOptionalSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedAnimationType = animationType ?? (reducedMotion ? 'fade' : 'slide');
  const resolvedMaxHeight = Math.max(height - insets.top - theme.space[24], 320);
  const sheetStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.sheet,
      {
        maxHeight: maxHeight ?? resolvedMaxHeight,
        paddingBottom: theme.space[16] + insets.bottom,
      },
      minHeight !== undefined ? { minHeight } : null,
    ],
    [insets.bottom, maxHeight, minHeight, resolvedMaxHeight, styles.sheet, theme.space],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      animationType={resolvedAnimationType}
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
      transparent
      visible
    >
      <View style={[styles.overlay, { paddingTop: insets.top + theme.space[8] }]}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={styles.backdrop}
          testID={backdropTestID}
        />
        <View
          accessibilityLabel={accessibilityLabel ?? `${title} 시트`}
          accessibilityViewIsModal
          accessible
          style={sheetStyle}
          testID={sheetTestID}
        >
          <SheetHeader
            closeButtonTestID={closeButtonTestID}
            onClose={onClose}
            showCloseButton
            summary={summary}
            title={title}
          />
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.surface.overlay,
    },
    backdrop: {
      flex: 1,
    },
    sheet: {
      gap: theme.space[16],
      paddingHorizontal: theme.space[20],
      paddingTop: theme.space[12],
      paddingBottom: theme.space[24],
      borderTopLeftRadius: theme.radius.sheet,
      borderTopRightRadius: theme.radius.sheet,
      backgroundColor: theme.colors.surface.elevated,
    },
  });
}

export const BottomSheetFrame = memo(BottomSheetFrameComponent);
