#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWorkflowConditionGuardReport,
  collectWorkflowConditionViolations,
} from './lib/workflowConditionGuard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(BACKEND_DIR, '..');
const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'workflow_condition_guard_report.json');

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--report-path') {
      options.reportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const violations = await collectWorkflowConditionViolations(REPO_DIR);
  const report = buildWorkflowConditionGuardReport({ violations });

  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        status: report.status,
        violation_count: report.violations.length,
        report_path: path.relative(REPO_DIR, options.reportPath),
      },
      null,
      2,
    ),
  );

  if (report.status !== 'pass') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
