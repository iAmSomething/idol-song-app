import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TabsLayout from './(tabs)/_layout';
import CalendarTabScreen from './(tabs)/calendar';
import RadarTabScreen from './(tabs)/radar';
import SearchTabScreen from './(tabs)/search';
import RootLayout from './_layout';
import ArtistDetailPlaceholderScreen from './artists/[slug]';
import IndexRoute from './index';
import ReleaseDetailPlaceholderScreen from './releases/[id]';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const useLocalSearchParams = jest.fn(() => ({}));

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
    useLocalSearchParams,
    __mock: {
      useLocalSearchParams,
    },
  };
});

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
  };
};

const mockUseLocalSearchParams = __mock.useLocalSearchParams;

function renderTree(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(element);
  });

  return tree!;
}

describe('mobile route shell smoke', () => {
  test('root index redirects to calendar tab', () => {
    const tree = renderTree(<IndexRoute />).toJSON() as renderer.ReactTestRendererJSON;
    expect(tree.props.href).toBe('/(tabs)/calendar');
  });

  test('root layout and tabs layout render without crashing', () => {
    expect(() => renderTree(<RootLayout />)).not.toThrow();
    expect(() => renderTree(<TabsLayout />)).not.toThrow();
  });

  test('tab placeholder screens render without crashing', () => {
    expect(() => renderTree(<CalendarTabScreen />)).not.toThrow();
    expect(() => renderTree(<RadarTabScreen />)).not.toThrow();
    expect(() => renderTree(<SearchTabScreen />)).not.toThrow();
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
