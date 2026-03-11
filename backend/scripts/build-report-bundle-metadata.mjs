#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReportBundleMetadata, buildReportReference, readJsonIfExists } from './lib/reportBundle.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'report_bundle_metadata.json');
const DEFAULT_RELEASE_SYNC_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'release_pipeline_db_sync_summary.json');
const DEFAULT_UPCOMING_SYNC_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'upcoming_pipeline_db_sync_summary.json');
const DEFAULT_PROJECTION_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'projection_refresh_summary.json');
const DEFAULT_HISTORICAL_COVERAGE_REPORT_PATH = path.join(
  BACKEND_DIR,
  'reports',
  'historical_release_detail_coverage_report.json',
);
const DEFAULT_NULL_COVERAGE_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_coverage_report.json');
const DEFAULT_NULL_RECHECK_QUEUE_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_recheck_queue.json');
const DEFAULT_NULL_TREND_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'null_coverage_trend_report.json');
const DEFAULT_WORKER_CADENCE_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'worker_cadence_report.json');

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
    releaseSyncReportPath: DEFAULT_RELEASE_SYNC_REPORT_PATH,
    upcomingSyncReportPath: DEFAULT_UPCOMING_SYNC_REPORT_PATH,
    projectionReportPath: DEFAULT_PROJECTION_REPORT_PATH,
    historicalCoverageReportPath: DEFAULT_HISTORICAL_COVERAGE_REPORT_PATH,
    nullCoverageReportPath: DEFAULT_NULL_COVERAGE_REPORT_PATH,
    nullRecheckQueuePath: DEFAULT_NULL_RECHECK_QUEUE_PATH,
    nullTrendReportPath: DEFAULT_NULL_TREND_REPORT_PATH,
    workerCadenceReportPath: DEFAULT_WORKER_CADENCE_REPORT_PATH,
    bundleKind: 'post-sync-verification',
    cadenceProfile: 'daily-upcoming',
    sourceKind: process.env.GITHUB_ACTIONS === 'true' ? 'automation' : 'manual',
    workflowName: process.env.GITHUB_WORKFLOW ?? null,
    gitCommitSha: process.env.GITHUB_SHA ?? null,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--report-path') {
      options.reportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--release-sync-report-path') {
      options.releaseSyncReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--upcoming-sync-report-path') {
      options.upcomingSyncReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--projection-report-path') {
      options.projectionReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--historical-coverage-report-path') {
      options.historicalCoverageReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--null-coverage-report-path') {
      options.nullCoverageReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--null-recheck-queue-path') {
      options.nullRecheckQueuePath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--null-trend-report-path') {
      options.nullTrendReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--worker-cadence-report-path') {
      options.workerCadenceReportPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--bundle-kind') {
      options.bundleKind = String(argv[index + 1] ?? '').trim() || options.bundleKind;
      index += 1;
      continue;
    }
    if (value === '--cadence-profile') {
      options.cadenceProfile = String(argv[index + 1] ?? '').trim() || options.cadenceProfile;
      index += 1;
      continue;
    }
    if (value === '--source-kind') {
      options.sourceKind = String(argv[index + 1] ?? '').trim() || options.sourceKind;
      index += 1;
      continue;
    }
    if (value === '--workflow-name') {
      options.workflowName = String(argv[index + 1] ?? '').trim() || null;
      index += 1;
      continue;
    }
    if (value === '--git-commit-sha') {
      options.gitCommitSha = String(argv[index + 1] ?? '').trim() || null;
      index += 1;
      continue;
    }
    if (value === '--github-run-id') {
      options.githubRunId = String(argv[index + 1] ?? '').trim() || null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [
    releaseSyncReport,
    upcomingSyncReport,
    projectionReport,
    historicalCoverageReport,
    nullCoverageReport,
    nullRecheckQueue,
    nullTrendReport,
    workerCadenceReport,
  ] =
    await Promise.all([
      readJsonIfExists(options.releaseSyncReportPath),
      readJsonIfExists(options.upcomingSyncReportPath),
      readJsonIfExists(options.projectionReportPath),
      readJsonIfExists(options.historicalCoverageReportPath),
      readJsonIfExists(options.nullCoverageReportPath),
      readJsonIfExists(options.nullRecheckQueuePath),
      readJsonIfExists(options.nullTrendReportPath),
      readJsonIfExists(options.workerCadenceReportPath),
    ]);

  const report = buildReportBundleMetadata({
    bundleKind: options.bundleKind,
    cadenceProfile: options.cadenceProfile,
    sourceKind: options.sourceKind,
    workflowName: options.workflowName,
    gitCommitSha: options.gitCommitSha,
    githubRunId: options.githubRunId,
    releaseSyncReference: buildReportReference(BACKEND_DIR, options.releaseSyncReportPath, releaseSyncReport, {
      scope: releaseSyncReport?.scope ?? null,
    }),
    upcomingSyncReference: buildReportReference(BACKEND_DIR, options.upcomingSyncReportPath, upcomingSyncReport, {
      scope: upcomingSyncReport?.scope ?? null,
    }),
    projectionReference: buildReportReference(BACKEND_DIR, options.projectionReportPath, projectionReport),
    historicalCoverageReference: buildReportReference(
      BACKEND_DIR,
      options.historicalCoverageReportPath,
      historicalCoverageReport,
    ),
    nullCoverageReference: buildReportReference(BACKEND_DIR, options.nullCoverageReportPath, nullCoverageReport),
    nullRecheckQueueReference: buildReportReference(BACKEND_DIR, options.nullRecheckQueuePath, nullRecheckQueue, {
      queue_count: nullRecheckQueue?.queue_count ?? null,
    }),
    nullTrendReference: buildReportReference(BACKEND_DIR, options.nullTrendReportPath, nullTrendReport, {
      baseline_available: nullTrendReport?.baseline_available ?? null,
    }),
    workerCadenceReference: buildReportReference(BACKEND_DIR, options.workerCadenceReportPath, workerCadenceReport, {
      primary_path_key: workerCadenceReport?.primary_path_key ?? null,
    }),
  });

  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
