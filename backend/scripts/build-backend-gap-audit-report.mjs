#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBackendGapAuditReport, renderBackendGapAuditMarkdown } from './lib/backendGapAudit.mjs';
import { collectRuntimeArtifactDuplicates } from './lib/runtimeArtifactRetention.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(BACKEND_DIR, '..');

const DEFAULT_JSON_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'backend_gap_audit_report.json');
const DEFAULT_MARKDOWN_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'backend_gap_audit_report.md');
const DEFAULT_SCORECARD_PATH = path.join(BACKEND_DIR, 'reports', 'migration_readiness_scorecard.json');
const DEFAULT_RUNTIME_GATE_PATH = path.join(BACKEND_DIR, 'reports', 'runtime_gate_report.json');
const DEFAULT_PARITY_PATH = path.join(BACKEND_DIR, 'reports', 'backend_json_parity_report.json');
const DEFAULT_HISTORICAL_COVERAGE_PATH = path.join(
  BACKEND_DIR,
  'reports',
  'historical_release_detail_coverage_report.json',
);
const DEFAULT_NULL_COVERAGE_PATH = path.join(BACKEND_DIR, 'reports', 'canonical_null_coverage_report.json');
const DEFAULT_WORKER_CADENCE_PATH = path.join(BACKEND_DIR, 'reports', 'worker_cadence_report.json');
const DEFAULT_ALLOWLIST_PATH = path.join(REPO_DIR, 'web', 'src', 'data', 'youtubeChannelAllowlists.json');
const DEFAULT_ARTIST_PROFILES_PATH = path.join(REPO_DIR, 'web', 'src', 'data', 'artistProfiles.json');

function parseArgs(argv) {
  const options = {
    jsonReportPath: DEFAULT_JSON_REPORT_PATH,
    markdownReportPath: DEFAULT_MARKDOWN_REPORT_PATH,
    scorecardPath: DEFAULT_SCORECARD_PATH,
    runtimeGatePath: DEFAULT_RUNTIME_GATE_PATH,
    parityPath: DEFAULT_PARITY_PATH,
    historicalCoveragePath: DEFAULT_HISTORICAL_COVERAGE_PATH,
    nullCoveragePath: DEFAULT_NULL_COVERAGE_PATH,
    workerCadencePath: DEFAULT_WORKER_CADENCE_PATH,
    allowlistPath: DEFAULT_ALLOWLIST_PATH,
    artistProfilesPath: DEFAULT_ARTIST_PROFILES_PATH,
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

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [
    scorecard,
    runtimeGate,
    parityReport,
    historicalCoverageReport,
    nullCoverageReport,
    workerCadenceReport,
    allowlistRows,
    artistProfiles,
    runtimeArtifactDuplicates,
  ] = await Promise.all([
    readJson(options.scorecardPath),
    readJson(options.runtimeGatePath),
    readJson(options.parityPath),
    readJson(options.historicalCoveragePath),
    readJson(options.nullCoveragePath),
    readJson(options.workerCadencePath),
    readJson(options.allowlistPath),
    readJson(options.artistProfilesPath),
    collectRuntimeArtifactDuplicates(REPO_DIR),
  ]);

  const report = buildBackendGapAuditReport({
    scorecard,
    runtimeGate,
    parityReport,
    historicalCoverageReport,
    nullCoverageReport,
    workerCadenceReport,
    allowlistRows,
    artistProfiles,
    runtimeFacingDuplicateArtifacts: runtimeArtifactDuplicates.map((entry) => entry.duplicate_path),
  });
  const markdown = renderBackendGapAuditMarkdown(report);

  await mkdir(path.dirname(options.jsonReportPath), { recursive: true });
  await mkdir(path.dirname(options.markdownReportPath), { recursive: true });
  await writeFile(options.jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(options.markdownReportPath, markdown, 'utf8');

  console.log(
    JSON.stringify({
      status: 'ok',
      parent_issue: report.parent_issue.number,
      closure_recommendation: report.parent_issue.closure_recommendation,
      direct_blocker_followups: report.blocker_mapping.flatMap((entry) => entry.issues.map((issue) => issue.number)),
      runtime_facing_duplicate_artifact_count: report.current_snapshot.runtime_facing_duplicate_artifact_count,
      json_report_path: path.relative(REPO_DIR, options.jsonReportPath),
      markdown_report_path: path.relative(REPO_DIR, options.markdownReportPath),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
