import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { CompactHero } from './CompactHero';
import { InsetSection } from './InsetSection';
import { TonalPanel } from './TonalPanel';

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('surface primitives', () => {
  test('renders tonal panel with copy and footer content', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <TonalPanel
          body="dataset source warning"
          eyebrow="runtime"
          footer={<Text>retry</Text>}
          title="degraded state"
          tone="accent"
        />,
      );
    });

    expect(hasText(tree!, 'runtime')).toBe(true);
    expect(hasText(tree!, 'degraded state')).toBe(true);
    expect(hasText(tree!, 'dataset source warning')).toBe(true);
    expect(hasText(tree!, 'retry')).toBe(true);
  });

  test('renders inset section with description and accessory', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <InsetSection accessory={<Text>2건</Text>} description="release list" title="최근 앨범들">
          <Text>album row</Text>
        </InsetSection>,
      );
    });

    expect(hasText(tree!, '최근 앨범들')).toBe(true);
    expect(hasText(tree!, 'release list')).toBe(true);
    expect(hasText(tree!, '2건')).toBe(true);
    expect(hasText(tree!, 'album row')).toBe(true);
  });

  test('renders compact hero with media and footer slots', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <CompactHero
          body="빠른 요약"
          eyebrow="GROUP"
          footer={<Text>official links</Text>}
          media={<Text>media</Text>}
          meta="agency"
          secondaryMeta="2026-03-11"
          title="YENA"
        />,
      );
    });

    expect(hasText(tree!, 'GROUP')).toBe(true);
    expect(hasText(tree!, 'YENA')).toBe(true);
    expect(hasText(tree!, 'agency')).toBe(true);
    expect(hasText(tree!, '2026-03-11')).toBe(true);
    expect(hasText(tree!, '빠른 요약')).toBe(true);
    expect(hasText(tree!, 'official links')).toBe(true);
  });
});
