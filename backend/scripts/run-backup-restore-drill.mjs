#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import pg from 'pg';

const { Client } = pg;

const CANONICAL_TABLES = [
  'entities',
  'entity_aliases',
  'entity_official_links',
  'youtube_channels',
  'entity_youtube_channels',
  'releases',
  'release_artwork',
  'tracks',
  'release_service_links',
  'track_service_links',
  'upcoming_signals',
  'upcoming_signal_sources',
  'entity_tracking_state',
  'review_tasks',
  'release_link_overrides',
];

const PROJECTION_OBJECTS = [
  'entity_search_documents',
  'calendar_month_projection',
  'entity_detail_projection',
  'release_detail_projection',
  'radar_projection',
];

const DEFAULT_PORT = 3224;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_REPORT_PATH = resolve(process.cwd(), '../backend/reports/neon_backup_restore_drill_2026-03-08.json');

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    keepSchemas: false,
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--port') {
      options.port = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (value === '--timeout-ms') {
      options.timeoutMs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1] ?? DEFAULT_REPORT_PATH);
      index += 1;
      continue;
    }

    if (value === '--keep-schemas') {
      options.keepSchemas = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error('--port must be a positive integer');
  }

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }

  return options;
}

function buildSchemaSuffix() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${date}_${randomUUID().slice(0, 8)}`.toLowerCase();
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function assertSchemaName(value) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`Invalid schema name: ${value}`);
  }
}

function appendSearchPathToUrl(connectionString, searchPath) {
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${searchPath}`);
  return url.toString();
}

async function fileExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureBuiltServer() {
  const distServerPath = resolve(process.cwd(), './dist/server.js');
  if (!(await fileExists(distServerPath))) {
    throw new Error('dist/server.js is missing. Run `cd backend && npm run build` before the recovery drill.');
  }
}

async function querySingleCount(client, schemaName, objectName) {
  const result = await client.query(`select count(*)::int as row_count from ${quoteIdent(schemaName)}.${quoteIdent(objectName)}`);
  return Number(result.rows[0]?.row_count ?? 0);
}

async function cloneObject(client, sourceSchema, targetSchema, objectName) {
  const startedAt = performance.now();
  await client.query(
    `create table ${quoteIdent(targetSchema)}.${quoteIdent(objectName)} as select * from ${quoteIdent(sourceSchema)}.${quoteIdent(objectName)}`,
  );
  const rowCount = await querySingleCount(client, targetSchema, objectName);

  return {
    object_name: objectName,
    source_schema: sourceSchema,
    target_schema: targetSchema,
    row_count: rowCount,
    duration_ms: Number((performance.now() - startedAt).toFixed(2)),
  };
}

async function createSchemaSnapshot(client, sourceSchema, targetSchema, objectNames) {
  const startedAt = performance.now();
  await client.query(`create schema ${quoteIdent(targetSchema)}`);

  const objects = [];
  for (const objectName of objectNames) {
    objects.push(await cloneObject(client, sourceSchema, targetSchema, objectName));
  }

  const totalRows = objects.reduce((sum, entry) => sum + entry.row_count, 0);

  return {
    schema_name: targetSchema,
    object_count: objects.length,
    total_rows: totalRows,
    duration_ms: Number((performance.now() - startedAt).toFixed(2)),
    objects,
  };
}

function waitForExit(child) {
  return new Promise((resolvePromise) => {
    child.once('exit', (code, signal) => {
      resolvePromise({ code, signal });
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs) {
  const startedAt = performance.now();
  let lastError = 'unknown startup error';

  while (performance.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1_500),
        headers: { accept: 'application/json' },
      });

      if (response.status === 200) {
        return;
      }

      lastError = `health returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  throw new Error(`Timed out waiting for backend health: ${lastError}`);
}

async function probeReady(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/ready`, {
      signal: AbortSignal.timeout(2_500),
      headers: { accept: 'application/json' },
    });
    const rawText = await response.text();

    let body = null;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = null;
    }

    return {
      status: response.status,
      ok: response.status === 200,
      body,
      body_preview: rawText.length <= 1_500 ? rawText : `${rawText.slice(0, 1_500)}...`,
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      ok: false,
      body: null,
      body_preview: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function spawnBackendServer({ connectionString, port }) {
  const child = spawn(process.execPath, ['./dist/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      APP_ENV: 'preview',
      PORT: String(port),
      APP_TIMEZONE: process.env.APP_TIMEZONE?.trim() || 'Asia/Seoul',
      DATABASE_URL: connectionString,
      DATABASE_URL_POOLED: '',
    },
  });

  const stdout = [];
  const stderr = [];

  child.stdout.on('data', (chunk) => {
    stdout.push(chunk.toString());
  });
  child.stderr.on('data', (chunk) => {
    stderr.push(chunk.toString());
  });

  return {
    child,
    stdout,
    stderr,
    async stop() {
      if (child.exitCode !== null) {
        return {
          exitCode: child.exitCode,
          signalCode: child.signalCode,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
        };
      }

      child.kill('SIGINT');
      const exit = await waitForExit(child);
      return {
        exitCode: exit.code,
        signalCode: exit.signal,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      };
    },
  };
}

async function runLiveSmoke({ baseUrl, target, smokeReportPath }) {
  const child = spawn(
    process.execPath,
    [
      './scripts/run-live-smoke-checks.mjs',
      '--target',
      target,
      '--base-url',
      baseUrl,
      '--report-path',
      smokeReportPath,
      '--allow-ready-statuses',
      'ready,degraded',
      '--skip-ready',
    ],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    },
  );

  const stdout = [];
  const stderr = [];

  child.stdout.on('data', (chunk) => {
    stdout.push(chunk.toString());
  });
  child.stderr.on('data', (chunk) => {
    stderr.push(chunk.toString());
  });

  const exit = await waitForExit(child);
  const rawReport = await readFile(smokeReportPath, 'utf8');

  return {
    exit_code: exit.code,
    signal: exit.signal,
    stdout: stdout.join('').trim(),
    stderr: stderr.join('').trim(),
    report: JSON.parse(rawReport),
  };
}

