#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCoverageRecords,
  buildCoverageReport,
  createCoveragePool,
  fetchCanonicalCoverageInputs,
} from './lib/canonicalNullCoverage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_coverage_report.json');

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report-path') {
      options.reportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = await createCoveragePool();
  try {
    const inputs = await fetchCanonicalCoverageInputs(pool);
    const records = buildCoverageRecords(inputs);
    const report = buildCoverageReport(records);
    await mkdir(path.dirname(options.reportPath), { recursive: true });
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({
      generated_at: report.generated_at,
      report_path: path.relative(BACKEND_DIR, options.reportPath),
      field_observations: report.counts.field_observations,
      unresolved_records: report.counts.unresolved_records,
      fake_default_records: report.counts.fake_default_records,
    }));
  } finally {
    await pool.end();
  }
}

await main();
