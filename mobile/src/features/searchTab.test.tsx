import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import SearchTabScreen from '../../app/(tabs)/search';
import type { RuntimeConfigState } from '../config/runtime';
import { selectSearchResults } from '../selectors';
import { trackAnalyticsEvent } from '../services/analytics';
import { openServiceHandoff, openXSearchHandoff } from '../services/handoff';
import { persistRecentQuery, readRecentQueries } from '../services/recentQueries';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import { resetStorageAdapter, setStorageAdapter, type KeyValueStorageAdapter } from '../services/storage';
import {
  useActiveDatasetScreen,
  type ActiveDatasetScreenState,
} from './useActiveDatasetScreen';

let mockRouteParams: Record<string, string> = {};

function createMemoryStorage(): KeyValueStorageAdapter {
  const values = new Map<string, string>();

  return {
    async getItem(key) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

jest.mock('expo-router', () => {
  const push = jest.fn();
  const setParams = jest.fn((nextParams: Record<string, string | undefined>) => {
    mockRouteParams = Object.fromEntries(
      Object.entries(nextParams).filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as Record<string, string>;
  });
  const useLocalSearchParams = jest.fn(() => mockRouteParams);
  const setLocalSearchParams = (nextParams: Record<string, string>) => {
    mockRouteParams = { ...nextParams };
  };

  return {
    useRouter: () => ({ push, setParams }),
    useLocalSearchParams,
    __mock: { push, setParams, useLocalSearchParams, setLocalSearchParams },
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

jest.mock('../services/handoff', () => {
  const actual = jest.requireActual('../services/handoff') as typeof import('../services/handoff');

  return {
    ...actual,
    openServiceHandoff: jest.fn(),
    openXSearchHandoff: jest.fn(),
  };
});

jest.mock('./useActiveDatasetScreen', () => ({
  useActiveDatasetScreen: jest.fn(),
}));

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    push: jest.Mock;
    setParams: jest.Mock;
    useLocalSearchParams: jest.Mock;
    setLocalSearchParams: (nextParams: Record<string, string>) => void;
  };
};
const mockTrackAnalyticsEvent = jest.mocked(trackAnalyticsEvent);
const mockOpenServiceHandoff = jest.mocked(openServiceHandoff);
const mockOpenXSearchHandoff = jest.mocked(openXSearchHandoff);
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
  query: string,
): ActiveDatasetScreenState<ReturnType<typeof selectSearchResults>> {
  const results = selectSearchResults(bundledFixture, query, '2026-03-07');
  const normalizeSlug = (id: string, fallback: string) => id.split('--')[0] ?? fallback;

  return {
    kind: 'ready',
    source: {
      activeSource: 'backend-api',
      sourceLabel: 'Backend API',
      data: {
        ...results,
        entities: results.entities.map((result) => ({
          ...result,
          latestRelease: result.latestRelease
            ? {
                ...result.latestRelease,
                group: result.team.slug,
              }
            : null,
        })),
        releases: results.releases.map((result) => ({
          ...result,
          release: {
            ...result.release,
            group: normalizeSlug(result.release.id, result.release.group),
          },
        })),
        upcoming: results.upcoming.map((result) => ({
          ...result,
          upcoming: {
            ...result.upcoming,
            group: normalizeSlug(result.upcoming.id, result.upcoming.group),
          },
        })),
      },
      freshness: {
        rollingReferenceAt: '2026-03-07T00:00:00.000Z',
        staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
      },
      issues: [],
      runtimeState: buildRuntimeState(),
    },
  };
}

function buildStateFromCacheKey(
  cacheKey?: string,
): ActiveDatasetScreenState<ReturnType<typeof selectSearchResults>> {
  if (!cacheKey?.startsWith('search:')) {
    return buildReadyState('');
  }

  const query = cacheKey.slice('search:'.length);
  return buildReadyState(query === 'empty' ? '' : query);
}

async function renderSearchScreen() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<SearchTabScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

async function flushSearchDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(250);
    await Promise.resolve();
  });
}

