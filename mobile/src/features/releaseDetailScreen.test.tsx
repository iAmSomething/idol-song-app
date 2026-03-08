import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import ReleaseDetailScreen from '../../app/releases/[id]';
import {
  openServiceHandoff,
  type ServiceHandoffFailure,
  type ServiceHandoffResolution,
} from '../services/handoff';

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

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
    useRouter: jest.Mock;
  };
};

const mockOpenServiceHandoff = openServiceHandoff as jest.MockedFunction<typeof openServiceHandoff>;

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
    mockOpenServiceHandoff.mockClear();
  });

  test('renders populated release detail sections for a canonical release', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ id: 'yena--love-catcher--2026-03-11--album' });
    const tree = await renderReleaseDetail();

    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('LOVE CATCHER');
    expect(tree.root.findByProps({ testID: 'release-service-spotify' }).props.accessibilityLabel).toBe(
      'Spotify에서 LOVE CATCHER 열기',
    );
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
        message: 'External handoff failed. Keep the current route stack and show retry feedback.',
      },
    });

    const tree = await renderReleaseDetail();

    await act(async () => {
      tree.root.findByProps({ testID: 'release-service-spotify' }).props.onPress();
      await Promise.resolve();
    });

    expect(hasText(tree, 'External handoff failed. Keep the current route stack and show retry feedback.')).toBe(
      true,
    );
    expect(tree.root.findByProps({ testID: 'release-detail-title' }).props.children).toBe('LOVE CATCHER');
  });
});