async function dropSchema(client, schemaName) {
  await client.query(`drop schema if exists ${quoteIdent(schemaName)} cascade`);
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureBuiltServer();

  const databaseUrl = requiredEnv('DATABASE_URL');
  const schemaSuffix = buildSchemaSuffix();
  const backupSchema = `recovery_backup_${schemaSuffix}`.slice(0, 63);
  const restoreSchema = `recovery_restore_${schemaSuffix}`.slice(0, 63);
  const smokeReportPath = resolve(process.cwd(), `./reports/.live_smoke_recovery_${schemaSuffix}.json`);
  const baseUrl = `http://127.0.0.1:${options.port}`;

  assertSchemaName(backupSchema);
  assertSchemaName(restoreSchema);

  const client = new Client({
    connectionString: databaseUrl,
    application_name: 'idol-song-app-backup-restore-drill',
    ssl: { rejectUnauthorized: false },
  });

  const report = {
    generated_at: new Date().toISOString(),
    strategy: 'isolated_in_cluster_schema_clone',
    prerequisites: [
      'DATABASE_URL direct Neon connection string',
      'backend build output at dist/server.js',
      'Read-only rehearsal against representative read endpoints',
    ],
    limitations: [
      'This drill uses isolated schemas inside the current Neon database because no separate preview database was configured in local env.',
      'It validates recovery of a usable read surface, not a full point-in-time restore across a separate Neon branch.',
      'The /ready probe is recorded as a diagnostic only; it can stay not_ready until projection/parity/shadow artifacts are regenerated for the restored schema.',
    ],
    backup_schema: backupSchema,
    restore_schema: restoreSchema,
    keep_schemas: options.keepSchemas,
    port: options.port,
    objects: {
      canonical_tables: CANONICAL_TABLES,
      projections: PROJECTION_OBJECTS,
    },
    backup_snapshot: null,
    restore_snapshot: null,
    diagnostic_ready: null,
    live_smoke: null,
    cleanup: null,
  };

  let serverHandle = null;

  await client.connect();

  try {
    await dropSchema(client, backupSchema);
    await dropSchema(client, restoreSchema);

    report.backup_snapshot = await createSchemaSnapshot(
      client,
      'public',
      backupSchema,
      [...CANONICAL_TABLES, ...PROJECTION_OBJECTS],
    );

    report.restore_snapshot = await createSchemaSnapshot(
      client,
      backupSchema,
      restoreSchema,
      [...CANONICAL_TABLES, ...PROJECTION_OBJECTS],
    );

    const restoreConnectionString = appendSearchPathToUrl(databaseUrl, `${restoreSchema},public`);
    serverHandle = spawnBackendServer({
      connectionString: restoreConnectionString,
      port: options.port,
    });

    await waitForHealth(baseUrl, options.timeoutMs);
    report.diagnostic_ready = await probeReady(baseUrl);
    const liveSmoke = await runLiveSmoke({
      baseUrl,
      target: 'restore-drill',
      smokeReportPath,
    });

    report.live_smoke = {
      ...liveSmoke,
      ok: liveSmoke.exit_code === 0 && liveSmoke.report?.summary?.ok === true,
    };

    if (liveSmoke.exit_code !== 0 || liveSmoke.report?.summary?.ok !== true) {
      throw new Error('Live smoke failed against restored schema');
    }
  } finally {
    const cleanupStartedAt = performance.now();

    if (serverHandle) {
      report.server_shutdown = await serverHandle.stop();
    }

    if (!options.keepSchemas) {
      await dropSchema(client, restoreSchema).catch((error) => {
        report.cleanup_error = `restore schema cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      });
      await dropSchema(client, backupSchema).catch((error) => {
        report.cleanup_error = `${report.cleanup_error ? `${report.cleanup_error}; ` : ''}backup schema cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
      });
    }

    report.cleanup = {
      dropped_backup_schema: !options.keepSchemas,
      dropped_restore_schema: !options.keepSchemas,
      duration_ms: Number((performance.now() - cleanupStartedAt).toFixed(2)),
      temp_smoke_report_removed: false,
    };

    await client.end();

    if (await fileExists(smokeReportPath)) {
      await rm(smokeReportPath, { force: true });
      report.cleanup.temp_smoke_report_removed = true;
    }

    await writeReport(options.reportPath, report);
  }

  console.log(
    JSON.stringify(
      {
        report_path: options.reportPath,
        backup_schema: backupSchema,
        restore_schema: restoreSchema,
        smoke_ok: report.live_smoke?.ok ?? false,
      },
      null,
      2,
    ),
  );
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
