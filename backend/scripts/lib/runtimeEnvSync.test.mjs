import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDesiredRuntimeEnv, computeRuntimeEnvUpdates, RUNTIME_SYNC_KEYS } from './runtimeEnvSync.mjs';

function parseKv(content) {
  const map = new Map();

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length === 0) {
      continue;
    }
    map.set(key, value);
  }

  return map;
}

test('buildDesiredRuntimeEnv selects only managed runtime keys', () => {
  const example = parseKv(`
APP_ENV=production
DATABASE_URL=postgresql://ignored
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://iamsomething.github.io
LOG_LEVEL=info
WORKER_CADENCE_LABEL=production-scheduled
UNRELATED=value
`);

  const desired = buildDesiredRuntimeEnv(example);
  assert.deepEqual([...desired.keys()], RUNTIME_SYNC_KEYS);
  assert.equal(desired.get('WEB_ALLOWED_ORIGINS'), 'https://iamsomething.github.io');
  assert.equal(desired.has('DATABASE_URL'), false);
  assert.equal(desired.has('UNRELATED'), false);
});

test('computeRuntimeEnvUpdates reports drift and unchanged values', () => {
  const current = parseKv(`
APP_ENV=preview
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
LOG_LEVEL=info
WORKER_CADENCE_LABEL=preview-manual
`);

  const desired = new Map([
    ['APP_ENV', 'production'],
    ['APP_TIMEZONE', 'Asia/Seoul'],
    ['DB_CONNECTION_TIMEOUT_MS', '3000'],
    ['DB_READ_TIMEOUT_MS', '5000'],
    ['WEB_ALLOWED_ORIGINS', 'https://iamsomething.github.io'],
    ['LOG_LEVEL', 'info'],
    ['WORKER_CADENCE_LABEL', 'production-scheduled'],
  ]);

  const result = computeRuntimeEnvUpdates(current, desired);
  assert.deepEqual(
    result.updates.map((entry) => entry.key),
    ['APP_ENV', 'WEB_ALLOWED_ORIGINS', 'WORKER_CADENCE_LABEL'],
  );
  assert.deepEqual(
    result.unchanged.map((entry) => entry.key),
    ['APP_TIMEZONE', 'DB_CONNECTION_TIMEOUT_MS', 'DB_READ_TIMEOUT_MS', 'LOG_LEVEL'],
  );
  assert.deepEqual(result.deletions.map((entry) => entry.key), ['PORT']);
});
