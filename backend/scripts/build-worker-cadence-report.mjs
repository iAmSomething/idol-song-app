#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  buildScheduledEvidenceSummary,
  buildWorkflowScheduleDiagnosticsReport,
} from './lib/workerCadenceEvidence.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_LIMIT = 12;
const DEFAULT_REPO = 'iAmSomething/idol-song-app';
const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/worker_cadence_report.json');
const DEFAULT_DIAGNOSTICS_PATH = resolve(process.cwd(), './reports/workflow_schedule_diagnostics.json');

const DEFAULT_WORKFLOW_CONFIGS = [
  {
    key: 'daily_upcoming',
    workflow: 'weekly-kpop-scan.yml',
    cadence_label: 'daily',
    schedule_expectation: '0 0 * * *',
    runtime_gate_role: 'backend freshness primary path',
    responsibilities: [
      'watchlist rebuild',
      'upcoming/news scan',
      'manual review queue build',
      'release-window hydration',
      'DB sync',
      'projection refresh',
      'canonical null coverage / retry queue / trend artifacts',
      'parity / shadow / runtime / freshness artifacts',
      'release change log',
    ],
    summary_artifacts: [
      'backend/reports/worker_cadence_report.json',
      'backend/reports/workflow_schedule_diagnostics.json',
      'backend/reports/report_bundle_metadata.json',
      'backend/reports/canonical_null_coverage_report.json',
      'backend/reports/canonical_null_recheck_queue.json',
      'backend/reports/null_coverage_trend_report.json',
      'backend/reports/backend_json_parity_report.json',
      'backend/reports/backend_shadow_read_report.json',
      'backend/reports/runtime_gate_report.json',
      'backend/reports/backend_freshness_handoff.json',
    ],
    thresholds: {
      pass_last_success_age_hours: 30,
      review_last_success_age_hours: 48,
    },
  },
  {
    key: 'catalog_enrichment',
    workflow: 'catalog-enrichment-refresh.yml',
    cadence_label: 'weekly',
    schedule_expectation: '0 1 * * 0',
    runtime_gate_role: 'historical catalog enrichment and readiness path',
    responsibilities: [
      'release history rebuild',
      'release detail/title-track enrichment',
      'MV backfill and review queue refresh',
      'DB sync',
      'projection refresh',
      'canonical null coverage / retry queue / trend artifacts',
      'parity / shadow / runtime / readiness artifacts',
    ],
    summary_artifacts: [
      'backend/reports/worker_cadence_report.json',
      'backend/reports/workflow_schedule_diagnostics.json',
      'backend/reports/report_bundle_metadata.json',
      'backend/reports/canonical_null_coverage_report.json',
      'backend/reports/canonical_null_recheck_queue.json',
      'backend/reports/null_coverage_trend_report.json',
      'backend/reports/historical_release_detail_coverage_report.json',
      'backend/reports/migration_readiness_scorecard.json',
      'backend/reports/migration_readiness_scorecard.md',
    ],
    thresholds: {
      pass_last_success_age_hours: 192,
      review_last_success_age_hours: 240,
    },
  },
];

function parseArgs(argv) {
  const options = {
    workflowConfigs: [],
    repo: DEFAULT_REPO,
    limit: DEFAULT_LIMIT,
    reportPath: DEFAULT_REPORT_PATH,
    diagnosticsPath: DEFAULT_DIAGNOSTICS_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--workflow') {
      options.workflowConfigs.push({
        key: String(argv[index + 1] ?? '')
          .replace(/\.ya?ml$/i, '')
          .replace(/[^a-z0-9]+/gi, '_')
          .toLowerCase(),
        workflow: argv[index + 1],
        cadence_label: 'custom',
        schedule_expectation: null,
        runtime_gate_role: 'custom cadence sample',
        responsibilities: [],
        summary_artifacts: [],
        thresholds: {
          pass_last_success_age_hours: 80,
          review_last_success_age_hours: 96,
        },
      });
      index += 1;
      continue;
    }
    if (value === '--repo') {
      options.repo = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--limit') {
      options.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--diagnostics-path') {
      options.diagnosticsPath = resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive integer');
  }

  if (options.workflowConfigs.length === 0) {
    options.workflowConfigs = DEFAULT_WORKFLOW_CONFIGS;
  }

  return options;
}

