import { MOBILE_STORAGE_KEYS, RECENT_QUERY_LIMIT, readStoredJson, removeStoredJson, writeStoredJson } from './storage';

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function comparisonKey(value: string): string {
  return normalizeQuery(value).normalize('NFKC').toLowerCase();
}

export async function readRecentQueries(): Promise<string[]> {
  const stored = await readStoredJson<unknown>(MOBILE_STORAGE_KEYS.recentQueries);

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .filter((item): item is string => typeof item === 'string')
    .map(normalizeQuery)
    .filter(Boolean)
    .slice(0, RECENT_QUERY_LIMIT);
}

export async function persistRecentQuery(query: string): Promise<string[]> {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return readRecentQueries();
  }

  const existing = await readRecentQueries();
  const next = [
    normalized,
    ...existing.filter((item) => comparisonKey(item) !== comparisonKey(normalized)),
  ].slice(0, RECENT_QUERY_LIMIT);

  await writeStoredJson(MOBILE_STORAGE_KEYS.recentQueries, next);
  return next;
}

export async function clearRecentQueries(): Promise<void> {
  await removeStoredJson(MOBILE_STORAGE_KEYS.recentQueries);
}
