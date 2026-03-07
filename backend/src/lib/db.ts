import pg from 'pg';

import type { AppConfig } from '../config.js';

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbQueryable = Pick<pg.Pool, 'query'>;

export function createDbPool(config: AppConfig): DbPool {
  return new Pool({
    connectionString: config.databaseUrl,
    application_name: 'idol-song-app-fastify',
    max: 5,
    idleTimeoutMillis: 10_000,
  });
}

export async function pingDatabase(pool: DbQueryable): Promise<void> {
  await pool.query('select 1');
}
