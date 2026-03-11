import {
  launchMarkAssets,
  placeholderAssets,
  badgeFallbackAssets,
  resolveFallbackArtSource,
  resolveLaunchMarkSource,
} from './assetRegistry';

describe('asset registry', () => {
  test('resolves placeholder assets by scheme', () => {
    expect(resolveFallbackArtSource('cover', 'light')).toBe(placeholderAssets.light.cover);
    expect(resolveFallbackArtSource('cover', 'dark')).toBe(placeholderAssets.dark.cover);
    expect(resolveFallbackArtSource('emptyState', 'dark')).toBe(placeholderAssets.dark.emptyState);
  });

  test('resolves badge assets by scheme', () => {
    expect(resolveFallbackArtSource('group', 'light')).toBe(badgeFallbackAssets.light.group);
    expect(resolveFallbackArtSource('solo', 'dark')).toBe(badgeFallbackAssets.dark.solo);
    expect(resolveFallbackArtSource('label', 'dark')).toBe(badgeFallbackAssets.dark.label);
  });

  test('resolves launch mark by scheme', () => {
    expect(resolveLaunchMarkSource('light')).toBe(launchMarkAssets.light);
    expect(resolveLaunchMarkSource('dark')).toBe(launchMarkAssets.dark);
  });
});
