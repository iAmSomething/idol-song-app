import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDeployEnvContractReport, parseDotenvExample, parseKvOutput } from './deployEnvContract.js';

const PREVIEW_EXAMPLE = parseDotenvExample(`
APP_ENV=preview
DATABASE_URL_POOLED=postgresql://user:password@your-preview-neon-pooler-host/neondb?sslmode=require
DATABASE_URL=postgresql://user:password@your-preview-neon-direct-host/neondb?sslmode=require
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://idol-song-app-preview.example.com
LOG_LEVEL=info
WORKER_CADENCE_LABEL=preview-manual
`);

const PRODUCTION_EXAMPLE = parseDotenvExample(`
APP_ENV=production
DATABASE_URL_POOLED=postgresql://user:password@your-production-neon-pooler-host/neondb?sslmode=require
DATABASE_URL=postgresql://user:password@your-production-neon-direct-host/neondb?sslmode=require
PORT=3000
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://iamsomething.github.io
LOG_LEVEL=info
WORKER_CADENCE_LABEL=production-scheduled
`);

function buildDeployEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    BACKEND_DEPLOY_TARGET: 'preview',
    BACKEND_PUBLIC_URL: 'https://api-preview.idol-song-app.example.com',
    DATABASE_URL: 'postgresql://preview-secret-host/neondb?sslmode=require',
    RAILWAY_TOKEN: 'railway-token',
    RAILWAY_PROJECT_ID: 'proj_123',
    RAILWAY_ENVIRONMENT_ID: 'env_123',
    RAILWAY_SERVICE_ID: 'svc_123',
    ...overrides,
  };
}

test('parseKvOutput reads key-value pairs', () => {
  const parsed = parseKvOutput('APP_ENV=preview\nPORT=3213\n');
  assert.equal(parsed.get('APP_ENV'), 'preview');
  assert.equal(parsed.get('PORT'), '3213');
});

test('deploy env contract passes for matching preview runtime config', () => {
  const runtimeEnv = parseKvOutput(`
APP_ENV=preview
DATABASE_URL_POOLED=postgresql://preview-pooled-host/neondb?sslmode=require
DATABASE_URL=postgresql://preview-direct-host/neondb?sslmode=require
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://idol-song-app-preview.example.com
LOG_LEVEL=info
WORKER_CADENCE_LABEL=preview-manual
`);

  const report = buildDeployEnvContractReport({
    target: 'preview',
    previewExample: PREVIEW_EXAMPLE,
    productionExample: PRODUCTION_EXAMPLE,
    deployEnv: buildDeployEnv(),
    runtimeEnv,
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.checks.filter((check) => check.status === 'fail').length, 0);
});

test('deploy env contract fails when runtime config is incomplete', () => {
  const runtimeEnv = parseKvOutput(`
APP_ENV=preview
DATABASE_URL=postgresql://preview-direct-host/neondb?sslmode=require
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://idol-song-app-preview.example.com
LOG_LEVEL=info
WORKER_CADENCE_LABEL=preview-manual
`);

  const report = buildDeployEnvContractReport({
    target: 'preview',
    previewExample: PREVIEW_EXAMPLE,
    productionExample: PRODUCTION_EXAMPLE,
    deployEnv: buildDeployEnv(),
    runtimeEnv,
  });

  assert.equal(report.status, 'fail');
  assert.ok(report.checks.some((check) => check.key === 'DATABASE_URL_POOLED' && check.status === 'fail'));
});

test('deploy env contract fails when deploy env target drifts', () => {
  const runtimeEnv = parseKvOutput(`
APP_ENV=preview
DATABASE_URL_POOLED=postgresql://preview-pooled-host/neondb?sslmode=require
DATABASE_URL=postgresql://preview-direct-host/neondb?sslmode=require
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://idol-song-app-preview.example.com
LOG_LEVEL=info
WORKER_CADENCE_LABEL=preview-manual
`);

  const report = buildDeployEnvContractReport({
    target: 'preview',
    previewExample: PREVIEW_EXAMPLE,
    productionExample: PRODUCTION_EXAMPLE,
    deployEnv: buildDeployEnv({ BACKEND_DEPLOY_TARGET: 'production' }),
    runtimeEnv,
  });

  assert.equal(report.status, 'fail');
  assert.ok(report.checks.some((check) => check.key === 'BACKEND_DEPLOY_TARGET' && check.status === 'fail'));
});

test('deploy env contract catches preview example drift from policy baseline', () => {
  const previewExampleWithDebug = parseDotenvExample(`
APP_ENV=preview
DATABASE_URL_POOLED=postgresql://user:password@your-preview-neon-pooler-host/neondb?sslmode=require
DATABASE_URL=postgresql://user:password@your-preview-neon-direct-host/neondb?sslmode=require
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://idol-song-app-preview.example.com
LOG_LEVEL=debug
WORKER_CADENCE_LABEL=preview-manual
`);

  const runtimeEnv = parseKvOutput(`
APP_ENV=preview
DATABASE_URL_POOLED=postgresql://preview-pooled-host/neondb?sslmode=require
DATABASE_URL=postgresql://preview-direct-host/neondb?sslmode=require
PORT=3213
APP_TIMEZONE=Asia/Seoul
DB_CONNECTION_TIMEOUT_MS=3000
DB_READ_TIMEOUT_MS=5000
WEB_ALLOWED_ORIGINS=https://idol-song-app-preview.example.com
LOG_LEVEL=debug
WORKER_CADENCE_LABEL=preview-manual
`);

  const report = buildDeployEnvContractReport({
    target: 'preview',
    previewExample: previewExampleWithDebug,
    productionExample: PRODUCTION_EXAMPLE,
    deployEnv: buildDeployEnv(),
    runtimeEnv,
  });

  assert.equal(report.status, 'fail');
  assert.ok(report.checks.some((check) => check.key === 'LOG_LEVEL-policy' && check.status === 'fail'));
});
