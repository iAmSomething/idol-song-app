import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { ServiceButton, type ServiceButtonProps } from './ServiceButton';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface ServiceButtonGroupItem extends ServiceButtonProps {
  key: string;
}

interface ServiceButtonGroupProps {
  buttons: ServiceButtonGroupItem[];
  testID?: string;
  wrap?: boolean;
}

const serviceOrder: Record<string, number> = {
  spotify: 0,
  youtubeMusic: 1,
  youtubeMv: 2,
};

function ServiceButtonGroupComponent({ buttons, testID, wrap = true }: ServiceButtonGroupProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const orderedButtons = [...buttons].sort((left, right) => {
    const leftOrder = serviceOrder[left.service ?? left.tone ?? 'spotify'] ?? 99;
    const rightOrder = serviceOrder[right.service ?? right.tone ?? 'spotify'] ?? 99;
    return leftOrder - rightOrder;
  });

  return (
    <View style={[styles.row, wrap ? styles.wrapRow : null]} testID={testID}>
      {orderedButtons.map(({ key, ...button }) => (
        <ServiceButton key={key} {...button} />
      ))}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
    wrapRow: {
      flexWrap: 'wrap',
    },
  });
}

export const ServiceButtonGroup = memo(ServiceButtonGroupComponent);
