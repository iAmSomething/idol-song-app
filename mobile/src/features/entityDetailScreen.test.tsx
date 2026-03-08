import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import ArtistDetailScreen from '../../app/artists/[slug]';

jest.mock('expo-router', () => {
  const useLocalSearchParams = jest.fn(() => ({ slug: 'yena' }));
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

async function renderArtistDetail() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<ArtistDetailScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('mobile entity detail screen', () => {
  beforeEach(() => {
    __mock.useRouter.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
    });
  });

  test('renders populated entity detail sections for a tracked team', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ slug: 'yena' });
    const tree = await renderArtistDetail();

    expect(tree.root.findByProps({ testID: 'entity-detail-title' }).props.children).toBe('YENA');
    expect(tree.root.findByProps({ testID: 'entity-official-link-youtube' }).props.accessibilityLabel).toBe(
      'YENA 공식 YouTube 열기',
    );
    expect(tree.root.findByProps({ testID: 'entity-next-upcoming-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-latest-release-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-source-timeline' })).toBeDefined();
  });

  test('renders safe empty states for sparse teams', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ slug: 'atheart' });
    const tree = await renderArtistDetail();

    expect(tree.root.findByProps({ testID: 'entity-detail-title' }).props.children).toBe('AtHeart');
    expect(hasText(tree, '등록된 최근 앨범이 없습니다.')).toBe(true);
  });

  test('renders a safe recovery state for missing slugs', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ slug: 'no-such-team' });
    const tree = await renderArtistDetail();

    expect(tree.root.findByProps({ testID: 'entity-missing-state' })).toBeDefined();
    expect(hasText(tree, '해당 팀 데이터를 찾지 못했습니다.')).toBe(true);
  });
});
