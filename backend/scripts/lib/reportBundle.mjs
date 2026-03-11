import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function parseIsoTimestamp(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export async function readJsonIfExists(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function buildReportReference(baseDir, reportPath, report, extra = {}) {
  if (!reportPath) {
    return null;
  }

  return {
    path: path.relative(baseDir, reportPath),
    generated_at: parseIsoTimestamp(report?.generated_at ?? null),
    ...extra,
  };
}

export function buildBundleId(parts) {
  const hash = createHash('sha1')
    .update(JSON.stringify(parts))
    .digest('hex')
    .slice(0, 12);

  const prefix = String(parts.bundle_kind ?? 'bundle')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${prefix || 'bundle'}-${hash}`;
}

export function buildReportBundleMetadata({
  bundleKind,
  cadenceProfile,
  sourceKind,
  workflowName,
  gitCommitSha,
  githubRunId,
  releaseSyncReference = null,
  upcomingSyncReference = null,
  projectionReference = null,
  historicalCoverageReference = null,
  nullCoverageReference = null,
  nullRecheckQueueReference = null,
  nullTrendReference = null,
  workerCadenceReference = null,
}) {
  const sourceReports = {
    release_pipeline_sync: releaseSyncReference,
    upcoming_pipeline_sync: upcomingSyncReference,
    projection_refresh: projectionReference,
    historical_coverage: historicalCoverageReference,
    canonical_null_coverage: nullCoverageReference,
    canonical_null_recheck_queue: nullRecheckQueueReference,
    null_coverage_trend: nullTrendReference,
    worker_cadence: workerCadenceReference,
  };

  const fingerprint = {
    bundle_kind: bundleKind,
    cadence_profile: cadenceProfile,
    source_kind: sourceKind,
    workflow_name: workflowName ?? null,
    git_commit_sha: gitCommitSha ?? null,
    github_run_id: githubRunId ?? null,
    source_reports: Object.fromEntries(
      Object.entries(sourceReports).map(([key, value]) => [
        key,
        value
          ? {
              path: value.path ?? null,
              generated_at: value.generated_at ?? null,
            }
          : null,
      ]),
    ),
  };

  const bundleId = buildBundleId(fingerprint);

  return {
    generated_at: new Date().toISOString(),
    bundle_id: bundleId,
    bundle_kind: bundleKind,
    cadence_profile: cadenceProfile,
    source: {
      kind: sourceKind,
      workflow_name: workflowName ?? null,
      git_commit_sha: gitCommitSha ?? null,
      github_run_id: githubRunId ?? null,
    },
    source_reports: sourceReports,
    summary_lines: [
      `bundle id: ${bundleId}`,
      `bundle kind: ${bundleKind}`,
      `cadence profile: ${cadenceProfile}`,
      `workflow: ${workflowName ?? 'manual'}`,
    ],
  };
}

export function readReportBundleId(report) {
  return report?.report_bundle?.bundle_id ?? null;
}

export function buildBundleConsistency({
  bundle,
  parityReport,
  shadowReport,
  runtimeGateReport,
  historicalCoverageReport,
  nullCoverageReport,
  nullTrendReport,
}) {
  const expectedBundleId = bundle?.bundle_id ?? null;
  const requiresParity = typeof parityReport !== 'undefined';
  const requiresShadow = typeof shadowReport !== 'undefined';
  const requiresRuntime = typeof runtimeGateReport !== 'undefined';
  const requiresHistoricalCoverage = typeof historicalCoverageReport !== 'undefined';
  const requiresNullCoverage = typeof nullCoverageReport !== 'undefined';
  const requiresNullTrend = typeof nullTrendReport !== 'undefined';
  const checks = {
    parity_bundle: readReportBundleId(parityReport),
    shadow_bundle: readReportBundleId(shadowReport),
    runtime_gate_bundle: readReportBundleId(runtimeGateReport),
    historical_coverage_generated_at: parseIsoTimestamp(historicalCoverageReport?.generated_at ?? null),
    canonical_null_coverage_generated_at: parseIsoTimestamp(nullCoverageReport?.generated_at ?? null),
    null_coverage_trend_generated_at: parseIsoTimestamp(nullTrendReport?.generated_at ?? null),
  };

  const mismatches = [];

  if (expectedBundleId && requiresParity && parityReport === null) {
    mismatches.push('parity bundle missing');
  } else if (expectedBundleId && checks.parity_bundle && checks.parity_bundle !== expectedBundleId) {
    mismatches.push(`parity bundle drift (${checks.parity_bundle})`);
  }
  if (expectedBundleId && requiresShadow && shadowReport === null) {
    mismatches.push('shadow bundle missing');
  } else if (expectedBundleId && checks.shadow_bundle && checks.shadow_bundle !== expectedBundleId) {
    mismatches.push(`shadow bundle drift (${checks.shadow_bundle})`);
  }
  if (expectedBundleId && requiresRuntime && runtimeGateReport === null) {
    mismatches.push('runtime bundle missing');
  } else if (expectedBundleId && checks.runtime_gate_bundle && checks.runtime_gate_bundle !== expectedBundleId) {
    mismatches.push(`runtime bundle drift (${checks.runtime_gate_bundle})`);
  }

  const expectedHistoricalGeneratedAt = bundle?.source_reports?.historical_coverage?.generated_at ?? null;
  if (requiresHistoricalCoverage && expectedHistoricalGeneratedAt && historicalCoverageReport === null) {
    mismatches.push('historical coverage missing');
  } else if (
    requiresHistoricalCoverage &&
    expectedHistoricalGeneratedAt &&
    checks.historical_coverage_generated_at &&
    checks.historical_coverage_generated_at !== expectedHistoricalGeneratedAt
  ) {
    mismatches.push(`historical coverage drift (${checks.historical_coverage_generated_at})`);
  }

  const expectedNullCoverageGeneratedAt = bundle?.source_reports?.canonical_null_coverage?.generated_at ?? null;
  if (requiresNullCoverage && expectedNullCoverageGeneratedAt && nullCoverageReport === null) {
    mismatches.push('canonical null coverage missing');
  } else if (
    requiresNullCoverage &&
    expectedNullCoverageGeneratedAt &&
    checks.canonical_null_coverage_generated_at &&
    checks.canonical_null_coverage_generated_at !== expectedNullCoverageGeneratedAt
  ) {
    mismatches.push(`canonical null coverage drift (${checks.canonical_null_coverage_generated_at})`);
  }

  const expectedNullTrendGeneratedAt = bundle?.source_reports?.null_coverage_trend?.generated_at ?? null;
  if (requiresNullTrend && expectedNullTrendGeneratedAt && nullTrendReport === null) {
    mismatches.push('null coverage trend missing');
  } else if (
    requiresNullTrend &&
    expectedNullTrendGeneratedAt &&
    checks.null_coverage_trend_generated_at &&
    checks.null_coverage_trend_generated_at !== expectedNullTrendGeneratedAt
  ) {
    mismatches.push(`null coverage trend drift (${checks.null_coverage_trend_generated_at})`);
  }

  return {
    status: mismatches.length === 0 ? 'pass' : 'fail',
    expected_bundle_id: expectedBundleId,
    observed: checks,
    mismatches,
  };
}
