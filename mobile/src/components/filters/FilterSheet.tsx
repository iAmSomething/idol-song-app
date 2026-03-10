import React, { memo, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton } from '../actions/ActionButton';
import { BottomSheetFrame } from '../layout/BottomSheetFrame';
import { useAppTheme } from '../../tokens/theme';
import type { MobileTheme } from '../../tokens/theme';

export interface FilterSheetOption {
  key: string;
  label: string;
  selected: boolean;
}

export interface FilterSheetGroup {
  key: string;
  label: string;
  options: FilterSheetOption[];
}

export interface FilterSheetProps {
  applyButtonTestID?: string;
  closeButtonTestID?: string;
  groups: FilterSheetGroup[];
  isOpen: boolean;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
  onToggleOption: (groupKey: string, optionKey: string) => void;
  optionTestIDPrefix?: string;
  resetButtonTestID?: string;
  summary?: string;
  testID?: string;
  title?: string;
}

function FilterSheetComponent({
  applyButtonTestID,
  closeButtonTestID,
  groups,
  isOpen,
  onApply,
  onClose,
  onReset,
  onToggleOption,
  optionTestIDPrefix,
  resetButtonTestID,
  summary,
  testID,
  title = '필터',
}: FilterSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const optionPrefix = optionTestIDPrefix ?? testID ?? 'filter-sheet';

  return (
    <BottomSheetFrame
      backdropTestID={`${testID ?? 'filter-sheet'}-backdrop`}
      closeButtonTestID={closeButtonTestID}
      footer={
        <View style={styles.actions}>
          <ActionButton label="초기화" onPress={onReset} testID={resetButtonTestID} tone="secondary" />
          <ActionButton label="적용" onPress={onApply} testID={applyButtonTestID} tone="primary" />
        </View>
      }
      isOpen={isOpen}
      maxHeight="62%"
      onClose={onClose}
      sheetTestID={testID}
      summary={summary ?? '적용 전까지 임시 상태를 유지합니다.'}
      title={title}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <View style={styles.optionRow}>
              {group.options.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.selected }}
                  onPress={() => onToggleOption(group.key, option.key)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    option.selected ? styles.optionChipSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`${optionPrefix}-${group.key}-${option.key}`}
                >
                  <Text style={option.selected ? styles.optionLabelSelected : styles.optionLabel}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheetFrame>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.space[16],
      paddingBottom: theme.space[8],
    },
    group: {
      gap: theme.space[8],
    },
    groupTitle: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
    optionChip: {
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: theme.space[12],
      paddingVertical: theme.space[8],
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.surface.base,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
    },
    optionChipSelected: {
      backgroundColor: theme.colors.surface.interactive,
      borderColor: theme.colors.border.focus,
    },
    optionLabel: {
      ...theme.typography.buttonService,
      color: theme.colors.text.secondary,
    },
    optionLabelSelected: {
      ...theme.typography.buttonService,
      color: theme.colors.text.primary,
    },
    pressed: {
      opacity: 0.84,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[8],
    },
  });
}

export const FilterSheet = memo(FilterSheetComponent);
