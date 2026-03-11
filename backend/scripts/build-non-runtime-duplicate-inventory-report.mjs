#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildNonRuntimeDuplicateInventoryReport,
  collectNonRuntimeDuplicateArtifacts,
  renderNonRuntimeDuplicateInventoryMarkdown,
} from './lib/nonRuntimeDuplicateInventory.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(BACKEND_DIR, '..');

const DEFAULT_JSON_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'non_runtime_duplicate_inventory_report.json');
const DEFAULT_MARKDOWN_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'non_runtime_duplicate_inventory_report.md');

function parseArgs(argv) {
  const options = {
    jsonReportPath: DEFAULT_JSON_REPORT_PATH,
    markdownReportPath: DEFAULT_MARKDOWN_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json-report-path') {
      options.jsonReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--markdown-report-path') {
      options.markdownReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const duplicates = await collectNonRuntimeDuplicateArtifacts(REPO_DIR);
  const report = buildNonRuntimeDuplicateInventoryReport({ duplicates });
  const markdown = renderNonRuntimeDuplicateInventoryMarkdown(report);

  await mkdir(path.dirname(options.jsonReportPath), { recursive: true });
  await mkdir(path.dirname(options.markdownReportPath), { recursive: true });
  await writeFile(options.jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(options.markdownReportPath, markdown, 'utf8');

  console.log(
    JSON.stringify({
      status: 'ok',
      duplicate_count: report.duplicate_inventory.length,
      json_report_path: path.relative(REPO_DIR, options.jsonReportPath),
      markdown_report_path: path.relative(REPO_DIR, options.markdownReportPath),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
