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
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';
import type { TrackModel } from '../../types';

interface TrackRowProps {
  buttons: ServiceButtonGroupItem[];
  testIDPrefix: string;
  track: TrackModel;
}

function TrackRowComponent({ buttons, testIDPrefix, track }: TrackRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      accessible
      accessibilityLabel={[
        `${track.order}번 트랙`,
        track.title,
        track.isTitleTrack ? '타이틀곡' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={styles.trackRow}
      testID={`${testIDPrefix}-${track.order}`}
    >
      <Text allowFontScaling style={styles.trackOrder}>
        {track.order}
      </Text>
      <View style={styles.trackCopy}>
        <View style={styles.trackTitleRow}>
          <Text allowFontScaling style={styles.trackTitle}>
            {track.title}
          </Text>
          {track.isTitleTrack ? (
            <View style={styles.titleTrackBadge} testID={`${testIDPrefix}-title-badge-${track.order}`}>
              <Text allowFontScaling style={styles.titleTrackBadgeLabel}>
                타이틀
              </Text>
            </View>
          ) : null}
        </View>
        {buttons.length ? (
          <ServiceButtonGroup buttons={buttons} testID={`${testIDPrefix}-actions-${track.order}`} />
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
    titleTrackBadge: {
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.status.title.bg,
    },
    titleTrackBadgeLabel: {
      ...theme.typography.chip,
      color: theme.colors.status.title.text,
    },
  });
}

export const TrackRow = memo(TrackRowComponent);
