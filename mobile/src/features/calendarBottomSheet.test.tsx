import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import CalendarTabScreen from '../../app/(tabs)/calendar';
import type { RuntimeConfigState } from '../config/runtime';
import { selectCalendarMonthSnapshot } from '../selectors';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import {
  useActiveDatasetScreen,
  type ActiveDatasetScreenState,
} from './useActiveDatasetScreen';
import type { CalendarMonthSnapshotModel } from '../types';

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

jest.mock('./useActiveDatasetScreen', () => ({
  useActiveDatasetScreen: jest.fn(),
}));

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
  };
};
const mockUseActiveDatasetScreen = jest.mocked(useActiveDatasetScreen);
const bundledFixture = cloneBundledDatasetFixture();

function buildRuntimeState(): RuntimeConfigState {
  return {
    mode: 'normal',
    issues: [],
    config: {
      profile: 'preview',
      dataSource: {
        mode: 'backend-api',
        datasetVersion: 'preview-v1',
      },
      services: {
        apiBaseUrl: 'https://example.com/api',
        analyticsWriteKey: null,
        expoProjectId: null,
      },
      logging: {
        level: 'debug',
      },
      featureGates: {
        radar: true,
        analytics: false,
        remoteRefresh: false,
        mvEmbed: true,
        shareActions: true,
      },
      build: {
        version: '0.1.0',
        commitSha: 'test-sha',
      },
    },
  };
}

function buildReadyState(
  snapshot: CalendarMonthSnapshotModel,
): ActiveDatasetScreenState<CalendarMonthSnapshotModel> {
  return {
    kind: 'ready',
    source: {
      activeSource: 'backend-api',
      sourceLabel: 'Backend API',
      data: snapshot,
      freshness: {
        rollingReferenceAt: '2026-03-07T00:00:00.000Z',
        staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
      },
      issues: [],
      runtimeState: buildRuntimeState(),
    },
  };
}

function buildCalendarState(cacheKey: string): ActiveDatasetScreenState<CalendarMonthSnapshotModel> {
  const month = cacheKey.split(':')[1] ?? '2026-03';
  const snapshot = selectCalendarMonthSnapshot(bundledFixture, month, '2026-03-07');
  const normalizeSlug = (id: string, fallback: string) => id.split('--')[0] ?? fallback;

  return buildReadyState({
    ...snapshot,
    releases: snapshot.releases.map((release) => ({
      ...release,
      group: normalizeSlug(release.id, release.group),
    })),
    exactUpcoming: snapshot.exactUpcoming.map((event) => ({
      ...event,
      group: normalizeSlug(event.id, event.group),
    })),
    monthOnlyUpcoming: snapshot.monthOnlyUpcoming.map((event) => ({
      ...event,
      group: normalizeSlug(event.id, event.group),
    })),
    nearestUpcoming: snapshot.nearestUpcoming
      ? {
          ...snapshot.nearestUpcoming,
          group: normalizeSlug(snapshot.nearestUpcoming.id, snapshot.nearestUpcoming.group),
        }
      : null,
  });
}

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
    mockUseActiveDatasetScreen.mockImplementation((options) => buildCalendarState(options.cacheKey));
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
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '3월 11일 발매/컴백')).toBe(
      true,
    );
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '발매 1 · 예정 1')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '검증된 발매')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '날짜가 잡힌 예정 컴백')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'LOVE CATCHER')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '팀 페이지')).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: 'calendar-sheet-backdrop' }).props.onPress();
    });
    expect(tree.root.findByProps({ testID: 'calendar-day-2026-03-11' }).props.accessibilityState.selected).toBe(
      true,
    );
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
    expect(tree.root.findByProps({ testID: 'calendar-day-2026-03-13' }).props.accessibilityState.selected).toBe(
      true,
    );

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
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '예정만')).toBe(true);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === '발매 0 · 예정 1')).toBe(true);
  });
});
