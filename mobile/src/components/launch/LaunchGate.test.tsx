import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { LaunchGate } from './LaunchGate';
import { MobileThemeProvider } from '../../tokens/theme';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe('LaunchGate', () => {
  afterEach(() => {
    jest.useRealTimers();
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test('shows the launch overlay briefly before revealing the app chrome', async () => {
    jest.useFakeTimers();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <MobileThemeProvider schemeOverride="light">
          <LaunchGate>
            <Text>앱 본문</Text>
          </LaunchGate>
        </MobileThemeProvider>,
      );
    });

    expect(tree!.root.findByProps({ testID: 'launch-gate-overlay' })).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    expect(tree!.root.findAllByProps({ testID: 'launch-gate-overlay' })).toHaveLength(0);
  });

  test('skips long animation when reduced motion is enabled', async () => {
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(true);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <MobileThemeProvider schemeOverride="light">
          <LaunchGate>
            <Text>앱 본문</Text>
          </LaunchGate>
        </MobileThemeProvider>,
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(140);
    });

    expect(tree!.root.findAllByProps({ testID: 'launch-gate-overlay' })).toHaveLength(0);
  });
});
