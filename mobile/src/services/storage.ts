import AsyncStorage from '@react-native-async-storage/async-storage';

export type KeyValueStorageAdapter = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export const MOBILE_STORAGE_NAMESPACE = 'idol-song-app/mobile/v1';
export const RECENT_QUERY_LIMIT = 10;
export const RECENT_QUERY_MAX_LENGTH = 80;

let storageAdapter: KeyValueStorageAdapter = AsyncStorage;

function buildNamespacedKey(scope: string, key: string): string {
  return `${MOBILE_STORAGE_NAMESPACE}/${scope}/${key}`;
}

export const MOBILE_STORAGE_KEYS = {
  recentQueries: buildNamespacedKey('search', 'recent-queries'),
} as const;

export function getStorageAdapter(): KeyValueStorageAdapter {
  return storageAdapter;
}

export function setStorageAdapter(nextAdapter: KeyValueStorageAdapter): void {
  storageAdapter = nextAdapter;
}

export function resetStorageAdapter(): void {
  storageAdapter = AsyncStorage;
}

export function buildDatasetCacheKey(
  contractId: string,
  sourceKind: string,
  datasetVersion: string | null,
  artifactId: string,
): string {
  return buildNamespacedKey(
    'dataset-cache',
    `${contractId}/${sourceKind}/${datasetVersion ?? 'unversioned'}/${artifactId}`,
  );
}

export function buildScreenSnapshotCacheKey(surface: string, cacheKey: string): string {
  return buildNamespacedKey('screen-cache', `${surface}/${cacheKey}`);
}

export async function readStoredJson<T>(storageKey: string): Promise<T | null> {
  const raw = await storageAdapter.getItem(storageKey);

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeStoredJson(storageKey: string, value: unknown): Promise<void> {
  await storageAdapter.setItem(storageKey, JSON.stringify(value));
}

export async function removeStoredJson(storageKey: string): Promise<void> {
  await storageAdapter.removeItem(storageKey);
}
