import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { DateDetailSheet } from './DateDetailSheet';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('DateDetailSheet', () => {
  test('renders verified and upcoming sections for a populated date', async () => {
    const onClose = jest.fn();
    const onPressRelease = jest.fn();
    const onPressTeam = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <DateDetailSheet
          isOpen
          onClose={onClose}
          scheduledRows={[
            {
              confidenceChip: '신뢰 높음',
              headline: 'LOVE CATCHER',
              primaryAction: {
                label: '팀 페이지',
                onPress: onPressTeam,
              },
              scheduledDate: '2026년 3월 11일',
              statusChip: '확정',
              team: {
                monogram: 'YE',
                name: 'YENA',
              },
            },
          ]}
          summary="발매 1 · 예정 1"
          title="3월 11일 발매/컴백"
          verifiedRows={[
            {
              chips: [{ key: 'kind', label: 'MINI' }],
              date: '2026년 3월 11일',
              primaryAction: {
                label: '팀 페이지',
                onPress: onPressTeam,
              },
              secondaryAction: {
                label: '상세 보기',
                onPress: onPressRelease,
              },
              team: {
                monogram: 'YE',
                name: 'YENA',
              },
              title: 'LOVE CATCHER',
            },
          ]}
        />,
      );
    });

    expect(tree!.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(hasText(tree!, 'LOVE CATCHER')).toBe(true);
    expect(hasText(tree!, '3월 11일 발매/컴백')).toBe(true);
    expect(hasText(tree!, '검증된 발매')).toBe(true);
    expect(hasText(tree!, '날짜가 잡힌 예정 컴백')).toBe(true);

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: '시트 닫기' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
