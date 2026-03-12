#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildDesiredRuntimeEnv, computeRuntimeEnvUpdates } from './lib/runtimeEnvSync.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(BACKEND_DIR, 'reports');

function parseArgs(argv) {
  const options = {
    target: null,
    reportPath: null,
    runtimeEnvKvPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--target' && nextValue) {
      options.target = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--report-path' && nextValue) {
      options.reportPath = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--runtime-env-kv-path' && nextValue) {
      options.runtimeEnvKvPath = nextValue;
      index += 1;
      continue;
    }
  }

  if (options.target !== 'preview' && options.target !== 'production') {
    throw new Error('Missing required argument: --target <preview|production>');
  }

  return {
    target: options.target,
    reportPath:
      options.reportPath ?? path.resolve(REPORTS_DIR, `railway_runtime_env_sync_${options.target}.json`),
    runtimeEnvKvPath: options.runtimeEnvKvPath,
  };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

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

function runCommand(command, args, { env = {}, stdin = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(stderr.trim().length > 0 ? stderr.trim() : `Command failed with exit code ${code}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function loadRuntimeEnvKv(runtimeEnvKvPath) {
  if (runtimeEnvKvPath) {
    return fs.readFile(runtimeEnvKvPath, 'utf8');
  }

  const railwayToken = requireEnv('RAILWAY_TOKEN');
  const railwayEnvironmentId = requireEnv('RAILWAY_ENVIRONMENT_ID');
  const railwayServiceId = requireEnv('RAILWAY_SERVICE_ID');

  const result = await runCommand(
    'npx',
    ['-y', '@railway/cli', 'variable', 'list', '--kv', '--environment', railwayEnvironmentId, '--service', railwayServiceId],
    {
      env: {
        RAILWAY_TOKEN: railwayToken,
      },
    },
  );

  return result.stdout;
}

async function main() {
  const { target, reportPath, runtimeEnvKvPath } = parseArgs(process.argv.slice(2));
  const examplePath = path.resolve(BACKEND_DIR, `.env.${target}.example`);
  const exampleContent = await fs.readFile(examplePath, 'utf8');
  const runtimeEnvContent = await loadRuntimeEnvKv(runtimeEnvKvPath);
  const desiredEnv = buildDesiredRuntimeEnv(parseKv(exampleContent));
  const currentEnv = parseKv(runtimeEnvContent);
  const { updates, unchanged } = computeRuntimeEnvUpdates(currentEnv, desiredEnv);

  const report = {
    target,
    generated_at: new Date().toISOString(),
    desired_keys: [...desiredEnv.keys()],
    updates,
    unchanged,
    updated_count: updates.length,
    unchanged_count: unchanged.length,
  };

  if (!runtimeEnvKvPath && updates.length > 0) {
    const railwayToken = requireEnv('RAILWAY_TOKEN');
    const railwayEnvironmentId = requireEnv('RAILWAY_ENVIRONMENT_ID');
    const railwayServiceId = requireEnv('RAILWAY_SERVICE_ID');
    const variables = updates.map((entry) => `${entry.key}=${entry.nextValue}`);

    await runCommand(
      'npx',
      [
        '-y',
        '@railway/cli',
        'variable',
        'set',
        '--skip-deploys',
        '--environment',
        railwayEnvironmentId,
        '--service',
        railwayServiceId,
        ...variables,
      ],
      {
        env: {
          RAILWAY_TOKEN: railwayToken,
        },
      },
    );
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        target,
        updatedCount: updates.length,
        unchangedCount: unchanged.length,
        updatedKeys: updates.map((entry) => entry.key),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
