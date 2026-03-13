import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { DayCell } from './DayCell';
import type { CalendarDayCellModel } from '../../types';

describe('DayCell', () => {
  test('renders badge and selected accessibility state', async () => {
    const onPress = jest.fn();
    const cell: CalendarDayCellModel = {
      isoDate: '2026-03-11',
      dayNumber: 11,
      isCurrentMonth: true,
      isToday: false,
      isSelected: true,
      badges: [
        {
          id: 'release-yena',
          group: 'YENA',
          kind: 'release',
          label: 'YENA',
          monogram: 'YE',
          imageUrl: 'https://example.com/yena.png',
        },
      ],
      overflowCount: 2,
      releaseCount: 1,
      upcomingCount: 0,
    };
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <DayCell
          badges={cell.badges}
          dateNumber={cell.dayNumber}
          extraCount={cell.overflowCount}
          isCurrentMonth={cell.isCurrentMonth}
          isSelected={cell.isSelected}
          isToday={cell.isToday}
          isoDate={cell.isoDate}
          onPress={onPress}
          releaseCount={cell.releaseCount}
          upcomingCount={cell.upcomingCount}
        />,
      );
    });

    const target = tree!.root.findByProps({ testID: 'calendar-day-2026-03-11' });
    expect(tree!.root.findByProps({ testID: 'calendar-day-badge-image-release-yena' })).toBeTruthy();
    expect(target.props.accessibilityState).toEqual({ selected: true });
    expect(target.props.accessibilityLabel).toContain('3월 11일');
    expect(target.props.accessibilityLabel).toContain('확정 발매 1건');
    expect(target.props.accessibilityLabel).toContain('추가 2건');

    await act(async () => {
      target.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('renders fallback badge art when a badge image is unavailable', async () => {
    const cell: CalendarDayCellModel = {
      isoDate: '2026-03-12',
      dayNumber: 12,
      isCurrentMonth: true,
      isToday: false,
      isSelected: false,
      badges: [
        {
          id: 'upcoming-ab6ix',
          group: 'AB6IX',
          kind: 'scheduled',
          label: 'AB6IX',
          monogram: 'AB',
        },
      ],
      overflowCount: 0,
      releaseCount: 0,
      upcomingCount: 1,
    };
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <DayCell
          badges={cell.badges}
          dateNumber={cell.dayNumber}
          extraCount={cell.overflowCount}
          isCurrentMonth={cell.isCurrentMonth}
          isSelected={cell.isSelected}
          isToday={cell.isToday}
          isoDate={cell.isoDate}
          onPress={jest.fn()}
          releaseCount={cell.releaseCount}
          upcomingCount={cell.upcomingCount}
        />,
      );
    });

    expect(tree!.root.findAllByProps({ testID: 'calendar-day-badge-image-upcoming-ab6ix' })).toHaveLength(0);
    expect(tree!.root.findByProps({ testID: 'calendar-day-badge-fallback-upcoming-ab6ix' })).toBeDefined();
  });
});
