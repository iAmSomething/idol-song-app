import React, { memo, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SheetHeader } from './SheetHeader';
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
  animationType = 'fade',
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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.sheet,
      maxHeight !== undefined ? { maxHeight } : null,
      minHeight !== undefined ? { minHeight } : null,
    ],
    [maxHeight, minHeight, styles.sheet],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <View style={styles.overlay}>
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
