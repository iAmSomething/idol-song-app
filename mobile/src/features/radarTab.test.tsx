import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import RadarTabScreen from '../../app/(tabs)/radar';
import { type RuntimeConfigState } from '../config/runtime';
import { selectRadarSnapshot } from '../selectors';
import {
  loadActiveMobileDataset,
  type ActiveMobileDataset,
} from '../services/activeDataset';
import { trackAnalyticsEvent, trackDatasetDegraded, trackDatasetLoadFailed } from '../services/analytics';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import { createBundledDatasetSelection } from '../services/datasetSource';

jest.mock('../config/runtime', () => {
  const actual = jest.requireActual('../config/runtime');

  return {
    ...actual,
    getRuntimeConfigState: jest.fn(),
    getRuntimeConfig: jest.fn(),
  };
});

jest.mock('expo-router', () => {
  const useLocalSearchParams = jest.fn(() => ({}));
  const push = jest.fn();
  const setParams = jest.fn();

  return {
    useRouter: () => ({
      push,
      setParams,
    }),
    useLocalSearchParams,
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

jest.mock('../services/activeDataset', () => {
  const actual = jest.requireActual('../services/activeDataset');

  return {
    ...actual,
    loadActiveMobileDataset: jest.fn(),
  };
});

jest.mock('../selectors', () => {
  const actual = jest.requireActual('../selectors');

  return {
    ...actual,
    selectRadarSnapshot: jest.fn(actual.selectRadarSnapshot),
  };
});

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

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    push: jest.Mock;
    setParams: jest.Mock;
    useLocalSearchParams: jest.Mock;
  };
};

const mockLoadActiveMobileDataset = jest.mocked(loadActiveMobileDataset);
const mockSelectRadarSnapshot = jest.mocked(selectRadarSnapshot);
const mockTrackAnalyticsEvent = jest.mocked(trackAnalyticsEvent);
const mockTrackDatasetDegraded = jest.mocked(trackDatasetDegraded);
const mockTrackDatasetLoadFailed = jest.mocked(trackDatasetLoadFailed);
const runtimeModule = jest.requireMock('../config/runtime') as {
  getRuntimeConfigState: jest.Mock;
  getRuntimeConfig: jest.Mock;
};

function createRuntimeState(
  overrides: Partial<RuntimeConfigState> = {},
): RuntimeConfigState {
  return {
    mode: 'normal',
    issues: [],
    config: {
      profile: 'development',
      dataSource: {
        mode: 'bundled-static',
        datasetVersion: 'fixture-v1',
      },
      services: {
        apiBaseUrl: null,
        analyticsWriteKey: null,
      },
      logging: {
        level: 'verbose',
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
    ...overrides,
  };
}

function createSource(overrides: Partial<ActiveMobileDataset> = {}): ActiveMobileDataset {
  return {
    activeSource: 'bundled-static',
    dataset: cloneBundledDatasetFixture(),
    freshness: {
      rollingReferenceAt: null,
      staleFreshnessClasses: [],
    },
    selection: createBundledDatasetSelection('fixture-v1', 'profile_default'),
    runtimeState: createRuntimeState(),
    sourceLabel: 'Bundled static dataset',
    issues: [],
    ...overrides,
  };
}

async function renderRadarScreen() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<RadarTabScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('mobile radar tab', () => {
  beforeEach(() => {
    __mock.useLocalSearchParams.mockReturnValue({});
    __mock.push.mockClear();
    __mock.setParams.mockClear();
    runtimeModule.getRuntimeConfigState.mockReturnValue(createRuntimeState());
    runtimeModule.getRuntimeConfig.mockReturnValue(createRuntimeState().config);
    mockLoadActiveMobileDataset.mockClear();
    mockSelectRadarSnapshot.mockClear();
    mockTrackAnalyticsEvent.mockClear();
    mockTrackDatasetDegraded.mockClear();
    mockTrackDatasetLoadFailed.mockClear();
    mockLoadActiveMobileDataset.mockResolvedValue(createSource());

    const actualSelectors = jest.requireActual('../selectors') as typeof import('../selectors');
    mockSelectRadarSnapshot.mockImplementation((input, todayIsoDate) =>
      actualSelectors.selectRadarSnapshot(input, todayIsoDate),
    );
  });

  test('renders radar sections from shared selector data', async () => {
    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-featured-card' }).props.accessibilityLabel).toContain('YENA');
    expect(tree.root.findByProps({ testID: 'radar-weekly-card-yena' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-change-card-p1harmony' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-rookie-card-atheart' })).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'radar-dataset-risk-notice' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'radar-partial-notice' })).toHaveLength(0);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith('radar_viewed', { enabledSections: 4 });
  });

  test('shows a degraded-state notice while keeping usable cards visible', async () => {
    mockLoadActiveMobileDataset.mockResolvedValue(
      createSource({
        runtimeState: createRuntimeState({ mode: 'degraded' }),
        issues: ['Preview remote dataset is unavailable.'],
        sourceLabel: 'Bundled static dataset',
      }),
    );
    runtimeModule.getRuntimeConfigState.mockReturnValue(
      createRuntimeState({
        mode: 'degraded',
        issues: [
          {
            kind: 'invalid_runtime_config',
            message: 'Preview remote dataset is unavailable.',
          },
        ],
      }),
    );

    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-dataset-risk-notice' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(mockTrackDatasetDegraded).toHaveBeenCalledWith(
      'radar',
      expect.objectContaining({
        issues: ['Preview remote dataset is unavailable.'],
      }),
    );
    const loadCallsBeforeRetry = mockLoadActiveMobileDataset.mock.calls.length;

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-degraded-retry' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoadActiveMobileDataset.mock.calls.length).toBe(loadCallsBeforeRetry + 1);
  });

  test('surfaces a partial-data notice without blocking section fallback rendering', async () => {
    const source = createSource();
    const actualSelectors = jest.requireActual('../selectors') as typeof import('../selectors');
    const baseSnapshot = actualSelectors.selectRadarSnapshot(source.dataset, '2026-03-09');

    mockLoadActiveMobileDataset.mockResolvedValue(source);
    const partialFutureUpcoming = baseSnapshot.futureUpcoming.map((item, index) =>
      index === 0
        ? {
            ...item,
            upcoming: {
              ...item.upcoming,
              releaseLabel: undefined,
            },
          }
        : item,
    );
    mockSelectRadarSnapshot.mockReturnValue({
      ...baseSnapshot,
      futureUpcoming: partialFutureUpcoming,
      featuredUpcoming: partialFutureUpcoming[0] ?? null,
      weeklyUpcoming: baseSnapshot.weeklyUpcoming.map((item, index) =>
        index === 0
          ? {
              ...item,
              upcoming: {
                ...item.upcoming,
                confidence: undefined,
              },
            }
          : item,
      ),
      longGap: baseSnapshot.longGap.map((item, index) =>
        index === 0
          ? {
              ...item,
              latestRelease: null,
            }
          : item,
      ),
    });

    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-partial-notice' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-featured-card' }).props.accessibilityLabel).toContain(
      'YENA confirms a March 11 comeback',
    );
    expect(hasText(tree, '가장 가까운 컴백, 이번 주 예정, 장기 공백 레이더 섹션은 아직 일부 정보만 표시됩니다. 가능한 범위 안에서 최소 카드만 유지합니다.')).toBe(true);
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
  });

  test('renders retryable blocking feedback when the dataset cannot be loaded at all', async () => {
    mockLoadActiveMobileDataset
      .mockRejectedValueOnce(new Error('Radar dataset could not be loaded right now.'))
      .mockResolvedValue(createSource());

    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-error-retry' })).toBeDefined();
    expect(hasText(tree, 'Radar dataset could not be loaded right now.')).toBe(true);
    expect(mockTrackDatasetLoadFailed).toHaveBeenCalledWith(
      'radar',
      'Radar dataset could not be loaded right now.',
    );
    const loadCallsBeforeRetry = mockLoadActiveMobileDataset.mock.calls.length;

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-error-retry' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoadActiveMobileDataset.mock.calls.length).toBe(loadCallsBeforeRetry + 1);
    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
  });

  test('restores status, act type, and section state from route params', async () => {
    __mock.useLocalSearchParams.mockReturnValue({
      actType: 'solo',
      sections: 'change',
      status: 'changed',
    });
    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-filter-button' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(tree.root.findByProps({ testID: 'radar-change-card-yena' })).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'radar-change-card-p1harmony' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'radar-weekly-card-yena' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'radar-long-gap-card-weeekly' })).toHaveLength(0);
  });

  test('keeps applied radar filters stable until the sheet is explicitly applied', async () => {
    const tree = await renderRadarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-button' }).props.onPress();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-status-changed' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-filter-act-solo' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-filter-close' }).props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-weekly-card-yena' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-change-card-p1harmony' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-filter-button' }).props.accessibilityState.selected).toBe(
      false,
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-button' }).props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: 'radar-filter-status-all' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(tree.root.findByProps({ testID: 'radar-filter-act-all' }).props.accessibilityState.selected).toBe(
      true,
    );
  });

  test('applies filter sheet selections only after explicit apply', async () => {
    const tree = await renderRadarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-button' }).props.onPress();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-status-changed' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-filter-act-solo' }).props.onPress();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-apply' }).props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: 'radar-change-card-yena' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-filter-button' }).props.accessibilityState.selected).toBe(
      true,
    );

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-button' }).props.onPress();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: 'radar-filter-status-changed' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(tree.root.findByProps({ testID: 'radar-filter-act-solo' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'radar_filter_applied',
      expect.objectContaining({
        statusFilter: 'changed',
        actTypeFilter: 'solo',
      }),
    );
  });

  test('routes team-card primary actions to team detail screens', async () => {
    const tree = await renderRadarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-featured-primary' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-weekly-card-yena-primary' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-change-primary-p1harmony' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-long-gap-primary-weeekly' }).props.onPress();
      tree.root.findByProps({ testID: 'radar-rookie-primary-atheart' }).props.onPress();
    });

    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'yena' },
    });
    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'p1harmony' },
    });
    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'weeekly' },
    });
    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'atheart' },
    });
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'radar_card_opened',
      expect.objectContaining({
        section: 'featured_upcoming',
        teamSlug: 'yena',
      }),
    );
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'radar_card_opened',
      expect.objectContaining({
        section: 'change_feed',
        teamSlug: 'p1harmony',
      }),
    );
  });
});
