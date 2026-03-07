export type DatabaseMode = 'pooled' | 'direct';

export type AppConfig = {
  port: number;
  appTimezone: string;
  databaseUrl: string;
  databaseMode: DatabaseMode;
};

function parsePort(raw: string | undefined): number {
  if (!raw) {
    return 3000;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT: ${raw}`);
  }

  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const pooledUrl = env.DATABASE_URL_POOLED?.trim();
  const directUrl = env.DATABASE_URL?.trim();
  const databaseUrl = pooledUrl || directUrl;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL_POOLED or DATABASE_URL is required');
  }

  return {
    port: parsePort(env.PORT),
    appTimezone: env.APP_TIMEZONE?.trim() || 'Asia/Seoul',
    databaseUrl,
    databaseMode: pooledUrl ? 'pooled' : 'direct',
  };
}
