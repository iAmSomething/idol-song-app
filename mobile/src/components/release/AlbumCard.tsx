import React, { memo, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InfoChip } from '../meta/InfoChip';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface AlbumCardProps {
  chips?: { key: string; label: string }[];
  coverImageUrl?: string;
  date: string;
  onPress: () => void;
  testID?: string;
  title: string;
}

function AlbumCardComponent({
  chips = [],
  coverImageUrl,
  date,
  onPress,
  testID,
  title,
}: AlbumCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityLabel={`${title} 릴리즈 상세 열기`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.coverWrap}>
        {coverImageUrl ? (
          <Image source={{ uri: coverImageUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverFallback}>
            <Text allowFontScaling style={styles.coverFallbackLabel}>
              {title.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.copy}>
        <Text allowFontScaling numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <Text allowFontScaling style={styles.date}>
          {date}
        </Text>
        {chips.length ? (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <InfoChip key={chip.key} label={chip.label} />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    card: {
      width: 188,
      gap: theme.space[8],
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    pressed: {
      opacity: 0.84,
    },
    coverWrap: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: theme.radius.card,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface.interactive,
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    coverFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverFallbackLabel: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text.primary,
    },
    copy: {
      gap: theme.space[4],
    },
    title: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
    },
    date: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[4],
    },
  });
}

export const AlbumCard = memo(AlbumCardComponent);