function toIsoString(value) {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toEpochMs(value) {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function minutesBetween(startedAt, finishedAt) {
  const started = toEpochMs(startedAt);
  const finished = toEpochMs(finishedAt);
  if (started === null || finished === null) {
    return null;
  }
  return Number((((finished - started) / 1000) / 60).toFixed(2));
}

function percentile(values, ratio) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return Number(sorted[index].toFixed(2));
}

function average(values) {
  if (!values.length) {
    return null;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

async function fetchWorkflowRuns({ repo, workflow, limit }) {
  try {
    const { stdout } = await execFileAsync('gh', ['api', `repos/${repo}/actions/workflows/${workflow}/runs?per_page=${limit}`]);
    return {
      workflow_registered: true,
      ...JSON.parse(stdout),
    };
  } catch (error) {
    const stderr = `${error?.stderr ?? ''}`;
    if (stderr.includes('404')) {
      return {
        workflow_registered: false,
        total_count: 0,
        runs: [],
      };
    }
    throw error;
  }
}

async function fetchScheduledWorkflowRuns({ repo, workflow, limit }) {
  try {
    const { stdout } = await execFileAsync('gh', [
      'api',
      `repos/${repo}/actions/workflows/${workflow}/runs?per_page=${limit}&event=schedule`,
    ]);
    return {
      workflow_registered: true,
      ...JSON.parse(stdout),
    };
  } catch (error) {
    const stderr = `${error?.stderr ?? ''}`;
    if (stderr.includes('404')) {
      return {
        workflow_registered: false,
        total_count: 0,
        runs: [],
      };
    }
    throw error;
  }
}

async function fetchWorkflowMetadata({ repo, workflow }) {
  try {
    const { stdout } = await execFileAsync('gh', ['api', `repos/${repo}/actions/workflows/${workflow}`]);
    return {
      workflow_registered: true,
      ...JSON.parse(stdout),
    };
  } catch (error) {
    const stderr = `${error?.stderr ?? ''}`;
    if (stderr.includes('404')) {
      return {
        workflow_registered: false,
        created_at: null,
        updated_at: null,
        state: null,
        html_url: null,
      };
    }
    throw error;
  }
}

async function fetchRepositoryMetadata({ repo }) {
  const { stdout } = await execFileAsync('gh', [
    'api',
    `repos/${repo}`,
    '--jq',
    '{default_branch, archived, disabled, private, pushed_at, updated_at}',
  ]);
  return JSON.parse(stdout);
}

async function fetchActionsPermissions({ repo }) {
  const [actionsPermissionsResult, workflowPermissionsResult] = await Promise.all([
    execFileAsync('gh', ['api', `repos/${repo}/actions/permissions`]),
    execFileAsync('gh', ['api', `repos/${repo}/actions/permissions/workflow`]),
  ]);

  return {
    actionsPermissions: JSON.parse(actionsPermissionsResult.stdout),
    workflowPermissions: JSON.parse(workflowPermissionsResult.stdout),
  };
}

function summarizeRuns({ overallRuns, scheduledRuns, scheduledTotalCount }) {
  const completedRuns = overallRuns.filter((run) => run.status === 'completed');
  const completedScheduledRuns = scheduledRuns.filter((run) => run.status === 'completed');
  const manualRuns = completedRuns.filter((run) => run.event !== 'schedule');
  const successRuns = completedScheduledRuns.filter((run) => run.conclusion === 'success');
  const failureRuns = completedScheduledRuns.filter((run) => run.conclusion && run.conclusion !== 'success');
  const durations = completedRuns
    .map((run) => minutesBetween(run.run_started_at ?? run.created_at, run.updated_at))
    .filter((value) => value !== null);
  const successTimestamps = successRuns
    .map((run) => toEpochMs(run.created_at))
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  const gapHours = [];
  for (let index = 1; index < successTimestamps.length; index += 1) {
    gapHours.push(Number((((successTimestamps[index] - successTimestamps[index - 1]) / 1000) / 3600).toFixed(2)));
  }

  const lastSuccess = successRuns[0] ?? null;
  const lastSuccessAt = lastSuccess ? toIsoString(lastSuccess.updated_at ?? lastSuccess.created_at) : null;
  const lastSuccessAgeHours =
    lastSuccessAt === null
      ? null
      : Number((((Date.now() - new Date(lastSuccessAt).getTime()) / 1000) / 3600).toFixed(2));

  return {
    sample_window: {
      newest_created_at: overallRuns[0] ? toIsoString(overallRuns[0].created_at) : null,
      oldest_created_at: overallRuns.at(-1) ? toIsoString(overallRuns.at(-1).created_at) : null,
    },
    totals: {
      all_runs: overallRuns.length,
      completed_runs: completedRuns.length,
      scheduled_runs: scheduledTotalCount,
      scheduled_sampled_runs: completedScheduledRuns.length,
      manual_runs: manualRuns.length,
      successful_scheduled_runs: successRuns.length,
      failed_scheduled_runs: failureRuns.length,
      scheduled_success_rate:
        completedScheduledRuns.length === 0 ? null : Number((successRuns.length / completedScheduledRuns.length).toFixed(4)),
      scheduled_failure_rate:
        completedScheduledRuns.length === 0 ? null : Number((failureRuns.length / completedScheduledRuns.length).toFixed(4)),
    },
    duration_minutes: {
      avg: average(durations),
      p95: percentile(durations, 0.95),
      max: durations.length ? Number(Math.max(...durations).toFixed(2)) : null,
    },
    cadence: {
      last_success_at: lastSuccessAt,
      last_success_age_hours: lastSuccessAgeHours,
      avg_success_gap_hours: average(gapHours),
      max_success_gap_hours: gapHours.length ? Number(Math.max(...gapHours).toFixed(2)) : null,
    },
    latest_runs: overallRuns.slice(0, 5).map((run) => ({
      database_id: run.id,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      created_at: toIsoString(run.created_at),
      started_at: toIsoString(run.run_started_at ?? run.created_at),
      updated_at: toIsoString(run.updated_at),
      duration_minutes: minutesBetween(run.run_started_at ?? run.created_at, run.updated_at),
      html_url: run.html_url ?? null,
    })),
    latest_scheduled_runs: scheduledRuns.slice(0, 5).map((run) => ({
      database_id: run.id,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      created_at: toIsoString(run.created_at),
      started_at: toIsoString(run.run_started_at ?? run.created_at),
      updated_at: toIsoString(run.updated_at),
      duration_minutes: minutesBetween(run.run_started_at ?? run.created_at, run.updated_at),
      html_url: run.html_url ?? null,
    })),
  };
}

function buildPathReport(config, workflowData, scheduledWorkflowData, workflowMetadata, sampleLimit) {
  const summary = summarizeRuns({
    overallRuns: workflowData.workflow_runs ?? [],
    scheduledRuns: scheduledWorkflowData.workflow_runs ?? [],
    scheduledTotalCount: scheduledWorkflowData.total_count ?? 0,
  });
  const lastSuccessAgeHours = summary.cadence.last_success_age_hours;
  const scheduledEvidence = buildScheduledEvidenceSummary({
    workflowRegistered: workflowData.workflow_registered && workflowMetadata.workflow_registered,
    workflowMetadata,
    cadenceLabel: config.cadence_label,
    scheduleExpectation: config.schedule_expectation,
    observedScheduledRuns: summary.totals.scheduled_runs,
  });

  return {
    key: config.key,
    workflow: config.workflow,
    workflow_registered: workflowData.workflow_registered,
    cadence_label: config.cadence_label,
    schedule_expectation: config.schedule_expectation,
    runtime_gate_role: config.runtime_gate_role,
    responsibilities: config.responsibilities,
    summary_artifacts: config.summary_artifacts,
    thresholds: config.thresholds,
    sample_limit: sampleLimit,
    workflow_metadata: {
      created_at: workflowMetadata.created_at ?? null,
      updated_at: workflowMetadata.updated_at ?? null,
      state: workflowMetadata.state ?? null,
      html_url: workflowMetadata.html_url ?? null,
    },
    ...summary,
    scheduled_evidence: scheduledEvidence,
    cadence_status:
      !workflowData.workflow_registered
        ? 'workflow_not_registered'
        : summary.totals.scheduled_runs === 0
          ? scheduledEvidence.status
          : typeof lastSuccessAgeHours === 'number' &&
              lastSuccessAgeHours <= config.thresholds.pass_last_success_age_hours
            ? 'pass'
            : typeof lastSuccessAgeHours === 'number' &&
                lastSuccessAgeHours <= config.thresholds.review_last_success_age_hours
              ? 'needs_review'
              : 'fail',
  };
}

function buildSummaryLines(paths, primaryPathKey) {
  return paths.map((entry) => {
    const prefix = entry.key === primaryPathKey ? '[primary]' : '[secondary]';
    const scheduledRuns = entry.totals.scheduled_runs;
    const failureRate =
      typeof entry.totals.scheduled_failure_rate === 'number' ? entry.totals.scheduled_failure_rate : 'n/a';
    const lastSuccessAge =
      typeof entry.cadence.last_success_age_hours === 'number' ? `${entry.cadence.last_success_age_hours}h` : 'n/a';
    if (entry.cadence_status === 'warming_up') {
      return `${prefix} ${entry.key}: cadence=${entry.cadence_label}, status=warming_up, first_due=${entry.scheduled_evidence.first_expected_run_at ?? 'n/a'}, deadline=${entry.scheduled_evidence.warmup_deadline_at ?? 'n/a'}`;
    }
    if (entry.cadence_status === 'scheduled_evidence_missing') {
      return `${prefix} ${entry.key}: cadence=${entry.cadence_label}, status=scheduled_evidence_missing, observed=${entry.scheduled_evidence.observed_scheduled_runs}, expected_by_now=${entry.scheduled_evidence.expected_scheduled_runs_by_now}, missed_windows=${entry.scheduled_evidence.missed_scheduled_windows}`;
    }
    return `${prefix} ${entry.key}: cadence=${entry.cadence_label}, status=${entry.cadence_status}, scheduled_runs=${scheduledRuns}, failure_rate=${failureRate}, last_success_age=${lastSuccessAge}`;
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [{ actionsPermissions, workflowPermissions }, repositoryMetadata, pathReports] = await Promise.all([
    fetchActionsPermissions({ repo: options.repo }),
    fetchRepositoryMetadata({ repo: options.repo }),
    Promise.all(
      options.workflowConfigs.map(async (config) => {
        const [workflowData, scheduledWorkflowData, workflowMetadata] = await Promise.all([
          fetchWorkflowRuns({
            repo: options.repo,
            workflow: config.workflow,
            limit: options.limit,
          }),
          fetchScheduledWorkflowRuns({
            repo: options.repo,
            workflow: config.workflow,
            limit: options.limit,
          }),
          fetchWorkflowMetadata({
            repo: options.repo,
            workflow: config.workflow,
          }),
        ]);
        return buildPathReport(config, workflowData, scheduledWorkflowData, workflowMetadata, options.limit);
      }),
    ),
  ]);

  const primaryPath =
    pathReports.find((entry) => entry.key === 'daily_upcoming') ??
    pathReports.find((entry) => entry.key === DEFAULT_WORKFLOW_CONFIGS[0].key) ??
    pathReports[0];

  const topology = Object.fromEntries(
    pathReports.map((entry) => [
      entry.key,
      {
        workflow: entry.workflow,
        workflow_registered: entry.workflow_registered,
        cadence_label: entry.cadence_label,
        schedule_expectation: entry.schedule_expectation,
        runtime_gate_role: entry.runtime_gate_role,
        responsibilities: entry.responsibilities,
        summary_artifacts: entry.summary_artifacts,
        thresholds: entry.thresholds,
        workflow_metadata: entry.workflow_metadata,
        cadence_status: entry.cadence_status,
        sample_limit: entry.sample_limit,
        sample_window: entry.sample_window,
        totals: entry.totals,
        duration_minutes: entry.duration_minutes,
        cadence: entry.cadence,
        scheduled_evidence: entry.scheduled_evidence,
        latest_runs: entry.latest_runs,
        latest_scheduled_runs: entry.latest_scheduled_runs,
      },
    ]),
  );

  const report = {
    generated_at: new Date().toISOString(),
    repo: options.repo,
    sample_limit: options.limit,
    diagnostics_report_path: relative(process.cwd(), options.diagnosticsPath),
    primary_path_key: primaryPath.key,
    summary_lines: buildSummaryLines(pathReports, primaryPath.key),
    topology,
    workflow: primaryPath.workflow,
    sample_window: primaryPath.sample_window,
    totals: primaryPath.totals,
    duration_minutes: primaryPath.duration_minutes,
    cadence: primaryPath.cadence,
    scheduled_evidence: primaryPath.scheduled_evidence,
    latest_runs: primaryPath.latest_runs,
    latest_scheduled_runs: primaryPath.latest_scheduled_runs,
  };

  const diagnosticsReport = buildWorkflowScheduleDiagnosticsReport({
    repo: options.repo,
    repository: repositoryMetadata,
    actionsPermissions,
    workflowPermissions,
    workflowDiagnostics: pathReports.map((entry) => ({
      key: entry.key,
      workflow: entry.workflow,
      workflow_registered: entry.workflow_registered,
      workflow_state: entry.workflow_metadata.state,
      workflow_html_url: entry.workflow_metadata.html_url,
      cadence_label: entry.cadence_label,
      cadence_status: entry.cadence_status,
      schedule_expectation: entry.schedule_expectation,
      workflow_created_at: entry.workflow_metadata.created_at,
      workflow_updated_at: entry.workflow_metadata.updated_at,
      observed_scheduled_runs: entry.scheduled_evidence.observed_scheduled_runs,
      expected_scheduled_runs_by_now: entry.scheduled_evidence.expected_scheduled_runs_by_now,
      missed_scheduled_windows: entry.scheduled_evidence.missed_scheduled_windows,
      first_expected_run_at: entry.scheduled_evidence.first_expected_run_at,
      next_expected_run_at: entry.scheduled_evidence.next_expected_run_at,
      last_success_at: entry.cadence.last_success_at,
      last_success_age_hours: entry.cadence.last_success_age_hours,
      manual_runs: entry.totals.manual_runs,
      latest_run: entry.latest_runs[0] ?? null,
      latest_scheduled_run: entry.latest_scheduled_runs[0] ?? null,
    })),
  });

  await mkdir(dirname(options.reportPath), { recursive: true });
  await mkdir(dirname(options.diagnosticsPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(options.diagnosticsPath, `${JSON.stringify(diagnosticsReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
