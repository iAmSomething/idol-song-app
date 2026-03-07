import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const migrationArg = process.argv[2];

  if (!migrationArg) {
    throw new Error('usage: node ./scripts/apply-migration.mjs ./sql/migrations/0001_canonical_schema.sql');
  }

  const migrationPath = resolve(process.cwd(), migrationArg);
  const version = basename(migrationPath);
  const sql = await readFile(migrationPath, 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const connectionString = requiredEnv('DATABASE_URL');

  const client = new Client({
    connectionString,
    application_name: 'idol-song-app-backend-migrate',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const existing = await client.query(
      'select checksum from schema_migrations where version = $1',
      [version]
    );

    if (existing.rowCount === 1) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`migration ${version} already applied with a different checksum`);
      }

      console.log(`skip: ${version} already applied`);
      return;
    }

    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into schema_migrations (version, checksum) values ($1, $2)',
      [version, checksum]
    );
    await client.query('commit');

    console.log(`applied: ${version}`);
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // noop
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
