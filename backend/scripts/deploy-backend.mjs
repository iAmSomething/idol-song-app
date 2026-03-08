#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');

const VALID_TARGETS = new Set(['preview', 'production']);

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function resolveMode(argv) {
  if (argv.includes('--dry-run')) {
    return 'dry-run';
  }

  return process.env.BACKEND_DEPLOY_MODE?.trim() === 'dry-run' ? 'dry-run' : 'apply';
}

function resolveTarget() {
  const target = process.env.BACKEND_DEPLOY_TARGET?.trim();

  if (!target) {
    throw new Error('Missing required environment variable: BACKEND_DEPLOY_TARGET');
  }

  if (!VALID_TARGETS.has(target)) {
    throw new Error(`Unsupported BACKEND_DEPLOY_TARGET: ${target}`);
  }

  return target;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function main() {
  const mode = resolveMode(process.argv.slice(2));
  const target = resolveTarget();
  const railwayToken = readRequiredEnv('RAILWAY_TOKEN');
  const projectId = readRequiredEnv('RAILWAY_PROJECT_ID');
  const environmentId = readRequiredEnv('RAILWAY_ENVIRONMENT_ID');
  const serviceId = readRequiredEnv('RAILWAY_SERVICE_ID');

  const args = [
    '--yes',
    '@railway/cli',
    'up',
    '--ci',
    '--project',
    projectId,
    '--environment',
    environmentId,
    '--service',
    serviceId,
  ];

  console.log(`backend deploy target: ${target}`);
  console.log(`backend deploy mode: ${mode}`);
  console.log(`backend cwd: ${BACKEND_DIR}`);

  if (mode === 'dry-run') {
    console.log(`dry-run command: npx ${args.join(' ')}`);
    return;
  }

  await runCommand('npx', args, {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      RAILWAY_TOKEN: railwayToken,
    },
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
