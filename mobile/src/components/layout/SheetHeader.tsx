import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface SheetHeaderProps {
  closeButtonTestID?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  summary?: string;
  title: string;
}

function SheetHeaderComponent({
  closeButtonTestID,
  onClose,
  showCloseButton = false,
  summary,
  title,
}: SheetHeaderProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        {showCloseButton && onClose ? (
          <Pressable
            accessibilityLabel="시트 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
            testID={closeButtonTestID}
          >
            <Text style={styles.closeLabel}>닫기</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    wrapper: {
      gap: theme.space[12],
    },
    handle: {
      alignSelf: 'center',
      width: 52,
      height: 4,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.border.default,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.space[12],
    },
    copy: {
      flex: 1,
      gap: theme.space[4],
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    summary: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
    closeButton: {
      minHeight: 36,
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.84,
    },
    closeLabel: {
      ...theme.typography.buttonService,
      color: theme.colors.text.secondary,
    },
  });
}

export const SheetHeader = memo(SheetHeaderComponent);
