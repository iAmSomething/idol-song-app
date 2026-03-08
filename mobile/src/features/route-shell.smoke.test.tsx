import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TabsLayout from '../../app/(tabs)/_layout';
import CalendarTabScreen from '../../app/(tabs)/calendar';
import RadarTabScreen from '../../app/(tabs)/radar';
import SearchTabScreen from '../../app/(tabs)/search';
import RootLayout from '../../app/_layout';
import ArtistDetailPlaceholderScreen from '../../app/artists/[slug]';
import IndexRoute from '../../app/index';
import ReleaseDetailPlaceholderScreen from '../../app/releases/[id]';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const useLocalSearchParams = jest.fn(() => ({}));
  const useRouter = jest.fn(() => ({
    push: jest.fn(),
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
    expect(() => renderTree(<ArtistDetailPlaceholderScreen />)).not.toThrow();

    mockUseLocalSearchParams.mockReturnValueOnce({});
    expect(() => renderTree(<ArtistDetailPlaceholderScreen />)).not.toThrow();
  });

  test('release detail placeholder handles valid and missing id safely', () => {
    mockUseLocalSearchParams.mockReturnValueOnce({ id: 'blackpink-deadline-2026-02-26' });
    expect(() => renderTree(<ReleaseDetailPlaceholderScreen />)).not.toThrow();

    mockUseLocalSearchParams.mockReturnValueOnce({});
    expect(() => renderTree(<ReleaseDetailPlaceholderScreen />)).not.toThrow();
  });
});
