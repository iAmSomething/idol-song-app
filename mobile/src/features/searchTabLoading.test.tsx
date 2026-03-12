import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import SearchTabScreen from '../../app/(tabs)/search';
import { resetStorageAdapter, setStorageAdapter, type KeyValueStorageAdapter } from '../services/storage';

let mockRouteParams: Record<string, string> = {};
const mockUseActiveDatasetScreen = jest.fn();

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

jest.mock('../features/useActiveDatasetScreen', () => ({
  useActiveDatasetScreen: (...args: unknown[]) => mockUseActiveDatasetScreen(...args),
}));

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    setLocalSearchParams: (nextParams: Record<string, string>) => void;
  };
};

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

describe('mobile search loading presentation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setStorageAdapter(createMemoryStorage());
    __mock.setLocalSearchParams({});
    mockUseActiveDatasetScreen.mockReset();
    mockUseActiveDatasetScreen.mockReturnValue({ kind: 'loading' });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    resetStorageAdapter();
  });

  test('keeps search chrome visible during in-flight query refresh', async () => {
    __mock.setLocalSearchParams({
      q: '최예나',
      segment: 'entities',
    });

    const tree = await renderSearchScreen();

    expect(tree.root.findByProps({ testID: 'search-input' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'search-loading-notice' })).toBeDefined();
    expect(hasText(tree, '검색 업데이트 중')).toBe(true);

    await act(async () => {
      tree.unmount();
    });
  });

  test('uses full-screen loading for the initial empty load', async () => {
    const tree = await renderSearchScreen();

    expect(tree.root.findAllByProps({ testID: 'search-input' })).toHaveLength(0);
    expect(hasText(tree, '검색 대상 팀, 발매, 예정 데이터를 불러오는 중입니다.')).toBe(true);

    await act(async () => {
      tree.unmount();
    });
  });
});
