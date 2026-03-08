import {
  MOBILE_STORAGE_KEYS,
  RECENT_QUERY_LIMIT,
  buildDatasetCacheKey,
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from './storage';
import {
  clearDatasetCacheEntry,
  getDatasetCacheKey,
  readDatasetCacheEntry,
  writeDatasetCacheEntry,
} from './datasetCache';
import { clearRecentQueries, persistRecentQuery, readRecentQueries } from './recentQueries';
import type { DatasetSelection } from './datasetSource';

function createMemoryStorage(): KeyValueStorageAdapter {
  const values = new Map<string, string>();

  return {
    async getItem(key) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

const bundledSelection: DatasetSelection = {
  kind: 'bundled-static',
  reason: 'profile_default',
  contractId: 'idol-song-mobile-static-v1',
  datasetVersion: 'v1',
  mixingAllowed: false,
  bundledBasePath: 'mobile/assets/datasets/v1',
  artifacts: [],
};

const previewSelection: DatasetSelection = {
  kind: 'preview-remote',
  reason: 'preview_remote_enabled',
  contractId: 'idol-song-mobile-static-v1',
  datasetVersion: 'preview-v2',
  mixingAllowed: false,
  remoteDatasetUrl: 'https://example.com/dataset.json',
  artifacts: [],
};

describe('mobile storage foundations', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('builds namespaced dataset cache keys', () => {
    expect(buildDatasetCacheKey('idol-song-mobile-static-v1', 'bundled-static', 'v1', 'releases')).toBe(
      'idol-song-app/mobile/v1/dataset-cache/idol-song-mobile-static-v1/bundled-static/v1/releases',
    );
    expect(buildDatasetCacheKey('idol-song-mobile-static-v1', 'bundled-static', null, 'releases')).toBe(
      'idol-song-app/mobile/v1/dataset-cache/idol-song-mobile-static-v1/bundled-static/unversioned/releases',
    );
  });

  test('round-trips dataset cache entries and isolates source selections', async () => {
    await writeDatasetCacheEntry('releases', { rows: 10 }, bundledSelection, '2026-03-08T00:00:00.000Z');
    await writeDatasetCacheEntry('releases', { rows: 12 }, previewSelection, '2026-03-08T01:00:00.000Z');

    await expect(readDatasetCacheEntry<{ rows: number }>('releases', bundledSelection)).resolves.toEqual({
      artifactId: 'releases',
      contractId: bundledSelection.contractId,
      datasetVersion: bundledSelection.datasetVersion,
      sourceKind: bundledSelection.kind,
      cachedAt: '2026-03-08T00:00:00.000Z',
      value: { rows: 10 },
    });

    await expect(readDatasetCacheEntry<{ rows: number }>('releases', previewSelection)).resolves.toEqual({
      artifactId: 'releases',
      contractId: previewSelection.contractId,
      datasetVersion: previewSelection.datasetVersion,
      sourceKind: previewSelection.kind,
      cachedAt: '2026-03-08T01:00:00.000Z',
      value: { rows: 12 },
    });

    await clearDatasetCacheEntry('releases', bundledSelection);
    await expect(readDatasetCacheEntry('releases', bundledSelection)).resolves.toBeNull();
    await expect(readDatasetCacheEntry('releases', previewSelection)).resolves.not.toBeNull();
    expect(getDatasetCacheKey('releases', bundledSelection)).not.toBe(getDatasetCacheKey('releases', previewSelection));
  });

  test('persists recent queries with dedupe, trim, and limit handling', async () => {
    await persistRecentQuery('  투바투 ');
    await persistRecentQuery('최예나');
    await persistRecentQuery('투바투');

    const queriesAfterDedupe = await readRecentQueries();
    expect(queriesAfterDedupe).toEqual(['투바투', '최예나']);

    for (let index = 0; index < RECENT_QUERY_LIMIT + 2; index += 1) {
      await persistRecentQuery(`query ${index}`);
    }

    const limitedQueries = await readRecentQueries();
    expect(limitedQueries).toHaveLength(RECENT_QUERY_LIMIT);
    expect(limitedQueries[0]).toBe(`query ${RECENT_QUERY_LIMIT + 1}`);
    expect(limitedQueries.at(-1)).toBe('query 2');
  });

  test('clears recent queries from the shared storage key', async () => {
    await persistRecentQuery('YENA');
    expect(await readRecentQueries()).toEqual(['YENA']);

    await clearRecentQueries();
    expect(await readRecentQueries()).toEqual([]);
    expect(MOBILE_STORAGE_KEYS.recentQueries).toBe('idol-song-app/mobile/v1/search/recent-queries');
  });
});
