#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { buildBundleConsistency, readJsonIfExists } from './lib/reportBundle.mjs';

const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/backend_freshness_handoff.json');
const DEFAULT_RELEASE_SYNC_REPORT_PATH = resolve(process.cwd(), './reports/release_pipeline_db_sync_summary.json');
const DEFAULT_UPCOMING_SYNC_REPORT_PATH = resolve(process.cwd(), './reports/upcoming_pipeline_db_sync_summary.json');
const DEFAULT_PROJECTION_REPORT_PATH = resolve(process.cwd(), './reports/projection_refresh_summary.json');
const DEFAULT_RUNTIME_GATE_REPORT_PATH = resolve(process.cwd(), './reports/runtime_gate_report.json');
const DEFAULT_BUNDLE_PATH = resolve(process.cwd(), './reports/report_bundle_metadata.json');

const REQUIRED_PROJECTION_ROWS = [
  'entity_search_documents',
  'calendar_month_projection',
  'entity_detail_projection',
  'release_detail_projection',
  'radar_projection',
];

const FRESHNESS_THRESHOLDS = {
  passAgeHours: 96,
  reviewAgeHours: 168,
};

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
    releaseSyncReportPath: DEFAULT_RELEASE_SYNC_REPORT_PATH,
    upcomingSyncReportPath: DEFAULT_UPCOMING_SYNC_REPORT_PATH,
    projectionReportPath: DEFAULT_PROJECTION_REPORT_PATH,
    runtimeGateReportPath: DEFAULT_RUNTIME_GATE_REPORT_PATH,
    bundlePath: DEFAULT_BUNDLE_PATH,
    target: '',
    backendPublicUrl: '',
    sourceKind: process.env.GITHUB_ACTIONS === 'true' ? 'automation' : 'manual',
    workflowName: process.env.GITHUB_WORKFLOW ?? null,
    gitCommitSha: process.env.GITHUB_SHA ?? null,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--release-sync-report-path') {
      options.releaseSyncReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--upcoming-sync-report-path') {
      options.upcomingSyncReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--projection-report-path') {
      options.projectionReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--runtime-gate-report-path') {
      options.runtimeGateReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--bundle-path') {
      options.bundlePath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--target') {
      options.target = normalizeTargetEnvironment(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--backend-public-url') {
      options.backendPublicUrl = normalizeApiBaseUrl(argv[index + 1]);
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

async function loadJson(filePath) {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents);
}

function normalizeApiBaseUrl(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }

  return normalized.replace(/\/+$/, '');
}

function normalizeTargetEnvironment(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'production' || normalized === 'preview' || normalized === 'local' || normalized === 'bridge'
    ? normalized
    : '';
}

function classifyBackendTarget(apiBaseUrl) {
  if (!apiBaseUrl) {
    return 'bridge';
  }

  try {
    const hostname = new URL(apiBaseUrl).hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('127.')
    ) {
      return 'local';
    }

    if (
      hostname.includes('preview') ||
      hostname.includes('staging') ||
      hostname.includes('dev') ||
      hostname.includes('test')
    ) {
      return 'preview';
    }

    return 'production';
  } catch {
    return 'unknown';
  }
}

