import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export type SourceLinkType = 'article' | 'official' | 'source';

export interface SourceLinkRowItem {
  key: string;
  label: string;
  onPress: () => void;
  type: SourceLinkType;
  url: string;
}

export interface SourceLinkRowProps {
  links: SourceLinkRowItem[];
  testID?: string;
}

function SourceLinkRowComponent({ links, testID }: SourceLinkRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (links.length === 0) {
    return null;
  }

  return (
    <View style={styles.row} testID={testID}>
      {links.map((link) => (
        <Pressable
          key={link.key}
          accessibilityHint="외부 링크를 엽니다."
          accessibilityLabel={link.label}
          accessibilityRole="link"
          onPress={link.onPress}
          style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
        >
          <Text allowFontScaling style={styles.linkLabel}>
            {link.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[12],
    },
    link: {
      minHeight: 28,
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.84,
    },
    linkLabel: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
      textDecorationLine: 'underline',
    },
  });
}

export const SourceLinkRow = memo(SourceLinkRowComponent);
