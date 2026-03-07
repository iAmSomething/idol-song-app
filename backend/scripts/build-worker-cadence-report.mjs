#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_LIMIT = 12;
const DEFAULT_WORKFLOW = 'weekly-kpop-scan.yml';
const DEFAULT_REPO = 'iAmSomething/idol-song-app';
const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/worker_cadence_report.json');

function parseArgs(argv) {
  const options = {
    workflow: DEFAULT_WORKFLOW,
    repo: DEFAULT_REPO,
    limit: DEFAULT_LIMIT,
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--workflow') {
      options.workflow = argv[index + 1];
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
    throw new Error(`Unknown argument: ${value}`);
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive integer');
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
  const { stdout } = await execFileAsync('gh', [
    'api',
    `repos/${repo}/actions/workflows/${workflow}/runs?per_page=${limit}`,
    '--jq',
    '.workflow_runs',
  ]);
  return JSON.parse(stdout);
}

function summarizeRuns(runs) {
  const completedRuns = runs.filter((run) => run.status === 'completed');
  const scheduledRuns = completedRuns.filter((run) => run.event === 'schedule');
  const manualRuns = completedRuns.filter((run) => run.event !== 'schedule');
  const successRuns = scheduledRuns.filter((run) => run.conclusion === 'success');
  const failureRuns = scheduledRuns.filter((run) => run.conclusion && run.conclusion !== 'success');
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
      newest_created_at: runs[0] ? toIsoString(runs[0].created_at) : null,
      oldest_created_at: runs.at(-1) ? toIsoString(runs.at(-1).created_at) : null,
    },
    totals: {
      all_runs: runs.length,
      completed_runs: completedRuns.length,
      scheduled_runs: scheduledRuns.length,
      manual_runs: manualRuns.length,
      successful_scheduled_runs: successRuns.length,
      failed_scheduled_runs: failureRuns.length,
      scheduled_success_rate:
        scheduledRuns.length === 0 ? null : Number((successRuns.length / scheduledRuns.length).toFixed(4)),
      scheduled_failure_rate:
        scheduledRuns.length === 0 ? null : Number((failureRuns.length / scheduledRuns.length).toFixed(4)),
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
    latest_runs: runs.slice(0, 5).map((run) => ({
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runs = await fetchWorkflowRuns(options);
  const report = {
    generated_at: new Date().toISOString(),
    workflow: options.workflow,
    repo: options.repo,
    sample_limit: options.limit,
    ...summarizeRuns(runs),
  };

  await mkdir(dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
