import pg from 'pg';

import type { AppConfig } from '../config.js';

const { Pool } = pg;

export function createDbPool(config: AppConfig): pg.Pool {
  return new Pool({
    connectionString: config.databaseUrl,
    application_name: 'idol-song-app-fastify',
    max: 5,
    idleTimeoutMillis: 10_000,
  });
}

export async function pingDatabase(pool: pg.Pool): Promise<void> {
  await pool.query('select 1');
}
