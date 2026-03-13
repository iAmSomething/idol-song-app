import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import ReleaseDetailScreen from '../../app/releases/[id]';
import { getFeatureGateState } from '../config/featureGates';
import type { RuntimeConfigState } from '../config/runtime';
import { selectReleaseDetailById } from '../selectors';
import { trackAnalyticsEvent } from '../services/analytics';
import {
  openServiceHandoff,
  type ServiceHandoffFailure,
  type ServiceHandoffResolution,
} from '../services/handoff';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import {
  useActiveDatasetScreen,
  type ActiveDatasetScreenState,
} from './useActiveDatasetScreen';
import type { ReleaseDetailModel } from '../types';

jest.mock('expo-router', () => {
  const useLocalSearchParams = jest.fn(() => ({ id: 'yena--love-catcher--2026-03-11--album' }));
  const useRouter = jest.fn(() => ({
    back: jest.fn(),
    push: jest.fn(),
  }));

  function Stack({ children }: { children?: React.ReactNode }) {
    return children ?? null;
  }

  Stack.Screen = function StackScreen() {
    return null;
  };

  return {
    Stack,
    useLocalSearchParams,
    useRouter,
    __mock: {
      useLocalSearchParams,
      useRouter,
    },
  };
});

jest.mock('../services/handoff', () => {
  const actual = jest.requireActual('../services/handoff');

  return {
    ...actual,
    openServiceHandoff: jest.fn(async (handoff: ServiceHandoffResolution | ServiceHandoffFailure) => {
      if ('ok' in handoff) {
        return handoff;
      }

      return {
        ok: true,
        service: handoff.service,
        mode: handoff.mode,
        target: 'primary',
        openedUrl: handoff.primaryUrl,
      };
    }),
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

jest.mock('../config/featureGates', () => {
  const actual = jest.requireActual('../config/featureGates');

  return {
    ...actual,
    getFeatureGateState: jest.fn(() => ({
      id: 'mv_embed_enabled',
      key: 'mvEmbed',
      label: 'MV embed',
      offFallback: 'Hide the embed and keep the external watch CTA.',
      enabled: true,
    })),
  };
});

jest.mock('./useActiveDatasetScreen', () => ({
  useActiveDatasetScreen: jest.fn(),
}));

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
    useRouter: jest.Mock;
  };
};

const mockOpenServiceHandoff = openServiceHandoff as jest.MockedFunction<typeof openServiceHandoff>;
const mockTrackAnalyticsEvent = jest.mocked(trackAnalyticsEvent);
const mockGetFeatureGateState = jest.mocked(getFeatureGateState);
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

function buildReadyState(detail: ReleaseDetailModel | null): ActiveDatasetScreenState<ReleaseDetailModel | null> {
  return {
    kind: 'ready',
    source: {
      activeSource: 'backend-api',
      sourceLabel: 'Backend API',
      data: detail,
      freshness: {
        rollingReferenceAt: '2026-03-11T00:00:00.000Z',
        staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
      },
      issues: [],
      runtimeState: buildRuntimeState(),
    },
  };
}

function buildStateForReleaseId(releaseId: string): ActiveDatasetScreenState<ReleaseDetailModel | null> {
  const detail = selectReleaseDetailById(bundledFixture, releaseId);
  if (!detail) {
    return buildReadyState(null);
  }

  return buildReadyState({
    ...detail,
    group: releaseId.split('--')[0] ?? detail.group,
  });
}

async function renderReleaseDetail() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<ReleaseDetailScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('mobile release detail screen', () => {
  beforeEach(() => {
    mockGetFeatureGateState.mockReturnValue({
      id: 'mv_embed_enabled',
      key: 'mvEmbed',
      label: 'MV embed',
      offFallback: 'Hide the embed and keep the external watch CTA.',
      enabled: true,
    });
    __mock.useRouter.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
    });
    mockOpenServiceHandoff.mockClear();
    mockTrackAnalyticsEvent.mockClear();
    mockUseActiveDatasetScreen.mockImplementation((options) => {
      const releaseId = String(options.cacheKey).replace(/^release:/, '');
      return buildStateForReleaseId(releaseId);
    });
  });

  test('renders populated release detail sections for a canonical release', async () => {
    const back = jest.fn();
    const push = jest.fn();
    __mock.useRouter.mockReturnValue({
      back,
      push,
    });
    __mock.useLocalSearchParams.mockReturnValue({ id: 'yena--love-catcher--2026-03-11--album' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-appbar' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-appbar-team-page' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('LOVE CATCHER');
    expect(tree.root.findByProps({ testID: 'release-team-identity' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-team-identity-fallback-badge' })).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'release-team-identity-badge-image' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'release-service-spotify' }).props.accessibilityLabel).toBe(
      'Spotify에서 LOVE CATCHER 열기',
    );
    expect(tree.root.findByProps({ testID: 'release-service-spotify' }).props.accessibilityHint).toBe(
      'Spotify 앱이 있으면 앱으로, 없으면 안전한 웹 fallback으로 엽니다.',
    );
    expect(tree.root.findByProps({ testID: 'release-service-spotify' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-service-youtube-music' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-service-youtube-mv' })).toBeDefined();
    expect(hasText(tree, '앱 우선')).toBe(true);
    expect(hasText(tree, '검색 결과')).toBe(true);
    expect(tree.root.findByProps({ testID: 'release-supporting-links' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-track-row-1' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-track-row-title-badge-1' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-mv-card' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'release-appbar-back' }).props.onPress();
      tree.root.findByProps({ testID: 'release-appbar-team-page' }).props.onPress();
    });

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/artists/yena');
  });

  test('renders safe partial states for releases without track links and hides unavailable mv blocks', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'atheart--glow-up--2025-11-18--song' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('Glow Up');
    expect(tree.root.findByProps({ testID: 'release-empty-tracks' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-detail-quality-notice' })).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'release-mv-card' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'release-mv-state' })).toHaveLength(0);
  });

  test('renders a safe recovery state for missing release ids', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'no-such-release' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-missing-state' })).toBeDefined();
    expect(hasText(tree, '해당 릴리즈 상세 데이터를 찾지 못했습니다.')).toBe(true);
  });

  test('wires album-level and track-level service buttons to the shared handoff service', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'yena--love-catcher--2026-03-11--album' });
    const tree = await renderReleaseDetail();

    await act(async () => {
      tree.root.findByProps({ testID: 'release-service-spotify' }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'release-track-1-spotify' }).props.onPress();
    });

    expect(mockOpenServiceHandoff).toHaveBeenCalledTimes(2);
    expect(mockOpenServiceHandoff.mock.calls[0]?.[0]).toMatchObject({
      service: 'spotify',
      mode: 'canonical',
    });
    expect(mockOpenServiceHandoff.mock.calls[1]?.[0]).toMatchObject({
      service: 'spotify',
      mode: 'searchFallback',
    });
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'service_handoff_attempted',
      expect.objectContaining({
        surface: 'release_detail',
        service: 'spotify',
      }),
    );
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'service_handoff_completed',
      expect.objectContaining({
        surface: 'release_detail',
        service: 'spotify',
        ok: true,
      }),
    );
  });

  test('keeps the route stable and shows retryable feedback when handoff fails', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'yena--love-catcher--2026-03-11--album' });
    mockOpenServiceHandoff.mockResolvedValueOnce({
      ok: false,
      code: 'handoff_open_failed',
      service: 'spotify',
      mode: 'canonical',
      target: 'primary',
      attemptedUrl: 'https://open.spotify.com/album/example-love-catcher',
      feedback: {
        level: 'warning',
        retryable: true,
        message: '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
      },
    });

    const tree = await renderReleaseDetail();

    await act(async () => {
      tree.root.findByProps({ testID: 'release-service-spotify' }).props.onPress();
      await Promise.resolve();
    });

    expect(hasText(tree, '외부 이동을 완료하지 못했습니다.')).toBe(true);
    expect(hasText(tree, '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.')).toBe(true);
    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('LOVE CATCHER');
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'service_handoff_completed',
      expect.objectContaining({
        surface: 'release_detail',
        service: 'spotify',
        ok: false,
        failureCode: 'handoff_open_failed',
      }),
    );
  });

  test('marks double title tracks consistently when a release has multiple title songs', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'p1harmony--duh--2026-04-02--album' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-track-row-title-badge-1' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-track-row-title-badge-2' })).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'release-track-row-title-badge-3' })).toHaveLength(0);
  });

  test('keeps the mv CTA visible and adds disclosure when mv embed is disabled', async () => {
    mockGetFeatureGateState.mockReturnValue({
      id: 'mv_embed_enabled',
      key: 'mvEmbed',
      label: 'MV embed',
      offFallback: 'Hide the embed and keep the external watch CTA.',
      enabled: false,
    });
    __mock.useLocalSearchParams.mockReturnValue({ id: 'yena--love-catcher--2026-03-11--album' });

    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-mv-card' })).toBeDefined();
    expect(hasText(tree, '이 빌드에서는 앱 내 MV 임베드를 끄고 외부 YouTube 재생만 제공합니다.')).toBe(true);
    expect(tree.root.findByProps({ testID: 'release-mv-button' })).toBeDefined();
  });
});
