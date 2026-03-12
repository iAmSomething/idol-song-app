export type DeployTarget = 'preview' | 'production';

export type CheckStatus = 'pass' | 'fail' | 'warn';

export type DeployEnvCheck = {
  key: string;
  category: 'example-contract' | 'deploy-input' | 'runtime-env';
  status: CheckStatus;
  summary: string;
  expected?: Record<string, unknown>;
  observed?: Record<string, unknown>;
};

export type DeployEnvReport = {
  target: DeployTarget;
  status: 'pass' | 'fail';
  generated_at: string;
  checks: DeployEnvCheck[];
  summary_lines: string[];
};

type EnvMap = Map<string, string>;

const EXPECTED_RUNTIME_KEYS = [
  'APP_ENV',
  'DATABASE_URL_POOLED',
  'DATABASE_URL',
  'PORT',
  'APP_TIMEZONE',
  'DB_CONNECTION_TIMEOUT_MS',
  'DB_READ_TIMEOUT_MS',
  'WEB_ALLOWED_ORIGINS',
  'LOG_LEVEL',
  'WORKER_CADENCE_LABEL',
] as const;

const EXPECTED_DEPLOY_INPUTS = [
  'BACKEND_DEPLOY_TARGET',
  'BACKEND_PUBLIC_URL',
  'DATABASE_URL',
  'RAILWAY_TOKEN',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_SERVICE_ID',
] as const;

const SHARED_EXAMPLE_KEYS = ['APP_TIMEZONE', 'DB_CONNECTION_TIMEOUT_MS', 'DB_READ_TIMEOUT_MS', 'LOG_LEVEL'] as const;

const TARGET_RUNTIME_EXPECTATIONS: Record<DeployTarget, Record<string, string>> = {
  preview: {
    APP_ENV: 'preview',
    PORT: '3213',
    APP_TIMEZONE: 'Asia/Seoul',
    DB_CONNECTION_TIMEOUT_MS: '3000',
    DB_READ_TIMEOUT_MS: '5000',
    LOG_LEVEL: 'info',
    WORKER_CADENCE_LABEL: 'preview-manual',
  },
  production: {
    APP_ENV: 'production',
    PORT: '3000',
    APP_TIMEZONE: 'Asia/Seoul',
    DB_CONNECTION_TIMEOUT_MS: '3000',
    DB_READ_TIMEOUT_MS: '5000',
    LOG_LEVEL: 'info',
    WORKER_CADENCE_LABEL: 'production-scheduled',
  },
};

function classifyUrlShape(value: string): 'postgresql_url' | 'https_url' | 'invalid' {
  if (value.startsWith('postgresql://') || value.startsWith('postgres://')) {
    return 'postgresql_url';
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') {
      return 'https_url';
    }
  } catch {
    return 'invalid';
  }

  return 'invalid';
}