describe('mobile search tab', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setStorageAdapter(createMemoryStorage());
    __mock.setLocalSearchParams({});
    __mock.useLocalSearchParams.mockImplementation(() => mockRouteParams);
    __mock.setParams.mockClear();
    __mock.push.mockClear();
    mockTrackAnalyticsEvent.mockClear();
    mockOpenServiceHandoff.mockReset();
    mockOpenXSearchHandoff.mockReset();
    mockOpenServiceHandoff.mockResolvedValue({
      ok: true,
      service: 'spotify',
      mode: 'canonical',
      target: 'primary',
      openedUrl: 'https://open.spotify.com/track/test',
    });
    mockOpenXSearchHandoff.mockResolvedValue({
      ok: true,
      mode: 'release_backed',
      target: 'web',
      openedUrl: 'https://x.com/search?q=YENA',
    });
    mockUseActiveDatasetScreen.mockImplementation((options) =>
      buildStateFromCacheKey(options.cacheKey),
    );
  });

  afterEach(() => {
    resetStorageAdapter();
    jest.useRealTimers();
  });

  test('renders sectioned results for alias queries and persists recent searches on submit', async () => {
    const tree = await renderSearchScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-input' }).props.onChangeText('최예나');
    });
    await flushSearchDebounce();

    expect(tree.root.findByProps({ testID: 'search-team-result-yena' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-team-result-press-yena' }).props.onPress();
    });

    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'search_result_opened',
      expect.objectContaining({
        query: '최예나',
        activeSegment: 'entities',
        resultType: 'team',
        targetId: 'yena',
      }),
    );
    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'yena' },
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'search-segment-releases' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'search-release-result-yena--love-catcher--2026-03-11--album' })).toBeDefined();

    await act(async () => {
      tree.root
        .findByProps({ testID: 'search-release-result-press-yena--love-catcher--2026-03-11--album' })
        .props.onPress();
    });

    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/releases/[id]',
      params: { id: 'yena--love-catcher--2026-03-11--album' },
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'search-segment-upcoming' }).props.onPress();
    });

    expect(
      tree.root.findByProps({
        testID: 'search-upcoming-result-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        testID: 'search-upcoming-x-search-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
      }),
    ).toBeDefined();

    await act(async () => {
      tree.root
        .findByProps({
          testID: 'search-upcoming-result-press-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
        })
        .props.onPress();
    });

    expect(__mock.push).toHaveBeenCalledWith({
      pathname: '/artists/[slug]',
      params: { slug: 'yena' },
    });

    await act(async () => {
      await tree.root
        .findByProps({
          testID: 'search-upcoming-x-search-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
        })
        .props.onPress();
    });

    expect(mockOpenXSearchHandoff).toHaveBeenCalled();
    expect(
      mockTrackAnalyticsEvent.mock.calls.some(
        ([eventName, payload]) =>
          (eventName === 'x_search_handoff_opened_app' || eventName === 'x_search_handoff_opened_web') &&
          payload &&
          typeof payload === 'object' &&
          'surface' in payload &&
          'entitySlug' in payload &&
          (payload as { surface?: string; entitySlug?: string }).surface === 'search' &&
          (payload as { surface?: string; entitySlug?: string }).entitySlug === 'yena',
      ),
    ).toBe(true);

    await act(async () => {
      await tree.root.findByProps({ testID: 'search-input' }).props.onSubmitEditing();
    });

    await expect(readRecentQueries()).resolves.toEqual(['최예나']);
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'search_submitted',
      expect.objectContaining({
        query: '최예나',
        submitSource: 'input',
      }),
    );
  });

  test('clears stale local query when navigation opens the search tab without params', async () => {
    __mock.setLocalSearchParams({
      q: '최예나',
      segment: 'entities',
    });

    const tree = await renderSearchScreen();

    expect(tree.root.findByProps({ testID: 'search-input' }).props.value).toBe('최예나');

    __mock.setParams.mockClear();

    await act(async () => {
      __mock.setLocalSearchParams({});
      tree.update(<SearchTabScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: 'search-input' }).props.value).toBe('');
    expect(__mock.setParams).not.toHaveBeenCalledWith(
      expect.objectContaining({
        q: '최예나',
      }),
    );
  });

  test('shows recent queries when idle and allows clearing history', async () => {
    await persistRecentQuery('피원하');

    const tree = await renderSearchScreen();

    expect(tree.root.findByProps({ testID: 'recent-query-피원하' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-clear-history' }).props.onPress();
    });

    expect(await readRecentQueries()).toEqual([]);
    expect(hasText(tree, '최근 검색이 없습니다.')).toBe(true);

    await act(async () => {
      await persistRecentQuery('최예나');
    });

    const rerendered = await renderSearchScreen();
    await act(async () => {
      rerendered.root.findByProps({ testID: 'recent-query-최예나' }).props.onPress();
    });

    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'search_submitted',
      expect.objectContaining({
        query: '최예나',
        submitSource: 'recent',
      }),
    );
  });

  test('restores query and segment state from route params', async () => {
    __mock.setLocalSearchParams({
      q: '최예나',
      segment: 'upcoming',
    });

    const tree = await renderSearchScreen();

    expect(tree.root.findByProps({ testID: 'search-input' }).props.value).toBe('최예나');
    expect(tree.root.findByProps({ testID: 'search-input' }).props.accessibilityLabel).toBe(
      '팀, 앨범, 곡, 별칭 검색',
    );
    expect(
      tree.root.findByProps({ testID: 'search-segment-upcoming' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(
      tree.root.findByProps({
        testID: 'search-upcoming-result-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
      }),
    ).toBeDefined();
  });

  test('returns to the default state when clearing or cancelling a query', async () => {
    __mock.setLocalSearchParams({
      q: '최예나',
      segment: 'upcoming',
    });

    const tree = await renderSearchScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-clear-button' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'search-input' }).props.value).toBe('');
    expect(
      tree.root.findByProps({ testID: 'search-segment-entities' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(hasText(tree, '최근 검색')).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: 'search-input' }).props.onFocus();
      tree.root.findByProps({ testID: 'search-input' }).props.onChangeText('LOVE CATCHER');
    });
    await flushSearchDebounce();

    expect(tree.root.findByProps({ testID: 'search-cancel-button' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-cancel-button' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'search-input' }).props.value).toBe('');
    expect(
      tree.root.findByProps({ testID: 'search-segment-entities' }).props.accessibilityState.selected,
    ).toBe(true);
  });

  test('shows partial-result guidance and jumps to the first available segment', async () => {
    const tree = await renderSearchScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-input' }).props.onChangeText('LOVE CATCHER');
    });
    await flushSearchDebounce();

    expect(tree.root.findByProps({ testID: 'search-segment-empty-notice' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-partial-result-action' }).props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: 'search-segment-releases' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(tree.root.findByProps({ testID: 'search-partial-result-notice' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'search-release-result-yena--love-catcher--2026-03-11--album' })).toBeDefined();
  });

  test('renders compact release service actions and surfaces handoff failures', async () => {
    const tree = await renderSearchScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-input' }).props.onChangeText('최예나');
    });
    await flushSearchDebounce();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-segment-releases' }).props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: 'search-release-result-services-yena--love-catcher--2026-03-11--album' }),
    ).toBeDefined();

    await act(async () => {
      await tree.root
        .findByProps({ testID: 'search-release-service-spotify-yena--love-catcher--2026-03-11--album' })
        .props.onPress();
    });

    expect(mockOpenServiceHandoff).toHaveBeenCalled();
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'service_handoff_attempted',
      expect.objectContaining({
        surface: 'search',
        service: 'spotify',
      }),
    );
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      'service_handoff_completed',
      expect.objectContaining({
        surface: 'search',
        service: 'spotify',
        ok: true,
      }),
    );

    mockOpenServiceHandoff.mockResolvedValueOnce({
      ok: false,
      code: 'handoff_open_failed',
      service: 'youtubeMusic',
      mode: 'searchFallback',
      target: 'browserFallback',
      attemptedUrl: 'https://music.youtube.com/search?q=%EC%B5%9C%EC%98%88%EB%82%98',
      feedback: {
        level: 'warning',
        retryable: true,
        message: '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
      },
    });

    await act(async () => {
      await tree.root
        .findByProps({ testID: 'search-release-service-youtube-music-yena--love-catcher--2026-03-11--album' })
        .props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'search-handoff-feedback' })).toBeDefined();
  });

  test('debounces route param sync during typing but flushes clear and segment changes immediately', async () => {
    jest.useFakeTimers();
    const tree = await renderSearchScreen();

    __mock.setParams.mockClear();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-input' }).props.onFocus();
      tree.root.findByProps({ testID: 'search-input' }).props.onChangeText('최예나');
    });

    expect(__mock.setParams).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(249);
    });

    expect(__mock.setParams).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(__mock.setParams).toHaveBeenLastCalledWith({
      q: '최예나',
      segment: 'entities',
    });

    __mock.setParams.mockClear();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-segment-releases' }).props.onPress();
    });

    expect(__mock.setParams).toHaveBeenLastCalledWith({
      q: '최예나',
      segment: 'releases',
    });

    __mock.setParams.mockClear();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-clear-button' }).props.onPress();
    });

    expect(__mock.setParams).toHaveBeenLastCalledWith({
      q: undefined,
      segment: undefined,
    });
  });

  test('renders an explicit retry state when backend-primary search fails instead of stale fallback content', async () => {
    mockUseActiveDatasetScreen.mockReturnValue({
      kind: 'error',
      message: 'backend 검색 응답을 지금 불러오지 못했습니다.',
    });

    const tree = await renderSearchScreen();

    expect(hasText(tree, '검색')).toBe(true);
    expect(hasText(tree, 'backend 검색 응답을 지금 불러오지 못했습니다.')).toBe(true);
    expect(hasText(tree, '다시 시도')).toBe(true);
  });
});
