import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { TrackRow } from './TrackRow';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('TrackRow', () => {
  test('renders title-track badge and track actions', async () => {
    const spotifyPress = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <TrackRow
          isTitleTrack
          order={1}
          spotifyButton={{
            accessibilityLabel: 'Spotify에서 BLACKHOLE 열기',
            label: 'Spotify',
            onPress: spotifyPress,
            testID: 'track-row-spotify',
          }}
          testIDPrefix="track-row"
          title="BLACKHOLE"
        />,
      );
    });

    expect(tree!.root.findByProps({ testID: 'track-row-1' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'track-row-title-badge-1' })).toBeDefined();
    expect(hasText(tree!, 'BLACKHOLE')).toBe(true);
    expect(
      tree!.root.findAllByType(Text).find((node) => node.props.children === 'BLACKHOLE')?.props.numberOfLines,
    ).toBe(2);

    await act(async () => {
      tree!.root.findByProps({ testID: 'track-row-spotify' }).props.onPress();
    });

    expect(spotifyPress).toHaveBeenCalledTimes(1);
  });
});
