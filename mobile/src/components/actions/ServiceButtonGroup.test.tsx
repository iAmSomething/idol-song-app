import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { ServiceButtonGroup } from './ServiceButtonGroup';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('ServiceButtonGroup', () => {
  test('renders service buttons and triggers enabled actions', async () => {
    const spotifyPress = jest.fn();
    const disabledPress = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <ServiceButtonGroup
          buttons={[
            {
              accessibilityLabel: 'Spotify 열기',
              key: 'spotify',
              label: 'Spotify',
              onPress: spotifyPress,
              testID: 'service-button-spotify',
              tone: 'spotify',
            },
            {
              accessibilityLabel: 'YT Music 열기',
              disabled: true,
              key: 'youtubeMusic',
              label: 'YT Music',
              onPress: disabledPress,
              testID: 'service-button-ytm',
              tone: 'youtubeMusic',
            },
          ]}
          testID="service-button-group"
        />,
      );
    });

    expect(tree!.root.findByProps({ testID: 'service-button-group' })).toBeDefined();
    expect(hasText(tree!, 'Spotify')).toBe(true);
    expect(hasText(tree!, 'YT Music')).toBe(true);
    expect(tree!.root.findByProps({ testID: 'service-button-ytm' }).props.disabled).toBe(true);

    await act(async () => {
      tree!.root.findByProps({ testID: 'service-button-spotify' }).props.onPress();
    });

    expect(spotifyPress).toHaveBeenCalledTimes(1);
    expect(disabledPress).not.toHaveBeenCalled();
  });
});
