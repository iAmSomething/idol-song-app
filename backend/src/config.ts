export type DatabaseMode = 'pooled' | 'direct';
export type AppEnv = 'development' | 'preview' | 'production';

export type AppConfig = {
  appEnv: AppEnv;
  port: number;
  appTimezone: string;
  databaseUrl: string;
  databaseMode: DatabaseMode;
  allowedWebOrigins: string[];
};

const PRODUCTION_WEB_ORIGIN = 'https://iamsomething.github.io';
const DEVELOPMENT_WEB_ORIGINS = [
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

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

function parseAppEnv(raw: string | undefined): AppEnv {
  if (!raw) {
    return 'development';
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === 'development' || normalized === 'preview' || normalized === 'production') {
    return normalized;
  }

  throw new Error(`Invalid APP_ENV: ${raw}`);
}

function normalizeWebOrigin(raw: string, source: string): string {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`Invalid ${source}: ${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid ${source}: ${raw}`);
  }

  return url.origin;
}

function parseAllowedWebOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => normalizeWebOrigin(value, 'WEB_ALLOWED_ORIGINS'));
}

function buildDefaultAllowedWebOrigins(appEnv: AppEnv): string[] {
  if (appEnv === 'development') {
    return [PRODUCTION_WEB_ORIGIN, ...DEVELOPMENT_WEB_ORIGINS];
  }

  return [PRODUCTION_WEB_ORIGIN];
}

function dedupeOrigins(origins: string[]): string[] {
  return [...new Set(origins)];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appEnv = parseAppEnv(env.APP_ENV);
  const pooledUrl = env.DATABASE_URL_POOLED?.trim();
  const directUrl = env.DATABASE_URL?.trim();
  const databaseUrl = pooledUrl || directUrl;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL_POOLED or DATABASE_URL is required');
  }

  return {
    appEnv,
    port: parsePort(env.PORT),
    appTimezone: env.APP_TIMEZONE?.trim() || 'Asia/Seoul',
    databaseUrl,
    databaseMode: pooledUrl ? 'pooled' : 'direct',
    allowedWebOrigins: dedupeOrigins([
      ...buildDefaultAllowedWebOrigins(appEnv),
      ...parseAllowedWebOrigins(env.WEB_ALLOWED_ORIGINS),
    ]),
  };
}
