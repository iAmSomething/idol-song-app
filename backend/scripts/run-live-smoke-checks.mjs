#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_TARGET = 'preview';
const DEFAULT_READY_STATUSES = ['ready', 'degraded'];
const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/live_backend_smoke_report.json');

function parseArgs(argv) {
  const options = {
    baseUrl: null,
    target: DEFAULT_TARGET,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    reportPath: DEFAULT_REPORT_PATH,
    allowReadyStatuses: [...DEFAULT_READY_STATUSES],
    skipReady: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--base-url') {
      options.baseUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === '--target') {
      options.target = argv[index + 1] ?? DEFAULT_TARGET;
      index += 1;
      continue;
    }

    if (value === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1] ?? DEFAULT_REPORT_PATH);
      index += 1;
      continue;
    }

    if (value === '--allow-ready-statuses') {
      const rawValue = argv[index + 1] ?? '';
      options.allowReadyStatuses = rawValue
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      index += 1;
      continue;
    }

    if (value === '--skip-ready') {
      options.skipReady = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!options.baseUrl || typeof options.baseUrl !== 'string') {
    throw new Error('--base-url is required');
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  if (!options.allowReadyStatuses.length) {
    throw new Error('--allow-ready-statuses must contain at least one status');
  }

  return {
    ...options,
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
  };
}

function buildRequestId(label) {
  const normalizedLabel = String(label).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return `live-smoke-${normalizedLabel}-${randomUUID()}`;
}

function buildHeaders(requestId) {
  return {
    accept: 'application/json',
    'x-request-id': requestId,
  };
}

function truncatePreview(value) {
  if (typeof value !== 'string') {
    return null;
  }

  if (value.length <= 1500) {
    return value;
  }

  return `${value.slice(0, 1500)}...`;
}

function readResponseRequestId(body, response) {
  const metaRequestId =
    body && typeof body === 'object' && body !== null && typeof body.meta?.request_id === 'string'
      ? body.meta.request_id
      : null;

  if (metaRequestId) {
    return metaRequestId;
  }

  const headerValue = response.headers.get('x-request-id');
  return typeof headerValue === 'string' && headerValue.trim().length > 0 ? headerValue.trim() : null;
}

function selectHeaders(response) {
  const headerNames = ['content-type', 'cache-control', 'x-request-id'];
  return Object.fromEntries(
    headerNames
      .map((name) => [name, response.headers.get(name)])
      .filter((entry) => typeof entry[1] === 'string' && entry[1].length > 0),
  );
}

async function parseResponseBody(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {
      body: null,
      bodyPreview: null,
    };
  }

  try {
    return {
      body: JSON.parse(rawText),
      bodyPreview: truncatePreview(rawText),
    };
  } catch {
    return {
      body: null,
      bodyPreview: truncatePreview(rawText),
    };
  }
}

