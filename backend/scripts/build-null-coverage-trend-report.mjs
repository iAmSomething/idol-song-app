#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTrendHistorySnapshot, buildTrendReport } from './lib/canonicalNullCoverage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const DEFAULT_COVERAGE_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_coverage_report.json');
const DEFAULT_HISTORY_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_coverage_history.json');
const DEFAULT_TREND_PATH = path.join(BACKEND_DIR, 'reports', 'null_coverage_trend_report.json');

function parseArgs(argv) {
  const options = {
    coverageReportPath: DEFAULT_COVERAGE_REPORT_PATH,
    historyPath: DEFAULT_HISTORY_PATH,
    trendPath: DEFAULT_TREND_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--coverage-report-path') {
      options.coverageReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (arg === '--history-path') {
      options.historyPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (arg === '--trend-path') {
      options.trendPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const coverageReport = await readJson(options.coverageReportPath, null);
  if (!coverageReport) {
    throw new Error(`Coverage report not found: ${options.coverageReportPath}`);
  }
  const history = await readJson(options.historyPath, { generated_at: null, snapshots: [] });
  const snapshot = buildTrendHistorySnapshot(coverageReport);
  const snapshots = [...(history.snapshots ?? [])];
  if (!snapshots.some((entry) => entry.generated_at === snapshot.generated_at)) {
    snapshots.push(snapshot);
  }
  const nextHistory = {
    generated_at: new Date().toISOString(),
    snapshots,
  };
  const trendReport = buildTrendReport(coverageReport, nextHistory);

  await mkdir(path.dirname(options.historyPath), { recursive: true });
  await writeFile(options.historyPath, `${JSON.stringify(nextHistory, null, 2)}\n`, 'utf8');
  await mkdir(path.dirname(options.trendPath), { recursive: true });
  await writeFile(options.trendPath, `${JSON.stringify(trendReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    generated_at: trendReport.generated_at,
    trend_path: path.relative(BACKEND_DIR, options.trendPath),
    history_path: path.relative(BACKEND_DIR, options.historyPath),
    baseline_available: trendReport.baseline_available,
    critical_regressions: trendReport.critical_regressions.length,
  }));
}

await main();
