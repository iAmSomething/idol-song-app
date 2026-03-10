import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TabsLayout from '../../app/(tabs)/_layout';
import CalendarTabScreen from '../../app/(tabs)/calendar';
import RadarTabScreen from '../../app/(tabs)/radar';
import SearchTabScreen from '../../app/(tabs)/search';
import RootLayout from '../../app/_layout';
import ArtistDetailScreen from '../../app/artists/[slug]';
import IndexRoute from '../../app/index';
import ReleaseDetailScreen from '../../app/releases/[id]';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const useLocalSearchParams = jest.fn(() => ({}));
  const useRouter = jest.fn(() => ({
    push: jest.fn(),
    setParams: jest.fn(),
  }));

  function Redirect({ href }: { href: string }) {
    return React.createElement('redirect', { href });
  }

  function Stack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  Stack.Screen = function StackScreen() {
    return null;
  };

  function Tabs({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  Tabs.Screen = function TabsScreen() {
    return null;
  };

  return {
    Redirect,
    Stack,
    Tabs,
    useRouter,
    useLocalSearchParams,
    __mock: {
      useRouter,
      useLocalSearchParams,
    },
  };
});

jest.mock('../features/useActiveDatasetScreen', () => {
  const { cloneBundledDatasetFixture } = jest.requireActual('../services/bundledDatasetFixture');
  const { createBundledDatasetSelection } = jest.requireActual('../services/datasetSource');

  return {
    useActiveDatasetScreen: jest.fn(() => ({
      kind: 'ready',
      source: {
        activeSource: 'bundled-static',
        cachedArtifactIds: [],
        dataset: cloneBundledDatasetFixture(),
        freshness: {
          rollingReferenceAt: null,
          staleFreshnessClasses: [],
        },
        selection: createBundledDatasetSelection('fixture-v1', 'profile_default'),
        runtimeState: {
          mode: 'normal',
          issues: [],
          config: {
            profile: 'development',
            dataSource: {
              mode: 'bundled-static',
              remoteDatasetUrl: null,
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
        },
        sourceLabel: 'Bundled static dataset',
        issues: [],
      },
    })),
  };
});

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useRouter: jest.Mock;
    useLocalSearchParams: jest.Mock;
  };
};

const mockUseRouter = __mock.useRouter;
const mockUseLocalSearchParams = __mock.useLocalSearchParams;

function renderTree(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(element);
  });

  return tree!;
}

async function renderTreeAsync(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(element);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

describe('mobile route shell smoke', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      setParams: jest.fn(),
    });
  });

  test('root index redirects to calendar tab', () => {
    const tree = renderTree(<IndexRoute />).toJSON() as renderer.ReactTestRendererJSON;
    expect(tree.props.href).toBe('/(tabs)/calendar');
  });

  test('root layout and tabs layout render without crashing', () => {
    expect(() => renderTree(<RootLayout />)).not.toThrow();
    expect(() => renderTree(<TabsLayout />)).not.toThrow();
  });

  test('tab placeholder screens render without crashing', async () => {
    await expect(renderTreeAsync(<CalendarTabScreen />)).resolves.toBeDefined();
    await expect(renderTreeAsync(<RadarTabScreen />)).resolves.toBeDefined();
    await expect(renderTreeAsync(<SearchTabScreen />)).resolves.toBeDefined();
  });

  test('artist detail placeholder handles valid and missing slug safely', () => {
    mockUseLocalSearchParams.mockReturnValueOnce({ slug: 'blackpink' });
    expect(() => renderTree(<ArtistDetailScreen />)).not.toThrow();

    mockUseLocalSearchParams.mockReturnValueOnce({});
    expect(() => renderTree(<ArtistDetailScreen />)).not.toThrow();
  });

  test('release detail screen handles valid and missing id safely', () => {
    mockUseLocalSearchParams.mockReturnValueOnce({ id: 'blackpink-deadline-2026-02-26' });
    expect(() => renderTree(<ReleaseDetailScreen />)).not.toThrow();

    mockUseLocalSearchParams.mockReturnValueOnce({});
    expect(() => renderTree(<ReleaseDetailScreen />)).not.toThrow();
  });
});
