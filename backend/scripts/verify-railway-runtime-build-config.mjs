#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const NIXPACKS_PATH = path.resolve(BACKEND_DIR, 'nixpacks.toml');

function assertIncludes(content, needle, description) {
  if (!content.includes(needle)) {
    throw new Error(`Missing ${description}: ${needle}`);
  }
}

async function main() {
  const content = await fs.readFile(NIXPACKS_PATH, 'utf8');

  assertIncludes(content, '[phases.install]', 'install phase');
  assertIncludes(content, 'npm ci', 'install command');
  assertIncludes(content, '[phases.build]', 'build phase');
  assertIncludes(content, 'npm run build', 'build command');
  assertIncludes(content, '[start]', 'start phase');
  assertIncludes(content, 'npm run start', 'start command');

  console.log(
    JSON.stringify(
      {
        status: 'pass',
        config_path: path.relative(process.cwd(), NIXPACKS_PATH),
        ensured_commands: ['npm ci', 'npm run build', 'npm run start'],
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
