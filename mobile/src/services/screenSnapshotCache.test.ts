import {
  clearScreenSnapshotCacheEntry,
  readScreenSnapshotCacheEntry,
  writeScreenSnapshotCacheEntry,
} from './screenSnapshotCache';
import {
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from './storage';

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

describe('screen snapshot cache', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('round-trips serializable screen payloads with cache metadata', async () => {
    await writeScreenSnapshotCacheEntry(
      'calendar',
      'calendar:2026-03:2026-03-10',
      {
        month: '2026-03',
        releaseCount: 1,
      },
      {
        cachedAt: '2026-03-10T00:01:00.000Z',
        generatedAt: '2026-03-10T00:00:00.000Z',
      },
    );

    await expect(
      readScreenSnapshotCacheEntry<{ month: string; releaseCount: number }>(
        'calendar',
        'calendar:2026-03:2026-03-10',
      ),
    ).resolves.toEqual({
      surface: 'calendar',
      cacheKey: 'calendar:2026-03:2026-03-10',
      cachedAt: '2026-03-10T00:01:00.000Z',
      generatedAt: '2026-03-10T00:00:00.000Z',
      value: {
        month: '2026-03',
        releaseCount: 1,
      },
    });

    await clearScreenSnapshotCacheEntry('calendar', 'calendar:2026-03:2026-03-10');
    await expect(
      readScreenSnapshotCacheEntry('calendar', 'calendar:2026-03:2026-03-10'),
    ).resolves.toBeNull();
  });
});
