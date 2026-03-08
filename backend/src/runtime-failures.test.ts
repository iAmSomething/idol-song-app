import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

type FailureMode = 'uncaughtException' | 'unhandledRejection' | 'hangingRejection';

type SpawnResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsxBinary = resolve(backendRoot, 'node_modules/.bin/tsx');
const fixturePath = resolve(backendRoot, 'src/runtime-failure.fixture.ts');

async function runFixture(mode: FailureMode): Promise<SpawnResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(tsxBinary, [fixturePath, mode], {
      cwd: backendRoot,
      env: process.env,
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
    child.on('close', (code) => {
      resolvePromise({
        code,
        stdout,
        stderr,
      });
    });
  });
}

test('uncaughtException path logs fatal classification and exits deterministically', async () => {
  const result = await runFixture('uncaughtException');

  assert.equal(result.code, 1);
  assert.match(result.stdout, /"failure_class":"uncaughtException"/);
  assert.match(result.stdout, /Runtime fatal exception detected/);
  assert.match(result.stdout, /Graceful shutdown finished after runtime-fatal failure/);
});

test('unhandledRejection path logs fatal classification and exits deterministically', async () => {
  const result = await runFixture('unhandledRejection');

  assert.equal(result.code, 1);
  assert.match(result.stdout, /"failure_class":"unhandledRejection"/);
  assert.match(result.stdout, /Runtime fatal rejection detected/);
  assert.match(result.stdout, /Graceful shutdown finished after runtime-fatal failure/);
});

test('runtime fatal shutdown timeout forces process exit', async () => {
  const result = await runFixture('hangingRejection');

  assert.equal(result.code, 1);
  assert.match(result.stdout, /"failure_class":"unhandledRejection"/);
  assert.match(result.stdout, /Graceful shutdown timed out; forcing process exit/);
});
