import pg from 'pg';

import type { AppConfig } from '../config.js';
import { routeError } from './api.js';

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbQueryable = Pick<pg.Pool, 'query'>;

const DB_TIMEOUT_CODE = '57014';
const DB_TIMEOUT_WRAPPED = Symbol('db-timeout-wrapped');

type TimeoutWrappedDbPool = DbPool & {
  [DB_TIMEOUT_WRAPPED]?: true;
};

function isErrorWithMessageAndCode(error: unknown): error is { code?: unknown; message?: unknown } {
  return typeof error === 'object' && error !== null;
}

function isDbTimeoutError(error: unknown): boolean {
  if (!isErrorWithMessageAndCode(error)) {
    return false;
  }

  if (error.code === DB_TIMEOUT_CODE) {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('timeout') || message.includes('timed out');
}

export function withFailFastReadTimeouts(pool: DbPool): DbPool {
  const timeoutWrappedPool = pool as TimeoutWrappedDbPool;
  if (timeoutWrappedPool[DB_TIMEOUT_WRAPPED] === true) {
    return pool;
  }

  const query = pool.query.bind(pool);

  pool.query = (async (...args: Parameters<DbPool['query']>) => {
    try {
      return await query(...args);
    } catch (error) {
      if (isDbTimeoutError(error)) {
        throw routeError(504, 'timeout', 'Database read timed out.', {
          database_mode: 'pooled_read',
        });
      }

      throw error;
    }
  }) as DbPool['query'];

  timeoutWrappedPool[DB_TIMEOUT_WRAPPED] = true;
  return pool;
}

export function createDbPool(config: AppConfig): DbPool {
  return withFailFastReadTimeouts(new Pool({
    connectionString: config.databaseUrl,
    application_name: 'idol-song-app-fastify',
    max: 5,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: 10_000,
    query_timeout: config.databaseReadTimeoutMs,
    statement_timeout: config.databaseReadTimeoutMs,
    lock_timeout: config.databaseReadTimeoutMs,
    idle_in_transaction_session_timeout: config.databaseReadTimeoutMs,
  }));
}

export async function closeDbPool(pool: DbPool): Promise<void> {
  await pool.end();
}

export async function pingDatabase(pool: DbQueryable): Promise<void> {
  await pool.query('select 1');
}
