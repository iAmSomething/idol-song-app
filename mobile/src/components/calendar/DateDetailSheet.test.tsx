import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { DateDetailSheet } from './DateDetailSheet';
import type { CalendarSelectedDayModel } from '../../types';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('DateDetailSheet', () => {
  test('renders verified and upcoming sections for a populated date', async () => {
    const onClose = jest.fn();
    const selectedDay: CalendarSelectedDayModel = {
      exactUpcoming: [
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
      ],
      isEmpty: false,
      isoDate: '2026-03-11',
      label: '2026년 3월 11일',
      releases: [
        {
          contextTags: [],
          displayGroup: 'YENA',
          group: 'YENA',
          id: 'release-yena',
          releaseDate: '2026-03-11',
          releaseKind: 'mini',
          releaseTitle: 'LOVE CATCHER',
        },
      ],
    };
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <DateDetailSheet onClose={onClose} selectedDay={selectedDay} visible />,
      );
    });

    expect(tree!.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(hasText(tree!, 'Verified releases')).toBe(true);
    expect(hasText(tree!, 'Scheduled comebacks')).toBe(true);

    await act(async () => {
      tree!.root.findByProps({ testID: 'calendar-sheet-close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
