import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import SearchTabScreen from '../../app/(tabs)/search';
import { trackAnalyticsEvent, trackDatasetDegraded, trackDatasetLoadFailed } from '../services/analytics';
import { persistRecentQuery, readRecentQueries } from '../services/recentQueries';
import { resetStorageAdapter, setStorageAdapter, type KeyValueStorageAdapter } from '../services/storage';

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
  const setParams = jest.fn();
  const useLocalSearchParams = jest.fn(() => ({}));

  return {
    useRouter: () => ({ push, setParams }),
    useLocalSearchParams,
    __mock: { push, setParams, useLocalSearchParams },
  };
});

jest.mock('../services/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
  trackDatasetDegraded: jest.fn(),
  trackDatasetLoadFailed: jest.fn(),
}));

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    push: jest.Mock;
    setParams: jest.Mock;
    useLocalSearchParams: jest.Mock;
  };
};
const mockTrackAnalyticsEvent = jest.mocked(trackAnalyticsEvent);
const mockTrackDatasetDegraded = jest.mocked(trackDatasetDegraded);
const mockTrackDatasetLoadFailed = jest.mocked(trackDatasetLoadFailed);

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

describe('mobile search tab', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
    __mock.useLocalSearchParams.mockReturnValue({});
    __mock.setParams.mockClear();
    __mock.push.mockClear();
    mockTrackAnalyticsEvent.mockClear();
    mockTrackDatasetDegraded.mockClear();
    mockTrackDatasetLoadFailed.mockClear();
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('renders sectioned results for alias queries and persists recent searches on submit', async () => {
    const tree = await renderSearchScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-input' }).props.onChangeText('최예나');
    });

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

    await act(async () => {
      tree.root.findByProps({ testID: 'search-segment-releases' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'search-release-result-yena--love-catcher--2026-03-11--album' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'search-segment-upcoming' }).props.onPress();
    });

    expect(
      tree.root.findByProps({
        testID: 'search-upcoming-result-yena--yena-confirms-a-march-11-comeback--2026-03-11--album',
      }),
    ).toBeDefined();

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
    __mock.useLocalSearchParams.mockReturnValue({
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
});
