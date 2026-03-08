import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import CalendarTabScreen from '../../app/(tabs)/calendar';

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

async function renderCalendarScreen() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<CalendarTabScreen />);
    await Promise.resolve();
  });

  return tree!;
}

describe('calendar selected-day bottom sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-07T09:00:00.000Z'));
    __mock.useLocalSearchParams.mockReturnValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('opens and dismisses the selected-day bottom sheet from a populated day', async () => {
    const tree = await renderCalendarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-day-2026-03-11' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '2026년 3월 11일')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Verified releases')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Scheduled comebacks')).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-sheet-backdrop' }).props.onPress();
    });

    expect(tree.root.findAllByProps({ testID: 'calendar-bottom-sheet' })).toHaveLength(0);
  });

  test('shows a safe empty-day state and allows reopening the same day', async () => {
    const tree = await renderCalendarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-day-2026-03-13' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(
      tree.root.findAllByType(Text).some((node) => node.props.children === '이 날짜에는 등록된 일정이 없습니다.'),
    ).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-sheet-close' }).props.onPress();
    });

    expect(tree.root.findAllByProps({ testID: 'calendar-bottom-sheet' })).toHaveLength(0);

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-day-2026-03-13' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
  });

  test('restores month, selected date, filter, and sheet state from route params', async () => {
    __mock.useLocalSearchParams.mockReturnValue({
      month: '2026-03',
      date: '2026-03-11',
      filter: 'upcoming',
      sheet: 'open',
    });

    const tree = await renderCalendarScreen();

    expect(tree.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 3월');
    expect(tree.root.findByProps({ testID: 'calendar-filter-upcoming' }).props.accessibilityState.selected).toBe(
      true,
    );
  });
});
