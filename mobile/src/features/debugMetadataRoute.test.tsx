import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function Redirect({ href }: { href: string }) {
    return React.createElement('redirect', { href });
  }

  function Stack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  Stack.Screen = function StackScreen(props: { name?: string; options?: object }) {
    return React.createElement('stack-screen', props);
  };

  return {
    Redirect,
    Stack,
  };
});

jest.mock('../components/launch/LaunchGate', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    LaunchGate: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../components/launch/PushNotificationRuntimeBoundary', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    PushNotificationRuntimeBoundary: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../tokens/theme', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    MobileThemeProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useAppTheme: jest.fn(() => ({})),
  };
});

function renderTree(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(element);
  });

  return tree!;
}

describe('debug metadata route gating', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('root layout omits the debug metadata route in production', () => {
    jest.doMock('../config/debugMetadata', () => ({
      isDebugMetadataAvailable: () => false,
    }));

    let RootLayout!: typeof import('../../app/_layout').default;
    jest.isolateModules(() => {
      RootLayout = require('../../app/_layout').default;
    });

    const tree = renderTree(<RootLayout />);
    const stackScreens = tree.root.findAll((node) => (node.type as unknown) === 'stack-screen');
    const routeNames = stackScreens.map((node) => node.props.name).filter(Boolean);

    expect(routeNames).not.toContain('debug/metadata');
  });

  test('root layout keeps the debug metadata route in non-production builds', () => {
    jest.doMock('../config/debugMetadata', () => ({
      isDebugMetadataAvailable: () => true,
    }));

    let RootLayout!: typeof import('../../app/_layout').default;
    jest.isolateModules(() => {
      RootLayout = require('../../app/_layout').default;
    });

    const tree = renderTree(<RootLayout />);
    const stackScreens = tree.root.findAll((node) => (node.type as unknown) === 'stack-screen');
    const routeNames = stackScreens.map((node) => node.props.name).filter(Boolean);

    expect(routeNames).toContain('debug/metadata');
  });

  test('debug metadata screen redirects to calendar in production without loading metadata', () => {
    const getDebugMetadata = jest.fn();

    jest.doMock('../config/debugMetadata', () => ({
      isDebugMetadataAvailable: () => false,
      getDebugMetadata,
    }));

    let DebugMetadataScreen!: typeof import('../../app/debug/metadata').default;
    jest.isolateModules(() => {
      DebugMetadataScreen = require('../../app/debug/metadata').default;
    });

    const tree = renderTree(<DebugMetadataScreen />);
    const redirectNode = tree.root.findByType('redirect' as never);

    expect(redirectNode.props.href).toBe('/(tabs)/calendar');
    expect(getDebugMetadata).not.toHaveBeenCalled();
  });
});
