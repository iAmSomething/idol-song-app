import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ServiceButtonGroup,
  type ServiceButtonGroupItem,
} from '../actions/ServiceButtonGroup';
import { InfoChip } from '../meta/InfoChip';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

interface TrackRowServiceButton {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  mode?: 'canonical' | 'searchFallback';
  onPress: () => void;
  testID?: string;
}

interface TrackRowProps {
  isTitleTrack?: boolean;
  order: number;
  spotifyButton?: TrackRowServiceButton;
  testIDPrefix: string;
  title: string;
  youtubeMusicButton?: TrackRowServiceButton;
}

function TrackRowComponent({
  isTitleTrack = false,
  order,
  spotifyButton,
  testIDPrefix,
  title,
  youtubeMusicButton,
}: TrackRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const buttons: ServiceButtonGroupItem[] = [];

  if (spotifyButton) {
    buttons.push({
      ...spotifyButton,
      key: 'spotify',
      service: 'spotify',
    });
  }

  if (youtubeMusicButton) {
    buttons.push({
      ...youtubeMusicButton,
      key: 'youtubeMusic',
      service: 'youtubeMusic',
    });
  }

  return (
    <View
      accessible
      accessibilityLabel={[
        `${order}번 트랙`,
        title,
        isTitleTrack ? '타이틀곡' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={styles.trackRow}
      testID={`${testIDPrefix}-${order}`}
    >
      <Text allowFontScaling style={styles.trackOrder}>
        {order}
      </Text>
      <View style={styles.trackCopy}>
        <View style={styles.trackTitleRow}>
          <Text allowFontScaling numberOfLines={2} style={styles.trackTitle}>
            {title}
          </Text>
          {isTitleTrack ? (
            <InfoChip
              label="타이틀"
              testID={`${testIDPrefix}-title-badge-${order}`}
              tone="title"
            />
          ) : null}
        </View>
        {buttons.length ? (
          <View style={styles.trackActions}>
            <ServiceButtonGroup buttons={buttons} testID={`${testIDPrefix}-actions-${order}`} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    trackRow: {
      flexDirection: 'row',
      gap: theme.space[12],
      alignItems: 'flex-start',
      minHeight: theme.size.row.minHeight,
      padding: theme.space[12],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    trackOrder: {
      ...theme.typography.cardTitle,
      width: 18,
      color: theme.colors.text.secondary,
    },
    trackCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.space[8],
    },
    trackTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[8],
      flexWrap: 'wrap',
    },
    trackTitle: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
      flexShrink: 1,
    },
    trackActions: {
      alignSelf: 'flex-end',
    },
  });
}

export const TrackRow = memo(TrackRowComponent);
