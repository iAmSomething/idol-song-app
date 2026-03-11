#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  extractBackendPublicUrlCandidates,
  selectBackendPublicUrl,
  urlsAreSameOrigin,
} from './lib/previewBackendPublicUrl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(BACKEND_DIR, 'reports');

function parseArgs(argv) {
  const options = {
    githubEnvironment: 'preview',
    repo: process.env.GITHUB_REPOSITORY?.trim() ?? '',
    reportPath: path.resolve(REPORTS_DIR, 'preview_backend_public_url.json'),
    target: 'preview',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--github-environment' && nextValue) {
      options.githubEnvironment = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--repo' && nextValue) {
      options.repo = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--report-path' && nextValue) {
      options.reportPath = path.resolve(BACKEND_DIR, nextValue);
      index += 1;
      continue;
    }

    if (arg === '--target' && nextValue) {
      options.target = nextValue;
      index += 1;
      continue;
    }
  }

  if (options.target !== 'preview') {
    throw new Error(`Unsupported target: ${options.target}`);
  }

  if (!options.repo) {
    throw new Error('Missing required argument: --repo <owner/repo>');
  }

  return options;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function appendStepSummary(line) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return Promise.resolve();
  }

  return fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

function writeGithubOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return Promise.resolve();
  }

  return fs.appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        ...options.env,
      },
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
        const reason = stderr.trim().length > 0 ? stderr.trim() : stdout.trim() || `Command failed with exit code ${code}`;
        reject(new Error(reason));
        return;
      }

      resolve({
        stdout,
        stderr,
      });
    });
  });
}

async function readProductionPublicUrl(repo) {
  try {
    const result = await runCommand(
      'gh',
      ['variable', 'get', 'BACKEND_PUBLIC_URL', '--env', 'production', '--repo', repo],
      { env: { GH_TOKEN: requireEnv('GH_TOKEN') } },
    );
    return result.stdout.trim();
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const railwayToken = requireEnv('RAILWAY_TOKEN');
  const projectId = requireEnv('RAILWAY_PROJECT_ID');
  const environmentId = requireEnv('RAILWAY_ENVIRONMENT_ID');
  const serviceId = requireEnv('RAILWAY_SERVICE_ID');
  const ghToken = requireEnv('GH_TOKEN');

  const report = {
    target: options.target,
    github_environment: options.githubEnvironment,
    repo: options.repo,
    generated_at: new Date().toISOString(),
    checks: [],
    railway_outputs: {},
    backend_public_url: null,
    production_public_url: null,
  };

  await runCommand(
    'npx',
    [
      '-y',
      '@railway/cli',
      'link',
      '--project',
      projectId,
      '--environment',
      environmentId,
      '--service',
      serviceId,
    ],
    {
      env: { RAILWAY_TOKEN: railwayToken },
    },
  );

  const candidates = [];

  try {
    const domainResult = await runCommand(
      'npx',
      ['-y', '@railway/cli', 'domain', '--service', serviceId, '--json'],
      {
        env: { RAILWAY_TOKEN: railwayToken },
      },
    );
    report.railway_outputs.domain_json = domainResult.stdout.trim();
    candidates.push(...extractBackendPublicUrlCandidates(domainResult.stdout));
    report.checks.push({
      key: 'railway-domain-json',
      status: 'pass',
      candidate_count: candidates.length,
    });
  } catch (error) {
    report.checks.push({
      key: 'railway-domain-json',
      status: 'warn',
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  const statusResult = await runCommand(
    'npx',
    ['-y', '@railway/cli', 'status', '--json'],
    {
      env: { RAILWAY_TOKEN: railwayToken },
    },
  );
  report.railway_outputs.status_json = statusResult.stdout.trim();
  candidates.push(...extractBackendPublicUrlCandidates(statusResult.stdout));

  const productionPublicUrl = await readProductionPublicUrl(options.repo);
  report.production_public_url = productionPublicUrl;

  const backendPublicUrl = selectBackendPublicUrl(candidates, {
    productionUrl: productionPublicUrl,
  });

  if (!backendPublicUrl) {
    throw new Error('Unable to resolve a preview backend public URL from Railway CLI output');
  }

  if (productionPublicUrl && urlsAreSameOrigin(backendPublicUrl, productionPublicUrl)) {
    throw new Error(`Resolved preview backend URL matches production URL: ${backendPublicUrl}`);
  }

  await runCommand(
    'gh',
    [
      'variable',
      'set',
      'BACKEND_PUBLIC_URL',
      '--env',
      options.githubEnvironment,
      '--repo',
      options.repo,
      '--body',
      backendPublicUrl,
    ],
    {
      env: { GH_TOKEN: ghToken },
    },
  );

  report.backend_public_url = backendPublicUrl;
  report.checks.push({
    key: 'github-variable-sync',
    status: 'pass',
    variable: 'BACKEND_PUBLIC_URL',
  });

  await fs.mkdir(path.dirname(options.reportPath), { recursive: true });
  await fs.writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await appendStepSummary(`- preview backend public URL: ${backendPublicUrl}`);
  await writeGithubOutput('backend_public_url', backendPublicUrl);

  console.log(`preview backend public url: ${backendPublicUrl}`);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
