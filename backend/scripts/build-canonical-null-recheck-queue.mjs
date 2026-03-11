#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCoverageRecords,
  buildRecheckQueue,
  createCoveragePool,
  fetchCanonicalCoverageInputs,
} from './lib/canonicalNullCoverage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const DEFAULT_QUEUE_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_recheck_queue.json');

function parseArgs(argv) {
  const options = {
    queuePath: DEFAULT_QUEUE_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--queue-path') {
      options.queuePath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readExistingQueue(queuePath) {
  try {
    const raw = await readFile(queuePath, 'utf8');
    return JSON.parse(raw).queue ?? [];
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const previousQueue = await readExistingQueue(options.queuePath);
  const pool = await createCoveragePool();
  try {
    const inputs = await fetchCanonicalCoverageInputs(pool);
    const records = buildCoverageRecords(inputs);
    const generatedAt = new Date().toISOString();
    const queue = buildRecheckQueue(records, previousQueue, generatedAt);
    const payload = {
      generated_at: generatedAt,
      queue_count: queue.length,
      summary_lines: [
        `queue_count=${queue.length}`,
        `escalate_review=${queue.filter((entry) => entry.review_state === 'escalate_review').length}`,
      ],
      queue,
    };
    await mkdir(path.dirname(options.queuePath), { recursive: true });
    await writeFile(options.queuePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({
      generated_at: payload.generated_at,
      queue_path: path.relative(BACKEND_DIR, options.queuePath),
      queue_count: payload.queue_count,
    }));
  } finally {
    await pool.end();
  }
}

await main();
