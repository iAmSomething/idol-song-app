export const RUNTIME_SYNC_KEYS = [
  'APP_ENV',
  'APP_TIMEZONE',
  'DB_CONNECTION_TIMEOUT_MS',
  'DB_READ_TIMEOUT_MS',
  'WEB_ALLOWED_ORIGINS',
  'LOG_LEVEL',
  'WORKER_CADENCE_LABEL',
];

export const LEGACY_RUNTIME_SYNC_KEYS = ['PORT'];

export const MANAGED_RUNTIME_KEYS = [...new Set([...RUNTIME_SYNC_KEYS, ...LEGACY_RUNTIME_SYNC_KEYS])];

export function buildDesiredRuntimeEnv(exampleMap) {
  const desiredEntries = [];

  for (const key of RUNTIME_SYNC_KEYS) {
    if (!exampleMap.has(key)) {
      continue;
    }

    desiredEntries.push([key, exampleMap.get(key) ?? '']);
  }

  return new Map(desiredEntries);
}

export function computeRuntimeEnvUpdates(currentEnv, desiredEnv) {
  const updates = [];
  const unchanged = [];
  const deletions = [];

  for (const [key, desiredValue] of desiredEnv.entries()) {
    const currentValue = currentEnv.get(key);
    if (currentValue === desiredValue) {
      unchanged.push({ key, value: desiredValue });
      continue;
    }

    updates.push({
      key,
      previousValue: currentValue ?? null,
      nextValue: desiredValue,
    });
  }

  for (const key of MANAGED_RUNTIME_KEYS) {
    if (desiredEnv.has(key)) {
      continue;
    }

    const currentValue = currentEnv.get(key);
    if (currentValue === undefined) {
      continue;
    }

    deletions.push({
      key,
      previousValue: currentValue,
    });
  }

  return {
    updates,
    unchanged,
    deletions,
  };
}