async function runCheck(check, options) {
  const requestId = buildRequestId(check.label);
  const startedAt = performance.now();

  try {
    const descriptor = await check.createRequest(options.baseUrl, requestId);
    const response = await fetch(descriptor.url, {
      method: descriptor.method ?? 'GET',
      headers: descriptor.headers ?? buildHeaders(requestId),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const { body, bodyPreview } = await parseResponseBody(response);
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const validation = check.validate({ response, body, options });

    return {
      label: check.label,
      ok: validation.ok,
      status: response.status,
      duration_ms: durationMs,
      request_id_sent: requestId,
      response_request_id: readResponseRequestId(body, response),
      headers: selectHeaders(response),
      body_preview: bodyPreview,
      error: validation.ok ? null : validation.error,
    };
  } catch (error) {
    return {
      label: check.label,
      ok: false,
      status: null,
      duration_ms: Number((performance.now() - startedAt).toFixed(2)),
      request_id_sent: requestId,
      response_request_id: null,
      headers: {},
      body_preview: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildChecks(options) {
  const checks = [
    {
      label: 'health',
      createRequest(baseUrl, requestId) {
        return {
          url: `${baseUrl}/health`,
          headers: buildHeaders(requestId),
        };
      },
      validate({ response }) {
        if (response.status !== 200) {
          return {
            ok: false,
            error: `Expected 200 from /health, received ${response.status}`,
          };
        }

        return { ok: true, error: null };
      },
    },
  ];

  if (!options.skipReady) {
    checks.push({
      label: 'ready',
      createRequest(baseUrl, requestId) {
        return {
          url: `${baseUrl}/ready`,
          headers: buildHeaders(requestId),
        };
      },
      validate({ response, body, options }) {
        if (response.status !== 200) {
          return {
            ok: false,
            error: `Expected 200 from /ready, received ${response.status}`,
          };
        }

        const readyStatus = body && typeof body === 'object' && body !== null ? body.status : null;
        const databaseStatus =
          body &&
          typeof body === 'object' &&
          body !== null &&
          typeof body.database === 'object' &&
          body.database !== null
            ? body.database.status
            : null;

        if (!options.allowReadyStatuses.includes(String(readyStatus))) {
          return {
            ok: false,
            error: `Expected /ready status in [${options.allowReadyStatuses.join(', ')}], received ${String(readyStatus)}`,
          };
        }

        if (databaseStatus !== 'ready') {
          return {
            ok: false,
            error: `Expected /ready database.status to be ready, received ${String(databaseStatus)}`,
          };
        }

        return { ok: true, error: null };
      },
    });
  }

  checks.push(
    {
      label: 'search-yena',
      createRequest(baseUrl, requestId) {
        return {
          url: `${baseUrl}/v1/search?q=${encodeURIComponent('최예나')}`,
          headers: buildHeaders(requestId),
        };
      },
      validate({ response, body }) {
        const entityMatches = Array.isArray(body?.data?.entities) ? body.data.entities : [];
        const hasYena = entityMatches.some((entry) => entry?.entity_slug === 'yena');

        if (response.status !== 200 || !hasYena) {
          return {
            ok: false,
            error: 'Expected /v1/search?q=최예나 to return a YENA entity match',
          };
        }

        return { ok: true, error: null };
      },
    },
    {
      label: 'entity-yena',
      createRequest(baseUrl, requestId) {
        return {
          url: `${baseUrl}/v1/entities/yena`,
          headers: buildHeaders(requestId),
        };
      },
      validate({ response, body }) {
        const entitySlug = body?.data?.identity?.entity_slug ?? body?.data?.entity_slug ?? null;

        if (response.status !== 200 || entitySlug !== 'yena') {
          return {
            ok: false,
            error: 'Expected /v1/entities/yena to return entity identity for YENA',
          };
        }

        return { ok: true, error: null };
      },
    },
    {
      label: 'release-lookup-ive-revive-plus',
      createRequest(baseUrl, requestId) {
        return {
          url: `${baseUrl}/v1/releases/lookup?entity_slug=ive&title=${encodeURIComponent('REVIVE+')}&date=2026-02-23&stream=album`,
          headers: buildHeaders(requestId),
        };
      },
      validate({ response, body }) {
        const releaseId = body?.data?.release_id;

        if (response.status !== 200 || typeof releaseId !== 'string' || releaseId.length === 0) {
          return {
            ok: false,
            error: 'Expected /v1/releases/lookup to resolve IVE / REVIVE+ to a release_id',
          };
        }

        return { ok: true, error: null };
      },
    },
    {
      label: 'radar',
      createRequest(baseUrl, requestId) {
        return {
          url: `${baseUrl}/v1/radar`,
          headers: buildHeaders(requestId),
        };
      },
      validate({ response, body }) {
        const data = body?.data;
        const weekly = Array.isArray(data?.weekly_upcoming) ? data.weekly_upcoming : null;
        const rookie = Array.isArray(data?.rookie) ? data.rookie : null;

        if (response.status !== 200 || weekly === null || rookie === null) {
          return {
            ok: false,
            error: 'Expected /v1/radar to return weekly_upcoming and rookie arrays',
          };
        }

        return { ok: true, error: null };
      },
    },
  );

  return checks;
}

function buildSummary(checks) {
  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  return {
    total_checks: checks.length,
    passed_checks: passed,
    failed_checks: failed,
    ok: failed === 0,
  };
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const checks = buildChecks(options);
  const results = [];

  for (const check of checks) {
    results.push(await runCheck(check, options));
  }

  const report = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    target: options.target,
    base_url: options.baseUrl,
    timeout_ms: options.timeoutMs,
    ready_statuses_allowed: options.allowReadyStatuses,
    ready_check_skipped: options.skipReady,
    summary: buildSummary(results),
    checks: results,
  };

  await writeReport(options.reportPath, report);

  const summaryLine = `[live-smoke] target=${options.target} passed=${report.summary.passed_checks} failed=${report.summary.failed_checks} report=${options.reportPath}`;
  console.log(summaryLine);

  if (!report.summary.ok) {
    throw new Error(summaryLine);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[live-smoke] failed: ${message}`);
  process.exitCode = 1;
});
