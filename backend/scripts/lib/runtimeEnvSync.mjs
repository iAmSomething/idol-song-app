export const RUNTIME_SYNC_KEYS = [
  'APP_ENV',
  'PORT',
  'APP_TIMEZONE',
  'DB_CONNECTION_TIMEOUT_MS',
  'DB_READ_TIMEOUT_MS',
  'WEB_ALLOWED_ORIGINS',
  'LOG_LEVEL',
  'WORKER_CADENCE_LABEL',
];

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

  return {
    updates,
    unchanged,
  };
}
