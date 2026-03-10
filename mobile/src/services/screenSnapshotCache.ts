import {
  buildScreenSnapshotCacheKey,
  readStoredJson,
  removeStoredJson,
  writeStoredJson,
} from './storage';

export type ScreenSnapshotCacheEntry<T> = {
  surface: string;
  cacheKey: string;
  cachedAt: string;
  generatedAt: string | null;
  value: T;
};

export function getScreenSnapshotCacheStorageKey(surface: string, cacheKey: string): string {
  return buildScreenSnapshotCacheKey(surface, cacheKey);
}

export async function readScreenSnapshotCacheEntry<T>(
  surface: string,
  cacheKey: string,
): Promise<ScreenSnapshotCacheEntry<T> | null> {
  return readStoredJson<ScreenSnapshotCacheEntry<T>>(getScreenSnapshotCacheStorageKey(surface, cacheKey));
}

export async function writeScreenSnapshotCacheEntry<T>(
  surface: string,
  cacheKey: string,
  value: T,
  options: {
    cachedAt?: string;
    generatedAt?: string | null;
  } = {},
): Promise<ScreenSnapshotCacheEntry<T>> {
  const entry: ScreenSnapshotCacheEntry<T> = {
    surface,
    cacheKey,
    cachedAt: options.cachedAt ?? new Date().toISOString(),
    generatedAt: options.generatedAt ?? null,
    value,
  };

  await writeStoredJson(getScreenSnapshotCacheStorageKey(surface, cacheKey), entry);
  return entry;
}

export async function clearScreenSnapshotCacheEntry(surface: string, cacheKey: string): Promise<void> {
  await removeStoredJson(getScreenSnapshotCacheStorageKey(surface, cacheKey));
}
