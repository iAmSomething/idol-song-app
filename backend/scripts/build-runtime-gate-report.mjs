#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { buildNullCoverageEvaluation } from './lib/canonicalNullCoverage.mjs';
import { buildBundleConsistency, readJsonIfExists } from './lib/reportBundle.mjs';

const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/runtime_gate_report.json');
const DEFAULT_LATENCY_REPORT_PATH = resolve(process.cwd(), './reports/read_api_runtime_measurements.json');
const DEFAULT_CADENCE_REPORT_PATH = resolve(process.cwd(), './reports/worker_cadence_report.json');
const DEFAULT_PROJECTION_REPORT_PATH = resolve(process.cwd(), './reports/projection_refresh_summary.json');
const DEFAULT_PARITY_REPORT_PATH = resolve(process.cwd(), './reports/backend_json_parity_report.json');
const DEFAULT_SHADOW_REPORT_PATH = resolve(process.cwd(), './reports/backend_shadow_read_report.json');
const DEFAULT_HISTORICAL_COVERAGE_REPORT_PATH = resolve(
  process.cwd(),
  './reports/historical_release_detail_coverage_report.json',
);
const DEFAULT_NULL_COVERAGE_REPORT_PATH = resolve(process.cwd(), './reports/canonical_null_coverage_report.json');
const DEFAULT_NULL_TREND_REPORT_PATH = resolve(process.cwd(), './reports/null_coverage_trend_report.json');
const DEFAULT_SAME_DAY_RELEASE_ACCEPTANCE_REPORT_PATH = resolve(
  process.cwd(),
  './reports/same_day_release_acceptance_report.json',
);
const DEFAULT_BUNDLE_PATH = resolve(process.cwd(), './reports/report_bundle_metadata.json');

const GATE_THRESHOLDS = {
  latency: {
    passP95Ms: 750,
    reviewP95Ms: 1200,
    minCaseSamplesForPass: 5,
  },
  errorRate: {
    passRate: 0.01,
    reviewRate: 0.03,
    minRequestsForPass: 40,
  },
  freshness: {
    passLagMinutes: 20,
    reviewLagMinutes: 60,
  },
  workerCadence: {
    passFailureRate: 0.1,
    reviewFailureRate: 0.25,
    passLastSuccessAgeHours: 30,
    reviewLastSuccessAgeHours: 48,
  },
};

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
    latencyReportPath: DEFAULT_LATENCY_REPORT_PATH,
    cadenceReportPath: DEFAULT_CADENCE_REPORT_PATH,
    projectionReportPath: DEFAULT_PROJECTION_REPORT_PATH,
    parityReportPath: DEFAULT_PARITY_REPORT_PATH,
    shadowReportPath: DEFAULT_SHADOW_REPORT_PATH,
    historicalCoverageReportPath: DEFAULT_HISTORICAL_COVERAGE_REPORT_PATH,
    nullCoverageReportPath: DEFAULT_NULL_COVERAGE_REPORT_PATH,
    nullTrendReportPath: DEFAULT_NULL_TREND_REPORT_PATH,
    sameDayReleaseAcceptanceReportPath: DEFAULT_SAME_DAY_RELEASE_ACCEPTANCE_REPORT_PATH,
    bundlePath: DEFAULT_BUNDLE_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--latency-report-path') {
      options.latencyReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--cadence-report-path') {
      options.cadenceReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--projection-report-path') {
      options.projectionReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--parity-report-path') {
      options.parityReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--shadow-report-path') {
      options.shadowReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--historical-coverage-report-path') {
      options.historicalCoverageReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--null-coverage-report-path') {
      options.nullCoverageReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--null-trend-report-path') {
      options.nullTrendReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--same-day-release-acceptance-report-path') {
      options.sameDayReleaseAcceptanceReportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--bundle-path') {
      options.bundlePath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function toMinutesSince(timestamp) {
  const parsed = new Date(timestamp ?? '');
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Number((((Date.now() - parsed.getTime()) / 1000) / 60).toFixed(2));
}

