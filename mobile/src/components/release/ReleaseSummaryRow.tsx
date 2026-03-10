import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton } from '../actions/ActionButton';
import {
  ServiceButtonGroup,
  type ServiceButtonGroupItem,
} from '../actions/ServiceButtonGroup';
import { TeamIdentityRow, type TeamIdentityRowProps } from '../identity/TeamIdentityRow';
import { InfoChip } from '../meta/InfoChip';
import { SourceLinkRow, type SourceLinkRowItem } from '../meta/SourceLinkRow';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface ReleaseSummaryRowProps {
  chips?: { key: string; label: string }[];
  date: string;
  primaryAction?: { label: string; onPress: () => void; testID?: string };
  secondaryAction?: { label: string; onPress: () => void; testID?: string };
  serviceButtons?: ServiceButtonGroupItem[];
  sourceLinks?: SourceLinkRowItem[];
  team: TeamIdentityRowProps;
  testID?: string;
  title: string;
}

function ReleaseSummaryRowComponent({
  chips = [],
  date,
  primaryAction,
  secondaryAction,
  serviceButtons = [],
  sourceLinks = [],
  team,
  testID,
  title,
}: ReleaseSummaryRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <TeamIdentityRow {...team} />
      <View style={styles.copy}>
        <Text allowFontScaling numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <Text allowFontScaling style={styles.meta}>
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
      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? <ActionButton {...primaryAction} tone="primary" /> : null}
          {secondaryAction ? <ActionButton {...secondaryAction} tone="secondary" /> : null}
        </View>
      ) : null}
      {serviceButtons.length ? <ServiceButtonGroup buttons={serviceButtons} /> : null}
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
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
  });
}

export const ReleaseSummaryRow = memo(ReleaseSummaryRowComponent);
