function normalizeHttpsOrigin(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') {
      return null;
    }

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function collectUrlCandidates(value, bucket) {
  if (typeof value === 'string') {
    const normalized = normalizeHttpsOrigin(value);
    if (normalized) {
      bucket.push(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectUrlCandidates(entry, bucket);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      collectUrlCandidates(nestedValue, bucket);
    }
  }
}

function extractTextCandidates(text) {
  const bucket = [];
  const matches = text.matchAll(/\bhttps:\/\/[a-zA-Z0-9.-]+\b|\b[a-zA-Z0-9.-]+\.up\.railway\.app\b/gu);
  for (const match of matches) {
    const normalized = normalizeHttpsOrigin(match[0]);
    if (normalized) {
      bucket.push(normalized);
    }
  }
  return bucket;
}

export function extractBackendPublicUrlCandidates(rawOutput) {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return [];
  }

  const bucket = [];
  try {
    const parsed = JSON.parse(trimmed);
    collectUrlCandidates(parsed, bucket);
  } catch {
    bucket.push(...extractTextCandidates(trimmed));
  }

  if (bucket.length === 0) {
    bucket.push(...extractTextCandidates(trimmed));
  }

  return [...new Set(bucket)];
}

export function selectBackendPublicUrl(candidates, options = {}) {
  const normalizedCandidates = [...new Set(candidates.map((value) => normalizeHttpsOrigin(value)).filter(Boolean))];
  const productionUrl = options.productionUrl ? normalizeHttpsOrigin(options.productionUrl) : null;
  const filtered = productionUrl
    ? normalizedCandidates.filter((value) => value !== productionUrl)
    : normalizedCandidates;

  if (filtered.length === 0) {
    return null;
  }

  const railwayProvided = filtered.filter((value) => value.includes('.up.railway.app'));
  if (railwayProvided.length > 0) {
    return railwayProvided[0];
  }

  return filtered[0];
}

export function urlsAreSameOrigin(left, right) {
  const leftNormalized = normalizeHttpsOrigin(left);
  const rightNormalized = normalizeHttpsOrigin(right);
  return Boolean(leftNormalized && rightNormalized && leftNormalized === rightNormalized);
}
