import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';

import { ServiceButton } from './ServiceButton';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('ServiceButton', () => {
  test('renders the service icon by default', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <ServiceButton
          accessibilityLabel="Spotify 열기"
          label="Spotify"
          testID="service-button-spotify"
          tone="spotify"
        />,
      );
    });

    expect(tree!.root.findByProps({ testID: 'service-button-spotify-icon' })).toBeDefined();
    expect(tree!.root.findAllByProps({ testID: 'service-button-spotify-fallback-glyph' })).toHaveLength(0);
  });

  test('shows a visible fallback glyph when the icon asset fails to load', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <ServiceButton
          accessibilityLabel="YouTube Music 열기"
          label="YouTube Music"
          testID="service-button-youtube-music"
          tone="youtubeMusic"
        />,
      );
    });

    await act(async () => {
      tree!.root.findByType(Image).props.onError?.();
    });

    expect(tree!.root.findByProps({ testID: 'service-button-youtube-music-fallback-glyph' })).toBeDefined();
    expect(hasText(tree!, 'YM')).toBe(true);
  });
});
