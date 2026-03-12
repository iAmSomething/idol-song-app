import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import ArtistDetailScreen from '../../app/artists/[slug]';
import type { RuntimeConfigState } from '../config/runtime';
import { selectEntityDetailSnapshot } from '../selectors';
import { openXSearchHandoff } from '../services/handoff';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import {
  useActiveDatasetScreen,
  type ActiveDatasetScreenState,
} from './useActiveDatasetScreen';
import type { EntityDetailSnapshotModel } from '../types';

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
jest.mock('../services/handoff', () => {
  const actual = jest.requireActual('../services/handoff') as typeof import('../services/handoff');

  return {
    ...actual,
    openXSearchHandoff: jest.fn(),
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
  snapshot: EntityDetailSnapshotModel | null,
): ActiveDatasetScreenState<EntityDetailSnapshotModel | null> {
  return {
    kind: 'ready',
    source: {
      activeSource: 'backend-api',
      sourceLabel: 'Backend API',
      data: snapshot,
      freshness: {
        rollingReferenceAt: '2026-03-11T00:00:00.000Z',
        staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
      },
      issues: [],
      runtimeState: buildRuntimeState(),
    },
  };
}

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

function findByTestIdPrefix(tree: renderer.ReactTestRenderer, prefix: string) {
  return tree.root.find((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(prefix));
}

describe('mobile entity detail screen', () => {
  beforeEach(() => {
    __mock.useRouter.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
    });
    mockOpenXSearchHandoff.mockReset();
    mockOpenXSearchHandoff.mockResolvedValue({
      ok: true,
      mode: 'release_backed',
      target: 'web',
      openedUrl: 'https://x.com/search?q=YENA',
    });
    mockUseActiveDatasetScreen.mockImplementation((options) => {
      const slug = String(options.cacheKey).replace(/^entity:/, '');
      return buildReadyState(selectEntityDetailSnapshot(bundledFixture, slug, '2026-03-07'));
    });
  });

  test('renders populated entity detail sections for a tracked team', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ slug: 'yena' });
    const back = jest.fn();
    const push = jest.fn();
    __mock.useRouter.mockReturnValue({ back, push });
    const tree = await renderArtistDetail();

    expect(tree.root.findByProps({ testID: 'entity-detail-app-bar' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-detail-back' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-detail-title' }).props.children).toBe('YENA');
    expect(tree.root.findByProps({ testID: 'entity-official-link-x' }).props.accessibilityLabel).toBe(
      'YENA 공식 X 열기',
    );
    expect(tree.root.findByProps({ testID: 'entity-official-link-youtube' }).props.accessibilityLabel).toBe(
      'YENA 공식 YouTube 열기',
    );
    expect(tree.root.findByProps({ testID: 'entity-artist-source-link' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-next-upcoming-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-next-upcoming-x-search' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-latest-release-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-latest-release-primary' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-latest-release-service-spotify' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-latest-release-service-youtube-music' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'entity-latest-release-service-youtube-mv' })).toBeDefined();
    expect(findByTestIdPrefix(tree, 'entity-recent-album-single-card-')).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'entity-source-timeline' })).toHaveLength(0);

    await act(async () => {
      tree.root.findByProps({ testID: 'entity-source-timeline-toggle' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'entity-source-timeline' })).toBeDefined();

    await act(async () => {
      tree.root.findByProps({ testID: 'entity-detail-back' }).props.onPress();
      await tree.root.findByProps({ testID: 'entity-next-upcoming-x-search' }).props.onPress();
      tree.root.findByProps({ testID: 'entity-latest-release-primary' }).props.onPress();
      tree.root.findByProps({ testID: 'entity-recent-album-single-card-yena--love-catcher--2026-03-11--album' }).props.onPress();
    });

    expect(back).toHaveBeenCalledTimes(1);
    expect(mockOpenXSearchHandoff).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({
      pathname: '/releases/[id]',
      params: { id: 'yena--love-catcher--2026-03-11--album' },
    });
  });

  test('renders safe empty states when upcoming and albums are missing', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ slug: 'weeekly' });
    const tree = await renderArtistDetail();

    expect(tree.root.findByProps({ testID: 'entity-detail-title' }).props.children).toBe('Weeekly');
    expect(hasText(tree, '등록된 예정 컴백이 없습니다.')).toBe(true);
    expect(hasText(tree, '등록된 최근 앨범이 없습니다.')).toBe(true);
  });

  test('renders a safe recovery state for missing slugs', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ slug: 'no-such-team' });
    const tree = await renderArtistDetail();

    expect(tree.root.findByProps({ testID: 'entity-missing-state' })).toBeDefined();
    expect(hasText(tree, '해당 팀 데이터를 찾지 못했습니다.')).toBe(true);
  });
});
