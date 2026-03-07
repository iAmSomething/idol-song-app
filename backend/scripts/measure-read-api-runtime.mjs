#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3213';
const DEFAULT_ITERATIONS = 5;
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/read_api_runtime_measurements.json');

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

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    iterations: DEFAULT_ITERATIONS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--base-url') {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--iterations') {
      options.iterations = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1]);
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

  if (!Number.isInteger(options.iterations) || options.iterations <= 0) {
    throw new Error('--iterations must be a positive integer');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  return options;
}

function createRuntimeCases(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  return [
    {
      surface: 'health',
      label: 'health',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/health`,
        expectedStatus: 200,
      }),
    },
    {
      surface: 'ready',
      label: 'ready',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/ready`,
        expectedStatus: 200,
      }),
    },
    {
      surface: 'search',
      label: 'search-yena',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/v1/search?q=${encodeURIComponent('최예나')}`,
        expectedStatus: 200,
      }),
    },
    {
      surface: 'entity_detail',
      label: 'entity-yena',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/v1/entities/yena`,
        expectedStatus: 200,
      }),
    },
    {
      surface: 'release_lookup',
      label: 'release-lookup-blackpink-deadline',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/v1/releases/lookup?entity_slug=blackpink&title=${encodeURIComponent('DEADLINE')}&date=2026-02-26&stream=album`,
        expectedStatus: 200,
      }),
    },
    {
      surface: 'release_detail',
      label: 'release-detail-blackpink-deadline',
      createRequest: async () => {
        const lookupResponse = await fetch(
          `${normalizedBaseUrl}/v1/releases/lookup?entity_slug=blackpink&title=${encodeURIComponent('DEADLINE')}&date=2026-02-26&stream=album`,
        );
        const lookupBody = await lookupResponse.json().catch(() => null);
        const releaseId = lookupBody?.data?.release_id;
        if (!lookupResponse.ok || !releaseId) {
          throw new Error('release lookup failed before release detail measurement');
        }
        return {
          url: `${normalizedBaseUrl}/v1/releases/${releaseId}`,
          expectedStatus: 200,
        };
      },
    },
    {
      surface: 'calendar_month',
      label: 'calendar-2026-03',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/v1/calendar/month?month=2026-03`,
        expectedStatus: 200,
      }),
    },
    {
      surface: 'radar',
      label: 'radar-default',
      createRequest: () => ({
        url: `${normalizedBaseUrl}/v1/radar`,
        expectedStatus: 200,
      }),
    },
  ];
}

async function measureRequest({ url, expectedStatus, timeoutMs }) {
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'application/json',
      },
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    return {
      ok: response.status === expectedStatus,
      status: response.status,
      durationMs,
      error: null,
    };
  } catch (error) {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    return {
      ok: false,
      status: null,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeMeasurements(caseConfig, measurements) {
  const statusCounts = {};
  const durations = [];
  const sampleErrors = [];
  let successCount = 0;

  for (const measurement of measurements) {
    durations.push(measurement.durationMs);
    const key = measurement.status === null ? 'request_error' : String(measurement.status);
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    if (measurement.ok) {
      successCount += 1;
    } else if (measurement.error && sampleErrors.length < 5) {
      sampleErrors.push(measurement.error);
    }
  }

  const requestCount = measurements.length;
  const errorCount = requestCount - successCount;

  return {
    surface: caseConfig.surface,
    label: caseConfig.label,
    request_count: requestCount,
    success_count: successCount,
    error_count: errorCount,
    error_rate: requestCount ? Number((errorCount / requestCount).toFixed(4)) : 0,
    status_counts: statusCounts,
    latency_ms: {
      avg: average(durations),
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: durations.length ? Number(Math.max(...durations).toFixed(2)) : null,
    },
    sample_errors: sampleErrors,
  };
}

function summarizeOverall(cases) {
  const durations = [];
  let requestCount = 0;
  let successCount = 0;
  const statusCounts = {};

  for (const runtimeCase of cases) {
    requestCount += runtimeCase.request_count;
    successCount += runtimeCase.success_count;
    for (const [status, count] of Object.entries(runtimeCase.status_counts)) {
      statusCounts[status] = (statusCounts[status] ?? 0) + count;
    }
    for (const value of Object.values(runtimeCase.latency_ms)) {
      void value;
    }
  }

  return {
    request_count: requestCount,
    success_count: successCount,
    error_count: requestCount - successCount,
    error_rate: requestCount ? Number(((requestCount - successCount) / requestCount).toFixed(4)) : 0,
    status_counts: statusCounts,
  };
}

async function main() {
  const { baseUrl, iterations, timeoutMs, reportPath } = parseArgs(process.argv.slice(2));
  const runtimeCases = createRuntimeCases(baseUrl);
  const caseSummaries = [];

  for (const runtimeCase of runtimeCases) {
    const measurements = [];
    for (let index = 0; index < iterations; index += 1) {
      const request = await runtimeCase.createRequest();
      measurements.push(
        await measureRequest({
          url: request.url,
          expectedStatus: request.expectedStatus,
          timeoutMs,
        }),
      );
    }
    caseSummaries.push(summarizeMeasurements(runtimeCase, measurements));
  }

  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    iterations_per_case: iterations,
    timeout_ms: timeoutMs,
    cases: caseSummaries,
    overall: summarizeOverall(caseSummaries),
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
