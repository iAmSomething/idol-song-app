#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildDeployEnvContractReport,
  parseDotenvExample,
  parseKvOutput,
  type DeployTarget,
} from '../src/lib/deployEnvContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(BACKEND_DIR, 'reports');

function parseArgs(argv: string[]) {
  let target: DeployTarget | null = null;
  let reportPath: string | null = null;
  let runtimeEnvKvPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--target' && nextValue) {
      if (nextValue !== 'preview' && nextValue !== 'production') {
        throw new Error(`Unsupported target: ${nextValue}`);
      }
      target = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--report-path' && nextValue) {
      reportPath = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--runtime-env-kv-path' && nextValue) {
      runtimeEnvKvPath = nextValue;
      index += 1;
      continue;
    }
  }

  if (!target) {
    throw new Error('Missing required argument: --target <preview|production>');
  }

  return {
    target,
    reportPath:
      reportPath ?? path.resolve(REPORTS_DIR, `deploy_env_contract_${target}.json`),
    runtimeEnvKvPath,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: BACKEND_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

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

      resolve(stdout);
    });
  });
}

async function loadRuntimeEnvKv(runtimeEnvKvPath: string | null): Promise<string> {
  if (runtimeEnvKvPath) {
    return fs.readFile(runtimeEnvKvPath, 'utf8');
  }

  const railwayToken = requireEnv('RAILWAY_TOKEN');
  const railwayEnvironmentId = requireEnv('RAILWAY_ENVIRONMENT_ID');
  const railwayServiceId = requireEnv('RAILWAY_SERVICE_ID');

  return runCommand(
    'npx',
    [
      '-y',
      '@railway/cli',
      'variable',
      'list',
      '--kv',
      '--environment',
      railwayEnvironmentId,
      '--service',
      railwayServiceId,
    ],
    {
      ...process.env,
      RAILWAY_TOKEN: railwayToken,
    },
  );
}

async function main() {
  const { target, reportPath, runtimeEnvKvPath } = parseArgs(process.argv.slice(2));
  const previewExampleContent = await fs.readFile(path.resolve(BACKEND_DIR, '.env.preview.example'), 'utf8');
  const productionExampleContent = await fs.readFile(path.resolve(BACKEND_DIR, '.env.production.example'), 'utf8');
  const runtimeEnvContent = await loadRuntimeEnvKv(runtimeEnvKvPath);

  const report = buildDeployEnvContractReport({
    target,
    previewExample: parseDotenvExample(previewExampleContent),
    productionExample: parseDotenvExample(productionExampleContent),
    deployEnv: process.env,
    runtimeEnv: parseKvOutput(runtimeEnvContent),
  });

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const line of report.summary_lines) {
    console.log(line);
  }

  if (report.status !== 'pass') {
    const failedChecks = report.checks.filter((check) => check.status === 'fail');
    for (const check of failedChecks) {
      console.error(`[fail] ${check.category}:${check.key} - ${check.summary}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
