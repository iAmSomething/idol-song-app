export type SearchNeedle = {
  raw: string;
  normalized: string;
  compact: string;
};

export type ReleaseLookupKey = {
  entity_slug: string;
  normalized_release_title: string;
  release_date: string;
  stream: string;
};

export function normalizeLookupText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[×✕]/g, 'x')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/['’`]/g, '');
}

export function collapseNormalizedText(value: string): string {
  return value
    .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAliasValue(value: string): string {
  return collapseNormalizedText(normalizeLookupText(value));
}

export function compactNormalizedAlias(value: string): string {
  return value.replace(/\s+/g, '');
}

export function buildSearchNeedle(raw: string): SearchNeedle | null {
  const normalized = normalizeAliasValue(raw);
  if (!normalized) {
    return null;
  }

  return {
    raw,
    normalized,
    compact: compactNormalizedAlias(normalized),
  };
}

export function normalizeSlugValue(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function normalizeReleaseLookupTitle(value: string): string {
  return normalizeAliasValue(value);
}

export function buildReleaseLookupKey(
  entitySlug: string,
  releaseTitle: string,
  releaseDate: string,
  stream: string,
): ReleaseLookupKey {
  return {
    entity_slug: normalizeSlugValue(entitySlug),
    normalized_release_title: normalizeReleaseLookupTitle(releaseTitle),
    release_date: releaseDate.trim(),
    stream: stream.trim().toLowerCase(),
  };
}
