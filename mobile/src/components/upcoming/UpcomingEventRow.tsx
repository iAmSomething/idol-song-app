import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton } from '../actions/ActionButton';
import { TeamIdentityRow, type TeamIdentityRowProps } from '../identity/TeamIdentityRow';
import { InfoChip } from '../meta/InfoChip';
import { SourceLinkRow, type SourceLinkRowItem } from '../meta/SourceLinkRow';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface UpcomingEventRowProps {
  confidenceChip?: string;
  headline: string;
  primaryAction: { label: string; onPress: () => void; testID?: string };
  scheduledDate?: string;
  sourceLinks?: SourceLinkRowItem[];
  statusChip?: string;
  team: TeamIdentityRowProps;
  testID?: string;
}

function UpcomingEventRowComponent({
  confidenceChip,
  headline,
  primaryAction,
  scheduledDate,
  sourceLinks = [],
  statusChip,
  team,
  testID,
}: UpcomingEventRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <TeamIdentityRow {...team} />
      <View style={styles.copy}>
        <Text allowFontScaling style={styles.title}>
          {headline}
        </Text>
        {scheduledDate ? (
          <Text allowFontScaling style={styles.meta}>
            {scheduledDate}
          </Text>
        ) : null}
        {statusChip || confidenceChip ? (
          <View style={styles.chips}>
            {statusChip ? <InfoChip label={statusChip} /> : null}
            {confidenceChip ? <InfoChip label={confidenceChip} /> : null}
          </View>
        ) : null}
      </View>
      <ActionButton {...primaryAction} tone="primary" />
      {sourceLinks.length ? <SourceLinkRow links={sourceLinks} /> : null}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.space[12],
      padding: theme.space[16],
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.surface.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    copy: {
      gap: theme.space[4],
    },
    title: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
    },
    meta: {
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

export const UpcomingEventRow = memo(UpcomingEventRowComponent);
