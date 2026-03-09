import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import CalendarTabScreen from '../../app/(tabs)/calendar';
import { trackAnalyticsEvent } from '../services/analytics';

jest.mock('expo-router', () => {
  const useLocalSearchParams = jest.fn(() => ({}));

  return {
    useLocalSearchParams,
    useRouter: () => ({
      setParams: jest.fn(),
    }),
    __mock: {
      useLocalSearchParams,
    },
  };
});

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: ({ children, visible }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
  };
});

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
  };
};
jest.mock('../services/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
  trackDatasetDegraded: jest.fn(),
  trackDatasetLoadFailed: jest.fn(),
}));
const mockTrackAnalyticsEvent = jest.mocked(trackAnalyticsEvent);

async function renderCalendarScreen() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<CalendarTabScreen />);
    await Promise.resolve();
  });

  return tree!;
}

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('calendar controls', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-07T09:00:00.000Z'));
    __mock.useLocalSearchParams.mockReturnValue({});
    mockTrackAnalyticsEvent.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('moves across months and jumps back to today', async () => {
    const tree = await renderCalendarScreen();

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 3월');
    expect(tree.root.findByProps({ testID: 'calendar-month-next' }).props.accessibilityLabel).toBe(
      '2026년 4월로 이동',
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-month-next' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 4월');

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-jump-today' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 3월');
  });

  test('opens the nearest upcoming day from the quick-jump action', async () => {
    const tree = await renderCalendarScreen();

    expect(tree.root.findByProps({ testID: 'calendar-jump-nearest' }).props.accessibilityLabel).toContain(
      '가장 가까운 일정',
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-month-next' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 4월');

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-jump-nearest' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 3월');
    expect(tree.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(hasText(tree, '2026년 3월 11일')).toBe(true);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'calendar_quick_jump_used',
      expect.objectContaining({
        target: 'nearest_upcoming',
        fromMonth: '2026-04',
        toMonth: '2026-03',
      }),
    );
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'calendar_date_drill_opened',
      expect.objectContaining({
        date: '2026-03-11',
        source: 'nearest_upcoming',
      }),
    );
  });

  test('keeps month-only items outside the grid and applies compact filters', async () => {
    const tree = await renderCalendarScreen();

    expect(hasText(tree, '2026-03 · 날짜 미정')).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-releases' }).props.onPress();
    });

    expect(hasText(tree, '현재 필터에서는 month-only 예정 신호를 숨깁니다.')).toBe(true);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'calendar_filter_changed',
      expect.objectContaining({
        filterMode: 'releases',
        month: '2026-03',
      }),
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-upcoming' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-day-2026-03-03' }).props.onPress();
    });

    expect(hasText(tree, '이 날짜에는 등록된 일정이 없습니다.')).toBe(true);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'calendar_date_drill_opened',
      expect.objectContaining({
        date: '2026-03-03',
        source: 'grid',
        filterMode: 'upcoming',
      }),
    );
  });
});
