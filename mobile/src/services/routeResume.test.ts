import {
  MOBILE_STORAGE_KEYS,
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from './storage';
import {
  clearPendingRouteResume,
  consumePendingRouteResume,
  readPendingRouteResume,
  runWithPendingRouteResume,
  writePendingRouteResume,
} from './routeResume';

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

describe('mobile route resume storage', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('writes and reads a pending resume target with sanitized params', async () => {
    await writePendingRouteResume({
      pathname: '/(tabs)/search',
      params: {
        q: ' 최예나 ',
        segment: 'upcoming',
        empty: '   ',
      },
    }, { createdAt: '2026-03-11T00:00:00.000Z' });

    await expect(readPendingRouteResume()).resolves.toEqual({
      createdAt: '2026-03-11T00:00:00.000Z',
      reason: 'external_handoff',
      target: {
        pathname: '/(tabs)/search',
        params: {
          q: '최예나',
          segment: 'upcoming',
        },
      },
    });
    expect(MOBILE_STORAGE_KEYS.pendingRouteResume).toBe(
      'idol-song-app/mobile/v1/navigation/pending-route-resume',
    );
  });

  test('consumes pending route once and clears the stored entry', async () => {
    await writePendingRouteResume(
      {
        pathname: '/artists/[slug]',
        params: { slug: 'yena' },
      },
      { createdAt: '2026-03-11T00:00:00.000Z' },
    );

    await expect(
      consumePendingRouteResume({
        now: new Date('2026-03-11T00:02:00.000Z'),
      }),
    ).resolves.toEqual({
      pathname: '/artists/[slug]',
      params: { slug: 'yena' },
    });
    await expect(readPendingRouteResume()).resolves.toBeNull();
  });

  test('drops expired pending routes', async () => {
    await writePendingRouteResume(
      {
        pathname: '/releases/[id]',
        params: { id: 'yena--love-catcher--2026-03-11--album' },
      },
      { createdAt: '2026-03-11T00:00:00.000Z' },
    );

    await expect(
      consumePendingRouteResume({
        now: new Date('2026-03-11T00:10:01.000Z'),
        maxAgeMs: 10 * 60 * 1000,
      }),
    ).resolves.toBeNull();
    await expect(readPendingRouteResume()).resolves.toBeNull();
  });

  test('keeps a pending route only when the external handoff succeeds', async () => {
    const success = await runWithPendingRouteResume(
      {
        pathname: '/artists/[slug]',
        params: { slug: 'yena' },
      },
      async () => ({ ok: true as const }),
    );
    expect(success.ok).toBe(true);
    await expect(readPendingRouteResume()).resolves.toEqual({
      createdAt: expect.any(String),
      reason: 'external_handoff',
      target: {
        pathname: '/artists/[slug]',
        params: { slug: 'yena' },
      },
    });

    await clearPendingRouteResume();

    const failure = await runWithPendingRouteResume(
      {
        pathname: '/artists/[slug]',
        params: { slug: 'yena' },
      },
      async () => ({ ok: false as const }),
    );
    expect(failure.ok).toBe(false);
    await expect(readPendingRouteResume()).resolves.toBeNull();
  });
});
