import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import RadarTabScreen from '../../app/(tabs)/radar';
import type { RuntimeConfigState } from '../config/runtime';
import { selectRadarSnapshot } from '../selectors';
import { openXSearchHandoff } from '../services/handoff';
import { trackAnalyticsEvent } from '../services/analytics';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import {
  useActiveDatasetScreen,
  type ActiveDatasetScreenState,
} from './useActiveDatasetScreen';
import type { RadarSnapshotModel } from '../types';

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

jest.mock('./useActiveDatasetScreen', () => ({
  useActiveDatasetScreen: jest.fn(),
}));

jest.mock('../services/analytics', () => {
  const actual = jest.requireActual('../services/analytics') as typeof import('../services/analytics');

  return {
    ...actual,
    trackAnalyticsEvent: jest.fn(),
    trackFailureObserved: jest.fn(),
  };
});

jest.mock('../services/handoff', () => {
  const actual = jest.requireActual('../services/handoff') as typeof import('../services/handoff');

  return {
    ...actual,
    openXSearchHandoff: jest.fn(),
  };
});

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    push: jest.Mock;
    setParams: jest.Mock;
    useLocalSearchParams: jest.Mock;
  };
};

const mockUseActiveDatasetScreen = jest.mocked(useActiveDatasetScreen);
const mockTrackAnalyticsEvent = jest.mocked(trackAnalyticsEvent);
const mockOpenXSearchHandoff = jest.mocked(openXSearchHandoff);

function buildRuntimeState(mode: 'normal' | 'degraded' = 'normal'): RuntimeConfigState {
  return {
    mode,
    issues:
      mode === 'degraded'
        ? [
            {
              kind: 'invalid_runtime_config',
              message: 'Preview remote dataset is unavailable.',
            },
          ]
        : [],
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

function buildSnapshot(): RadarSnapshotModel {
  return selectRadarSnapshot(cloneBundledDatasetFixture(), '2026-03-09');
}

function buildReadyState(
  overrides: Partial<ReturnType<typeof buildSnapshot>> = {},
  sourceOverrides: Partial<{
    activeSource: 'backend-api' | 'backend-cache';
    issues: string[];
    runtimeState: RuntimeConfigState;
    sourceLabel: string;
  }> = {},
): ActiveDatasetScreenState<RadarSnapshotModel> {
  return {
    kind: 'ready' as const,
    source: {
      activeSource: sourceOverrides.activeSource ?? 'backend-api',
      data: {
        ...buildSnapshot(),
        ...overrides,
      },
      freshness: {
        rollingReferenceAt: '2026-03-09T00:00:00.000Z',
        staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
      },
      issues: sourceOverrides.issues ?? [],
      runtimeState: sourceOverrides.runtimeState ?? buildRuntimeState(),
      sourceLabel: sourceOverrides.sourceLabel ?? 'Backend API',
    },
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
    mockTrackAnalyticsEvent.mockClear();
    mockOpenXSearchHandoff.mockReset();
    mockOpenXSearchHandoff.mockResolvedValue({
      ok: true,
      mode: 'release_backed',
      target: 'app',
      openedUrl: 'twitter://search?query=YENA',
    });
    mockUseActiveDatasetScreen.mockReturnValue(buildReadyState());
  });

  test('renders radar sections from the active screen source', async () => {
    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-featured-card' }).props.accessibilityLabel).toContain('YENA');
    expect(tree.root.findByProps({ testID: 'radar-weekly-card-yena' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-change-card-p1harmony' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-rookie-card-atheart' })).toBeDefined();

    await act(async () => {
      await tree.root.findByProps({ testID: 'radar-featured-x-search' }).props.onPress();
    });

    expect(mockOpenXSearchHandoff).toHaveBeenCalled();
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'x_search_handoff_opened_app',
      expect.objectContaining({
        surface: 'radar',
        entitySlug: 'yena',
        mode: 'release_backed',
      }),
    );
  });

  test('shows a degraded-state notice while keeping usable cards visible', async () => {
    mockUseActiveDatasetScreen.mockReturnValue(
      buildReadyState({}, {
        activeSource: 'backend-cache',
        issues: ['Preview remote dataset is unavailable.'],
        runtimeState: buildRuntimeState('degraded'),
        sourceLabel: 'Cached backend snapshot',
      }),
    );

    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-dataset-risk-notice' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
  });

  test('surfaces a partial-data notice without blocking section rendering', async () => {
    const snapshot = buildSnapshot();
    mockUseActiveDatasetScreen.mockReturnValue(
      buildReadyState({
        featuredUpcoming: snapshot.featuredUpcoming
          ? {
              ...snapshot.featuredUpcoming,
              upcoming: {
                ...snapshot.featuredUpcoming.upcoming,
                releaseLabel: undefined,
              },
            }
          : null,
        weeklyUpcoming: snapshot.weeklyUpcoming.map((item, index) =>
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
        longGap: snapshot.longGap.map((item, index) =>
          index === 0
            ? {
                ...item,
                latestRelease: null,
              }
            : item,
        ),
      }),
    );

    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-partial-notice' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
  });

  test('renders retryable blocking feedback when the dataset cannot be loaded at all', async () => {
    mockUseActiveDatasetScreen.mockReturnValue({
      kind: 'error',
      message: 'Radar dataset could not be loaded right now.',
    });

    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-error-retry' })).toBeDefined();
    expect(hasText(tree, 'Radar dataset could not be loaded right now.')).toBe(true);
  });
});