function parseIsoTimestamp(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function hoursSince(timestamp) {
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Number((((Date.now() - parsed.getTime()) / 1000) / 60 / 60).toFixed(2));
}

function buildReportReference(baseDir, reportPath, report) {
  return {
    path: relative(baseDir, reportPath),
    generated_at: parseIsoTimestamp(report?.generated_at ?? null),
  };
}

function buildSyncCheck(report, expectedScope) {
  const generatedAt = parseIsoTimestamp(report?.generated_at ?? null);
  const scope = typeof report?.scope === 'string' ? report.scope : null;
  const status = generatedAt && scope === expectedScope ? 'pass' : 'fail';

  return {
    status,
    observed: {
      generated_at: generatedAt,
      scope,
      summary_path: typeof report?.summary_path === 'string' ? report.summary_path : null,
    },
  };
}

function buildProjectionRowCountCheck(report) {
  const rowCounts =
    report?.row_counts && typeof report.row_counts === 'object' && !Array.isArray(report.row_counts)
      ? report.row_counts
      : null;
  const missingKeys = REQUIRED_PROJECTION_ROWS.filter((key) => typeof rowCounts?.[key] !== 'number' || rowCounts[key] <= 0);

  return {
    status: missingKeys.length === 0 ? 'pass' : 'fail',
    observed: {
      generated_at: parseIsoTimestamp(report?.generated_at ?? null),
      row_counts: rowCounts,
      missing_or_empty_keys: missingKeys,
    },
  };
}

function buildSequenceCheck(releaseSyncReport, upcomingSyncReport, projectionReport) {
  const releaseAt = parseIsoTimestamp(releaseSyncReport?.generated_at ?? null);
  const upcomingAt = parseIsoTimestamp(upcomingSyncReport?.generated_at ?? null);
  const projectionAt = parseIsoTimestamp(projectionReport?.generated_at ?? null);

  const latestSyncAt = [releaseAt, upcomingAt]
    .filter((value) => typeof value === 'string')
    .sort()
    .at(-1) ?? null;

  const status =
    latestSyncAt && projectionAt && new Date(projectionAt).getTime() >= new Date(latestSyncAt).getTime() ? 'pass' : 'fail';

  return {
    status,
    observed: {
      release_sync_generated_at: releaseAt,
      upcoming_sync_generated_at: upcomingAt,
      latest_sync_generated_at: latestSyncAt,
      projection_generated_at: projectionAt,
    },
  };
}

function buildFreshnessCheck(projectionReport) {
  const generatedAt = parseIsoTimestamp(projectionReport?.generated_at ?? null);
  const ageHours = hoursSince(generatedAt);

  let status = 'fail';
  if (typeof ageHours === 'number' && ageHours <= FRESHNESS_THRESHOLDS.passAgeHours) {
    status = 'pass';
  } else if (typeof ageHours === 'number' && ageHours <= FRESHNESS_THRESHOLDS.reviewAgeHours) {
    status = 'needs_review';
  }

  return {
    status,
    observed: {
      projection_generated_at: generatedAt,
      age_hours: ageHours,
    },
    thresholds: FRESHNESS_THRESHOLDS,
  };
}

function buildTargetBindingCheck(target, backendPublicUrl) {
  const classification = backendPublicUrl ? classifyBackendTarget(backendPublicUrl) : null;
  const normalizedTarget = normalizeTargetEnvironment(target);
  const status = normalizedTarget && (!backendPublicUrl || (classification !== 'unknown' && normalizedTarget === classification))
    ? 'pass'
    : 'fail';

  return {
    status,
    observed: {
      target_environment: normalizedTarget || null,
      backend_public_url: backendPublicUrl || null,
      classified_target: classification,
    },
  };
}

function buildRuntimeGateSummary(runtimeGateReport) {
  const projectionFreshnessStatus =
    typeof runtimeGateReport?.runtime_checks?.projection_freshness?.status === 'string'
      ? runtimeGateReport.runtime_checks.projection_freshness.status
      : null;
  const stageGates =
    runtimeGateReport?.stage_gates && typeof runtimeGateReport.stage_gates === 'object' && !Array.isArray(runtimeGateReport.stage_gates)
      ? {
          shadow_to_web_cutover:
            typeof runtimeGateReport.stage_gates.shadow_to_web_cutover === 'string'
              ? runtimeGateReport.stage_gates.shadow_to_web_cutover
              : null,
          web_cutover_to_json_demotion:
            typeof runtimeGateReport.stage_gates.web_cutover_to_json_demotion === 'string'
              ? runtimeGateReport.stage_gates.web_cutover_to_json_demotion
              : null,
        }
      : {
          shadow_to_web_cutover: null,
          web_cutover_to_json_demotion: null,
        };

  return {
    generated_at: parseIsoTimestamp(runtimeGateReport?.generated_at ?? null),
    projection_freshness_status: projectionFreshnessStatus,
    stage_gates: stageGates,
    summary_lines: Array.isArray(runtimeGateReport?.summary_lines)
      ? runtimeGateReport.summary_lines.filter((entry) => typeof entry === 'string')
      : [],
  };
}

function worstStatus(statuses) {
  if (statuses.includes('fail')) {
    return 'fail';
  }
  if (statuses.includes('needs_review')) {
    return 'needs_review';
  }
  return 'pass';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [releaseSyncReport, upcomingSyncReport, projectionReport, runtimeGateReport, reportBundle] = await Promise.all([
    loadJson(options.releaseSyncReportPath),
    loadJson(options.upcomingSyncReportPath),
    loadJson(options.projectionReportPath),
    loadJson(options.runtimeGateReportPath).catch(() => null),
    readJsonIfExists(options.bundlePath),
  ]);

  const reportDir = dirname(options.reportPath);
  const releasePipelineSync = buildSyncCheck(releaseSyncReport, 'release_pipeline');
  const upcomingPipelineSync = buildSyncCheck(upcomingSyncReport, 'upcoming_pipeline');
  const projectionRowCounts = buildProjectionRowCountCheck(projectionReport);
  const sequenceAfterSync = buildSequenceCheck(releaseSyncReport, upcomingSyncReport, projectionReport);
  const artifactFreshness = buildFreshnessCheck(projectionReport);
  const targetBinding = buildTargetBindingCheck(options.target, options.backendPublicUrl);
  const bundleConsistency = buildBundleConsistency({
    bundle: reportBundle,
    runtimeGateReport,
  });

  const overallStatus = worstStatus([
    releasePipelineSync.status,
    upcomingPipelineSync.status,
    projectionRowCounts.status,
    sequenceAfterSync.status,
    artifactFreshness.status,
    targetBinding.status,
    bundleConsistency.status,
  ]);

  const handoff = {
    generated_at: new Date().toISOString(),
    artifact_version: 1,
    status: overallStatus,
    report_bundle: reportBundle,
    bundle_consistency: bundleConsistency,
    target: {
      environment: normalizeTargetEnvironment(options.target) || null,
      classification: options.backendPublicUrl ? classifyBackendTarget(options.backendPublicUrl) : null,
      backend_public_url: options.backendPublicUrl || null,
    },
    source: {
      kind: options.sourceKind,
      workflow_name: options.workflowName,
      git_commit_sha: options.gitCommitSha,
      github_run_id: options.githubRunId,
    },
    source_reports: {
      release_pipeline_sync: buildReportReference(reportDir, options.releaseSyncReportPath, releaseSyncReport),
      upcoming_pipeline_sync: buildReportReference(reportDir, options.upcomingSyncReportPath, upcomingSyncReport),
      projection_refresh: buildReportReference(reportDir, options.projectionReportPath, projectionReport),
      report_bundle: reportBundle
        ? buildReportReference(reportDir, options.bundlePath, reportBundle, {
            bundle_id: reportBundle.bundle_id ?? null,
          })
        : {
            path: relative(reportDir, options.bundlePath),
            generated_at: null,
            bundle_id: null,
          },
      runtime_gate: runtimeGateReport
        ? buildReportReference(reportDir, options.runtimeGateReportPath, runtimeGateReport)
        : {
            path: relative(reportDir, options.runtimeGateReportPath),
            generated_at: null,
          },
    },
    prerequisite_checks: {
      release_pipeline_sync: releasePipelineSync,
      upcoming_pipeline_sync: upcomingPipelineSync,
      projection_row_counts: projectionRowCounts,
      sequence_after_sync: sequenceAfterSync,
      artifact_freshness: artifactFreshness,
      target_binding: targetBinding,
      bundle_consistency: {
        status: bundleConsistency.status,
        observed: bundleConsistency,
      },
    },
    runtime_gate_summary: buildRuntimeGateSummary(runtimeGateReport),
  };

  handoff.summary_lines = [
    `status: ${handoff.status}`,
    `release sync: ${releasePipelineSync.status}`,
    `upcoming sync: ${upcomingPipelineSync.status}`,
    `projection rows: ${projectionRowCounts.status}`,
    `projection after sync: ${sequenceAfterSync.status}`,
    `artifact freshness: ${artifactFreshness.status} (${artifactFreshness.observed.age_hours ?? 'n/a'}h old)`,
    `target binding: ${targetBinding.status} (${handoff.target.environment ?? 'unknown'} -> ${handoff.target.classification ?? 'n/a'})`,
    `bundle consistency: ${bundleConsistency.status} (${reportBundle?.bundle_id ?? 'none'})`,
  ];

  await mkdir(reportDir, { recursive: true });
  await writeFile(options.reportPath, JSON.stringify(handoff, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify(handoff, null, 2));
}

await main();
