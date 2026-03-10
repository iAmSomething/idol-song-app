import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import CalendarTabScreen from '../../app/(tabs)/calendar';
import { trackAnalyticsEvent } from '../services/analytics';

jest.mock('expo-router', () => {
  const useLocalSearchParams = jest.fn(() => ({}));
  const push = jest.fn();
  const setParams = jest.fn();

  return {
    useLocalSearchParams,
    useRouter: () => ({
      push,
      setParams,
    }),
    __mock: {
      push,
      setParams,
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
    push: jest.Mock;
    setParams: jest.Mock;
    useLocalSearchParams: jest.Mock;
  };
};
jest.mock('../services/analytics', () => {
  const actual = jest.requireActual('../services/analytics') as typeof import('../services/analytics');

  return {
    ...actual,
    trackAnalyticsEvent: jest.fn(),
    trackDatasetDegraded: jest.fn(),
    trackDatasetLoadFailed: jest.fn(),
    trackFailureObserved: jest.fn(),
  };
});
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

function hasTextContaining(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => {
    const children = node.props.children;

    if (typeof children === 'string') {
      return children.includes(value);
    }

    if (Array.isArray(children)) {
      return children.join('').includes(value);
    }

    return false;
  });
}

describe('calendar controls', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-07T09:00:00.000Z'));
    __mock.useLocalSearchParams.mockReturnValue({});
    __mock.push.mockReset();
    __mock.setParams.mockReset();
    mockTrackAnalyticsEvent.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders compact chrome and moves across months', async () => {
    const tree = await renderCalendarScreen();

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 3월');
    expect(hasText(tree, '이번 달 발매')).toBe(true);
    expect(hasText(tree, '예정 컴백')).toBe(true);
    expect(hasText(tree, '가장 가까운 일정')).toBe(true);
    expect(tree.root.findByProps({ testID: 'calendar-view-calendar' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(tree.root.findByProps({ testID: 'calendar-month-next' }).props.accessibilityLabel).toBe(
      '2026년 4월로 이동',
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-month-next' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 4월');

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-month-prev' }).props.onPress();
    });
    expect(tree.root.findByProps({ testID: 'calendar-month-title' }).props.children).toBe('2026년 3월');
  });

  test('opens the filter sheet and only commits draft changes on apply', async () => {
    const tree = await renderCalendarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-open' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-filter-sheet' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'calendar-filter-sheet-mode-all' }).props.accessibilityState.selected).toBe(
      true,
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-sheet-mode-upcoming' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-close' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-open' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-filter-sheet-mode-all' }).props.accessibilityState.selected).toBe(
      true,
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-day-2026-03-12' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-bottom-sheet' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-open' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-sheet-mode-releases' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-apply' }).props.onPress();
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
      tree.root.findByProps({ testID: 'calendar-filter-open' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-reset' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-filter-apply' }).props.onPress();
    });

    expect(hasText(tree, '현재 필터에서는 month-only 예정 신호를 숨깁니다.')).toBe(false);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'calendar_filter_changed',
      expect.objectContaining({
        filterMode: 'all',
        month: '2026-03',
      }),
    );
  });

  test('opens team and release detail routes from selected-day sheet actions', async () => {
    const tree = await renderCalendarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-day-2026-03-11' }).props.onPress();
    });

    await act(async () => {
      tree.root
        .findByProps({ testID: 'calendar-sheet-release-primary-yena--love-catcher--2026-03-11--album' })
        .props.onPress();
      tree.root
        .findByProps({ testID: 'calendar-sheet-release-secondary-yena--love-catcher--2026-03-11--album' })
        .props.onPress();
      tree.root
        .findByProps({
          testID: 'calendar-sheet-upcoming-primary-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
        })
        .props.onPress();
    });

    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'yena' },
    });
    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/releases/[id]',
      params: { id: 'yena--love-catcher--2026-03-11--album' },
    });
  });

  test('renders list mode with separated verified, exact, and month-only sections', async () => {
    const tree = await renderCalendarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-view-list' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'calendar-view-list' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(hasText(tree, 'Verified releases')).toBe(true);
    expect(hasText(tree, 'Scheduled comebacks')).toBe(true);
    expect(hasText(tree, 'Month-only signals')).toBe(true);
    expect(hasText(tree, 'LOVE CATCHER')).toBe(true);
    expect(hasText(tree, 'DUH!')).toBe(true);
    expect(hasTextContaining(tree, 'Rumored follow-up')).toBe(true);
  });
});
