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
}

function ServiceButtonGroupComponent({ buttons, testID }: ServiceButtonGroupProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} testID={testID}>
      {buttons.map(({ key, ...button }) => (
        <ServiceButton key={key} {...button} />
      ))}
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
  });
}

export const ServiceButtonGroup = memo(ServiceButtonGroupComponent);

