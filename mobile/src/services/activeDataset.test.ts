import { loadBundledFixtureDataset } from './activeDataset';

describe('loadBundledFixtureDataset', () => {
  test('returns bundled fixture data for debug-only workflows', async () => {
    const result = await loadBundledFixtureDataset();

    expect(result.activeSource).toBe('bundled-fixture');
    expect(result.sourceLabel).toBe('Bundled fixture dataset (debug only)');
    expect(result.dataset.artistProfiles.length).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });

  test('dedupes extra issue messages', async () => {
    const result = await loadBundledFixtureDataset(['fixture missing link', 'fixture missing link']);

    expect(result.issues).toEqual(['fixture missing link']);
  });
});
