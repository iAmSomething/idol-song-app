import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { TeamIdentityRow } from './TeamIdentityRow';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('TeamIdentityRow', () => {
  test('renders canonical badge image when remote badge is available', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <TeamIdentityRow
          badgeImageUrl="https://example.com/ab6ix-badge.png"
          meta="brand new album"
          name="AB6IX"
          testID="team-identity"
        />,
      );
    });

    expect(hasText(tree!, 'AB6IX')).toBe(true);
    expect(hasText(tree!, 'brand new album')).toBe(true);
    expect(tree!.root.findByProps({ testID: 'team-identity-badge-image' })).toBeDefined();
    expect(tree!.root.findAllByProps({ testID: 'team-identity-fallback-badge' })).toHaveLength(0);
  });

  test('renders fallback badge art when remote badge is missing', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <TeamIdentityRow
          fallbackAssetKey="solo"
          meta="solo act"
          monogram="YE"
          name="YENA"
          testID="team-identity"
        />,
      );
    });

    expect(hasText(tree!, 'YENA')).toBe(true);
    expect(hasText(tree!, 'solo act')).toBe(true);
    expect(tree!.root.findByProps({ testID: 'team-identity-fallback-badge' })).toBeDefined();
    expect(tree!.root.findAllByProps({ testID: 'team-identity-badge-image' })).toHaveLength(0);
  });
});
