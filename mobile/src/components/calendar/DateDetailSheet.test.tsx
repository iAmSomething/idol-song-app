import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { DateDetailSheet } from './DateDetailSheet';
import type { ReleaseSummaryModel, UpcomingEventModel } from '../../types';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('DateDetailSheet', () => {
  test('renders verified and upcoming sections for a populated date', async () => {
    const onClose = jest.fn();
    const onPressRelease = jest.fn();
    const onPressTeam = jest.fn();
    const scheduledRows: UpcomingEventModel[] = [
      {
        confidence: 'high',
        datePrecision: 'exact',
        displayGroup: 'YENA',
        group: 'YENA',
        headline: 'YENA confirms a March 11 comeback',
        id: 'yena-upcoming',
        releaseLabel: 'LOVE CATCHER',
        scheduledDate: '2026-03-11',
        sourceType: 'official_social',
        status: 'confirmed',
      },
    ];
    const verifiedRows: ReleaseSummaryModel[] = [
      {
        contextTags: [],
        displayGroup: 'YENA',
        group: 'YENA',
        id: 'release-yena',
        releaseDate: '2026-03-11',
        releaseKind: 'mini',
        releaseTitle: 'LOVE CATCHER',
      },
    ];
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <DateDetailSheet
          isOpen
          onClose={onClose}
          onPressRelease={onPressRelease}
          onPressTeam={onPressTeam}
          scheduledRows={scheduledRows}
          summary="2026년 3월"
          title="2026년 3월 11일"
          verifiedRows={verifiedRows}
        />,
      );
    });

    expect(tree!.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(hasText(tree!, 'LOVE CATCHER')).toBe(true);
    expect(hasText(tree!, '2026년 3월 11일')).toBe(true);

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: '시트 닫기' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
