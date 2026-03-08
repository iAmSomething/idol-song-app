import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import ReleaseDetailScreen from '../../app/releases/[id]';

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

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
    useRouter: jest.Mock;
  };
};

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
    __mock.useRouter.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
    });
  });

  test('renders populated release detail sections for a canonical release', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'yena--love-catcher--2026-03-11--album' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('LOVE CATCHER');
    expect(tree.root.findByProps({ testID: 'release-service-spotify' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-service-youtube-music' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-service-youtube-mv' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-track-row-1' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-track-title-badge-1' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-mv-card' })).toBeDefined();
  });

  test('renders safe partial states for releases without track or mv links', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'atheart--glow-up--2025-11-18--song' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('Glow Up');
    expect(tree.root.findByProps({ testID: 'release-empty-tracks' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'release-mv-state' })).toBeDefined();
    expect(hasText(tree, '현재는 공식 MV가 등록되지 않았습니다.')).toBe(true);
  });

  test('renders a safe recovery state for missing release ids', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'no-such-release' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-missing-state' })).toBeDefined();
    expect(hasText(tree, '해당 릴리즈 상세 데이터를 찾지 못했습니다.')).toBe(true);
  });
});