function normalizeOrigins(raw: string): string[] {
  if (raw.trim().length === 0) {
    return [];
  }

  return [...new Set(raw.split(',').map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function asRedactedPresence(value: string | undefined): Record<string, unknown> {
  return {
    present: typeof value === 'string' && value.length > 0,
    redacted: true,
  };
}

export function parseDotenvExample(content: string): EnvMap {
  const map = new Map<string, string>();

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

export function parseKvOutput(content: string): EnvMap {
  const map = new Map<string, string>();

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
    const value = line.slice(separatorIndex + 1);
    if (key.length === 0) {
      continue;
    }
    map.set(key, value);
  }

  return map;
}

export function buildDeployEnvContractReport(options: {
  target: DeployTarget;
  previewExample: EnvMap;
  productionExample: EnvMap;
  deployEnv: NodeJS.ProcessEnv;
  runtimeEnv: EnvMap;
}): DeployEnvReport {
  const { target, previewExample, productionExample, deployEnv, runtimeEnv } = options;
  const checks: DeployEnvCheck[] = [];
  const targetExample = target === 'preview' ? previewExample : productionExample;

  const previewKeys = [...previewExample.keys()].sort();
  const productionKeys = [...productionExample.keys()].sort();
  const keySetMatches = JSON.stringify(previewKeys) === JSON.stringify(productionKeys);
  checks.push({
    key: 'example-key-set',
    category: 'example-contract',
    status: keySetMatches ? 'pass' : 'fail',
    summary: keySetMatches
      ? 'preview and production example files expose the same runtime keys'
      : 'preview and production example files expose different runtime key sets',
    expected: { preview_keys: previewKeys, production_keys: productionKeys },
  });

  for (const key of SHARED_EXAMPLE_KEYS) {
    const previewValue = previewExample.get(key);
    const productionValue = productionExample.get(key);
    checks.push({
      key,
      category: 'example-contract',
      status: previewValue === productionValue ? 'pass' : 'fail',
      summary:
        previewValue === productionValue
          ? `${key} matches across preview and production examples`
          : `${key} drifts across preview and production examples`,
      expected: {
        preview: previewValue ?? null,
        production: productionValue ?? null,
      },
    });
  }

  for (const key of EXPECTED_RUNTIME_KEYS) {
    const hasExpectedValue = targetExample.has(key);
    const expectedValue = targetExample.get(key);
    const observedValue = runtimeEnv.get(key);

    if (!hasExpectedValue) {
      checks.push({
        key,
        category: 'runtime-env',
        status: 'fail',
        summary: `${key} is missing from the ${target} example contract`,
      });
      continue;
    }

    if (!observedValue) {
      checks.push({
        key,
        category: 'runtime-env',
        status: 'fail',
        summary: `${key} is missing from the ${target} runtime environment`,
        expected: { target, value: key.includes('DATABASE_URL') ? '<redacted>' : expectedValue },
        observed: key.includes('DATABASE_URL') ? asRedactedPresence(undefined) : { present: false },
      });
      continue;
    }

    if (key === 'DATABASE_URL' || key === 'DATABASE_URL_POOLED') {
      const shape = classifyUrlShape(observedValue);
      checks.push({
        key,
        category: 'runtime-env',
        status: shape === 'postgresql_url' ? 'pass' : 'fail',
        summary:
          shape === 'postgresql_url'
            ? `${key} is populated with a PostgreSQL connection string`
            : `${key} is present but not a valid PostgreSQL connection string`,
        expected: { shape: 'postgresql_url', redacted: true },
        observed: { shape, redacted: true, present: true },
      });
      continue;
    }

    if (key === 'WEB_ALLOWED_ORIGINS') {
      const expectedOrigins = normalizeOrigins(expectedValue ?? '');
      const observedOrigins = normalizeOrigins(observedValue);
      const matches = JSON.stringify(expectedOrigins) === JSON.stringify(observedOrigins);
      checks.push({
        key,
        category: 'runtime-env',
        status: matches ? 'pass' : 'fail',
        summary: matches
          ? `${key} matches the ${target} example contract`
          : `${key} differs from the ${target} example contract`,
        expected: { origins: expectedOrigins },
        observed: { origins: observedOrigins },
      });
      continue;
    }

    checks.push({
      key,
      category: 'runtime-env',
      status: observedValue === expectedValue ? 'pass' : 'fail',
      summary:
        observedValue === expectedValue
          ? `${key} matches the ${target} example contract`
          : `${key} differs from the ${target} example contract`,
      expected: { value: expectedValue },
      observed: { value: observedValue },
    });
  }

  for (const [key, expectedValue] of Object.entries(TARGET_RUNTIME_EXPECTATIONS[target])) {
    const actualValue = targetExample.get(key);
    checks.push({
      key: `${key}-policy`,
      category: 'example-contract',
      status: actualValue === expectedValue ? 'pass' : 'fail',
      summary:
        actualValue === expectedValue
          ? `${key} follows the ${target} policy baseline`
          : `${key} does not follow the ${target} policy baseline`,
      expected: { value: expectedValue },
      observed: { value: actualValue ?? null },
    });
  }

  for (const key of EXPECTED_DEPLOY_INPUTS) {
    const observedValue = deployEnv[key];
    const present = typeof observedValue === 'string' && observedValue.trim().length > 0;

    if (!present) {
      checks.push({
        key,
        category: 'deploy-input',
        status: 'fail',
        summary: `${key} is missing from the deploy workflow environment`,
        observed: key.includes('TOKEN') || key.includes('DATABASE_URL') ? asRedactedPresence(undefined) : { present: false },
      });
      continue;
    }

    if (key === 'BACKEND_DEPLOY_TARGET') {
      checks.push({
        key,
        category: 'deploy-input',
        status: observedValue === target ? 'pass' : 'fail',
        summary:
          observedValue === target
            ? `BACKEND_DEPLOY_TARGET matches ${target}`
            : `BACKEND_DEPLOY_TARGET does not match ${target}`,
        expected: { value: target },
        observed: { value: observedValue },
      });
      continue;
    }

    if (key === 'BACKEND_PUBLIC_URL') {
      const shape = classifyUrlShape(observedValue.trim());
      checks.push({
        key,
        category: 'deploy-input',
        status: shape === 'https_url' ? 'pass' : 'fail',
        summary:
          shape === 'https_url'
            ? 'BACKEND_PUBLIC_URL is populated with an https origin'
            : 'BACKEND_PUBLIC_URL is not a valid https origin',
        expected: { shape: 'https_url' },
        observed: { shape },
      });
      continue;
    }

    if (key === 'DATABASE_URL') {
      const shape = classifyUrlShape(observedValue.trim());
      checks.push({
        key,
        category: 'deploy-input',
        status: shape === 'postgresql_url' ? 'pass' : 'fail',
        summary:
          shape === 'postgresql_url'
            ? 'DATABASE_URL secret is populated with a PostgreSQL connection string'
            : 'DATABASE_URL secret is present but malformed',
        expected: { shape: 'postgresql_url', redacted: true },
        observed: { shape, redacted: true, present: true },
      });
      continue;
    }

    checks.push({
      key,
      category: 'deploy-input',
      status: 'pass',
      summary: `${key} is present`,
      observed: key === 'RAILWAY_TOKEN' ? asRedactedPresence(observedValue) : { present: true },
    });
  }

  const failedChecks = checks.filter((check) => check.status === 'fail');
  const runtimeFailures = failedChecks.filter((check) => check.category === 'runtime-env').length;
  const deployFailures = failedChecks.filter((check) => check.category === 'deploy-input').length;
  const exampleFailures = failedChecks.filter((check) => check.category === 'example-contract').length;

  return {
    target,
    status: failedChecks.length === 0 ? 'pass' : 'fail',
    generated_at: new Date().toISOString(),
    checks,
    summary_lines: [
      `target: ${target}`,
      `example-contract failures: ${exampleFailures}`,
      `deploy-input failures: ${deployFailures}`,
      `runtime-env failures: ${runtimeFailures}`,
      failedChecks.length === 0 ? 'result: pass' : `result: fail (${failedChecks.length} failing checks)`,
    ],
  };
}