function deriveStatus({ pass, review }) {
  if (pass) {
    return 'pass';
  }
  if (review) {
    return 'needs_review';
  }
  return 'fail';
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

function buildLatencyGate(latencyReport) {
  const p95 = latencyReport?.cases?.map((item) => item?.latency_ms?.p95).filter((value) => typeof value === 'number') ?? [];
  const sampleCounts = latencyReport?.cases?.map((item) => item?.request_count).filter((value) => typeof value === 'number') ?? [];
  const worstP95 = p95.length ? Math.max(...p95) : null;
  const lowestSampleCount = sampleCounts.length ? Math.min(...sampleCounts) : 0;
  const pass =
    typeof worstP95 === 'number' &&
    worstP95 <= GATE_THRESHOLDS.latency.passP95Ms &&
    lowestSampleCount >= GATE_THRESHOLDS.latency.minCaseSamplesForPass;
  const review =
    typeof worstP95 === 'number' &&
    worstP95 <= GATE_THRESHOLDS.latency.reviewP95Ms;

  return {
    status: deriveStatus({ pass, review }),
    observed: {
      worst_case_p95_ms: worstP95,
      lowest_case_sample_count: lowestSampleCount,
    },
    thresholds: GATE_THRESHOLDS.latency,
  };
}

function buildErrorRateGate(latencyReport) {
  const errorRate = latencyReport?.overall?.error_rate;
  const requestCount = latencyReport?.overall?.request_count ?? 0;
  const pass =
    typeof errorRate === 'number' &&
    errorRate <= GATE_THRESHOLDS.errorRate.passRate &&
    requestCount >= GATE_THRESHOLDS.errorRate.minRequestsForPass;
  const review = typeof errorRate === 'number' && errorRate <= GATE_THRESHOLDS.errorRate.reviewRate;

  return {
    status: deriveStatus({ pass, review }),
    observed: {
      overall_error_rate: errorRate ?? null,
      overall_request_count: requestCount,
    },
    thresholds: GATE_THRESHOLDS.errorRate,
  };
}

function buildFreshnessGate(projectionReport) {
  const lagMinutes = toMinutesSince(projectionReport?.generated_at);
  const pass = typeof lagMinutes === 'number' && lagMinutes <= GATE_THRESHOLDS.freshness.passLagMinutes;
  const review = typeof lagMinutes === 'number' && lagMinutes <= GATE_THRESHOLDS.freshness.reviewLagMinutes;

  return {
    status: deriveStatus({ pass, review }),
    observed: {
      projection_generated_at: projectionReport?.generated_at ?? null,
      lag_minutes: lagMinutes,
    },
    thresholds: GATE_THRESHOLDS.freshness,
  };
}

function buildWorkerCadenceGate(cadenceReport) {
  const primaryPathKey = cadenceReport?.primary_path_key ?? null;
  const primaryPath = primaryPathKey ? cadenceReport?.topology?.[primaryPathKey] ?? null : null;
  const observedSource = primaryPath ?? cadenceReport;
  const failureRate = observedSource?.totals?.scheduled_failure_rate;
  const lastSuccessAgeHours = observedSource?.cadence?.last_success_age_hours;
  const cadenceStatus = observedSource?.cadence_status ?? null;
  const scheduledEvidence = observedSource?.scheduled_evidence ?? null;

  if (cadenceStatus === 'warming_up') {
    return {
      status: 'needs_review',
      observed: {
        primary_path_key: primaryPathKey,
        cadence_label: observedSource?.cadence_label ?? null,
        scheduled_failure_rate: failureRate ?? null,
        last_success_age_hours: lastSuccessAgeHours ?? null,
        scheduled_runs: observedSource?.totals?.scheduled_runs ?? 0,
        cadence_status: cadenceStatus,
        scheduled_evidence: scheduledEvidence,
      },
      thresholds: GATE_THRESHOLDS.workerCadence,
    };
  }

  if (cadenceStatus === 'scheduled_evidence_missing' || cadenceStatus === 'workflow_not_registered') {
    return {
      status: 'fail',
      observed: {
        primary_path_key: primaryPathKey,
        cadence_label: observedSource?.cadence_label ?? null,
        scheduled_failure_rate: failureRate ?? null,
        last_success_age_hours: lastSuccessAgeHours ?? null,
        scheduled_runs: observedSource?.totals?.scheduled_runs ?? 0,
        cadence_status: cadenceStatus,
        scheduled_evidence: scheduledEvidence,
      },
      thresholds: GATE_THRESHOLDS.workerCadence,
    };
  }

  const pass =
    typeof failureRate === 'number' &&
    typeof lastSuccessAgeHours === 'number' &&
    failureRate <= GATE_THRESHOLDS.workerCadence.passFailureRate &&
    lastSuccessAgeHours <= GATE_THRESHOLDS.workerCadence.passLastSuccessAgeHours;
  const review =
    typeof failureRate === 'number' &&
    typeof lastSuccessAgeHours === 'number' &&
    failureRate <= GATE_THRESHOLDS.workerCadence.reviewFailureRate &&
    lastSuccessAgeHours <= GATE_THRESHOLDS.workerCadence.reviewLastSuccessAgeHours;

  return {
    status: deriveStatus({ pass, review }),
    observed: {
      primary_path_key: primaryPathKey,
      cadence_label: observedSource?.cadence_label ?? null,
      scheduled_failure_rate: failureRate ?? null,
      last_success_age_hours: lastSuccessAgeHours ?? null,
      scheduled_runs: observedSource?.totals?.scheduled_runs ?? 0,
      cadence_status: cadenceStatus,
      scheduled_evidence: scheduledEvidence,
    },
    thresholds: GATE_THRESHOLDS.workerCadence,
  };
}

function buildDependencyGate(report, cleanKey, label) {
  const clean = Boolean(report?.[cleanKey]);
  return {
    status: clean ? 'pass' : 'fail',
    observed: {
      clean,
      generated_at: report?.generated_at ?? null,
      summary_lines: Array.isArray(report?.summary_lines) ? report.summary_lines : [],
    },
    label,
  };
}

function buildCriticalNullCoverageGate(coverageReport, trendReport) {
  const evaluation = buildNullCoverageEvaluation(coverageReport, trendReport);
  return {
    status: evaluation.status,
    observed: evaluation,
    label: 'critical_null_coverage',
  };
}

function buildSameDayAcceptanceGate(report) {
  if (!report) {
    return {
      status: 'fail',
      observed: {
        overall_status: null,
        generated_at: null,
        failed_fixtures: [],
        summary_lines: [],
      },
      label: 'same_day_release_acceptance',
    };
  }

  const failedFixtures = Array.isArray(report.fixtures)
    ? report.fixtures
        .filter((fixture) => fixture?.status !== 'pass')
        .map((fixture) => ({
          key: fixture?.key ?? null,
          label: fixture?.label ?? null,
          missing_requirements: Array.isArray(fixture?.missing_requirements) ? fixture.missing_requirements : [],
        }))
    : [];

  return {
    status: report.overall_status === 'pass' ? 'pass' : 'fail',
    observed: {
      overall_status: report.overall_status ?? null,
      generated_at: report.generated_at ?? null,
      failed_fixtures: failedFixtures,
      summary_lines: Array.isArray(report.summary_lines) ? report.summary_lines : [],
    },
    label: 'same_day_release_acceptance',
  };
}

function buildStageGate(statuses, blockingDependencies) {
  const combined = [...statuses, ...blockingDependencies];
  return worstStatus(combined);
}

function buildShadowToWebCutoverGate(runtimeChecks, dependencyChecks) {
  return buildStageGate(
    Object.values(runtimeChecks).map((item) => item.status),
    Object.values(dependencyChecks).map((item) => item.status),
  );
}

function buildWebToJsonDemotionGate(runtimeChecks, dependencyChecks) {
  const dependencyStatuses = Object.values(dependencyChecks).map((item) => item.status);
  if (dependencyStatuses.includes('fail')) {
    return 'fail';
  }

  if (runtimeChecks.projection_freshness.status !== 'pass' || runtimeChecks.worker_cadence.status !== 'pass') {
    return 'fail';
  }

  const latencyStatus = runtimeChecks.api_latency.status;
  const errorRateStatus = runtimeChecks.api_error_rate.status;
  if (latencyStatus === 'fail' || errorRateStatus === 'fail') {
    return 'fail';
  }

  if (latencyStatus === 'needs_review' || errorRateStatus === 'needs_review') {
    return 'needs_review';
  }

  return 'pass';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [
    latencyReport,
    cadenceReport,
    projectionReport,
    parityReport,
    shadowReport,
    historicalCoverageReport,
    nullCoverageReport,
    nullTrendReport,
    sameDayAcceptanceReport,
    reportBundle,
  ] =
    await Promise.all([
      loadJson(options.latencyReportPath),
      loadJson(options.cadenceReportPath),
      loadJson(options.projectionReportPath),
      loadJson(options.parityReportPath),
      loadJson(options.shadowReportPath),
      loadJson(options.historicalCoverageReportPath),
      loadJson(options.nullCoverageReportPath),
      loadJson(options.nullTrendReportPath),
      readJsonIfExists(options.sameDayReleaseAcceptanceReportPath),
      readJsonIfExists(options.bundlePath),
    ]);

  const runtimeChecks = {
    api_latency: buildLatencyGate(latencyReport),
    api_error_rate: buildErrorRateGate(latencyReport),
    projection_freshness: buildFreshnessGate(projectionReport),
    worker_cadence: buildWorkerCadenceGate(cadenceReport),
  };
  const bundleConsistency = buildBundleConsistency({
    bundle: reportBundle,
    parityReport,
    shadowReport,
    historicalCoverageReport,
    nullCoverageReport,
    nullTrendReport,
    sameDayAcceptanceReport,
  });

  const dependencyChecks = {
    parity: buildDependencyGate(parityReport, 'clean', 'backend_json_parity_report'),
    shadow: buildDependencyGate(shadowReport, 'clean', 'backend_shadow_read_report'),
    historical_catalog_completeness: buildDependencyGate(
      historicalCoverageReport?.cutover_gates,
      'cutover_ready',
      'historical_release_detail_coverage_report',
    ),
    critical_null_coverage: buildCriticalNullCoverageGate(nullCoverageReport, nullTrendReport),
    same_day_release_acceptance: buildSameDayAcceptanceGate(sameDayAcceptanceReport),
    bundle_consistency: {
      status: bundleConsistency.status,
      observed: bundleConsistency,
      label: 'report_bundle_metadata',
    },
  };

  const stageGates = {
    shadow_to_web_cutover: buildShadowToWebCutoverGate(runtimeChecks, dependencyChecks),
    web_cutover_to_json_demotion: buildWebToJsonDemotionGate(runtimeChecks, dependencyChecks),
  };

  const summaryLines = [
    `api latency: ${runtimeChecks.api_latency.status} (worst p95=${runtimeChecks.api_latency.observed.worst_case_p95_ms ?? 'n/a'}ms)`,
    `api error rate: ${runtimeChecks.api_error_rate.status} (error rate=${runtimeChecks.api_error_rate.observed.overall_error_rate ?? 'n/a'})`,
    `projection freshness: ${runtimeChecks.projection_freshness.status} (lag=${runtimeChecks.projection_freshness.observed.lag_minutes ?? 'n/a'}m)`,
    runtimeChecks.worker_cadence.observed.cadence_status === 'warming_up'
      ? `worker cadence: ${runtimeChecks.worker_cadence.status} (cadence_status=warming_up, deadline=${runtimeChecks.worker_cadence.observed.scheduled_evidence?.warmup_deadline_at ?? 'n/a'})`
      : runtimeChecks.worker_cadence.observed.cadence_status === 'scheduled_evidence_missing'
        ? `worker cadence: ${runtimeChecks.worker_cadence.status} (cadence_status=scheduled_evidence_missing, missed_windows=${runtimeChecks.worker_cadence.observed.scheduled_evidence?.missed_scheduled_windows ?? 'n/a'})`
        : `worker cadence: ${runtimeChecks.worker_cadence.status} (failure rate=${runtimeChecks.worker_cadence.observed.scheduled_failure_rate ?? 'n/a'})`,
    `parity dependency: ${dependencyChecks.parity.status}`,
    `shadow dependency: ${dependencyChecks.shadow.status}`,
    `historical catalog completeness dependency: ${dependencyChecks.historical_catalog_completeness.status}`,
    `critical null coverage dependency: ${dependencyChecks.critical_null_coverage.status}`,
    `same-day release acceptance dependency: ${dependencyChecks.same_day_release_acceptance.status}`,
    `bundle consistency: ${bundleConsistency.status}`,
    `shadow -> web cutover gate: ${stageGates.shadow_to_web_cutover}`,
    `web cutover -> JSON demotion gate: ${stageGates.web_cutover_to_json_demotion}`,
  ];

  const report = {
    generated_at: new Date().toISOString(),
    report_bundle: reportBundle,
    bundle_consistency: bundleConsistency,
    thresholds: GATE_THRESHOLDS,
    evidence_paths: {
      latency_report: options.latencyReportPath,
      cadence_report: options.cadenceReportPath,
      projection_report: options.projectionReportPath,
      parity_report: options.parityReportPath,
      shadow_report: options.shadowReportPath,
      historical_coverage_report: options.historicalCoverageReportPath,
      canonical_null_coverage_report: options.nullCoverageReportPath,
      null_coverage_trend_report: options.nullTrendReportPath,
      same_day_release_acceptance_report: options.sameDayReleaseAcceptanceReportPath,
      bundle_report: options.bundlePath,
    },
    summary_lines: summaryLines,
    runtime_checks: runtimeChecks,
    dependency_checks: dependencyChecks,
    stage_gates: stageGates,
  };

  await mkdir(dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
