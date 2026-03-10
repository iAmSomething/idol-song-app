import { MOBILE_STORAGE_KEYS, readStoredJson, removeStoredJson, writeStoredJson } from './storage';

export type RouteResumePathname =
  | '/(tabs)/calendar'
  | '/(tabs)/search'
  | '/(tabs)/radar'
  | '/artists/[slug]'
  | '/releases/[id]';

export type RouteResumeTarget = {
  pathname: RouteResumePathname;
  params?: Record<string, string | undefined>;
};

type StoredRouteResumeEntry = {
  target: RouteResumeTarget;
  createdAt: string;
  reason: 'external_handoff';
};

const ALLOWED_PATHNAMES = new Set<RouteResumePathname>([
  '/(tabs)/calendar',
  '/(tabs)/search',
  '/(tabs)/radar',
  '/artists/[slug]',
  '/releases/[id]',
]);

const DEFAULT_PENDING_ROUTE_MAX_AGE_MS = 5 * 60 * 1000;

function sanitizeParams(
  params?: Record<string, string | undefined>,
): Record<string, string> | undefined {
  if (!params) {
    return undefined;
  }

  const normalizedEntries = Object.entries(params)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => [key, value!.trim()] as const);

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

function sanitizeTarget(target: RouteResumeTarget): RouteResumeTarget | null {
  if (!ALLOWED_PATHNAMES.has(target.pathname)) {
    return null;
  }

  return {
    pathname: target.pathname,
    params: sanitizeParams(target.params),
  };
}

export async function writePendingRouteResume(
  target: RouteResumeTarget,
  options: { createdAt?: string } = {},
): Promise<StoredRouteResumeEntry> {
  const sanitizedTarget = sanitizeTarget(target);
  if (!sanitizedTarget) {
    throw new Error('Unsupported route resume target.');
  }

  const entry: StoredRouteResumeEntry = {
    target: sanitizedTarget,
    createdAt: options.createdAt ?? new Date().toISOString(),
    reason: 'external_handoff',
  };

  await writeStoredJson(MOBILE_STORAGE_KEYS.pendingRouteResume, entry);
  return entry;
}

export async function readPendingRouteResume(): Promise<StoredRouteResumeEntry | null> {
  const entry = await readStoredJson<StoredRouteResumeEntry>(MOBILE_STORAGE_KEYS.pendingRouteResume);
  if (!entry) {
    return null;
  }

  const sanitizedTarget = sanitizeTarget(entry.target);
  if (!sanitizedTarget || entry.reason !== 'external_handoff' || !entry.createdAt) {
    await clearPendingRouteResume();
    return null;
  }

  return {
    ...entry,
    target: sanitizedTarget,
  };
}

export async function clearPendingRouteResume(): Promise<void> {
  await removeStoredJson(MOBILE_STORAGE_KEYS.pendingRouteResume);
}

export async function consumePendingRouteResume(
  options: { maxAgeMs?: number; now?: Date } = {},
): Promise<RouteResumeTarget | null> {
  const entry = await readPendingRouteResume();
  await clearPendingRouteResume();

  if (!entry) {
    return null;
  }

  const now = options.now ?? new Date();
  const createdAtMs = Date.parse(entry.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  if (now.getTime() - createdAtMs > (options.maxAgeMs ?? DEFAULT_PENDING_ROUTE_MAX_AGE_MS)) {
    return null;
  }

  return entry.target;
}

export async function runWithPendingRouteResume<T extends { ok: boolean }>(
  target: RouteResumeTarget,
  action: () => Promise<T>,
): Promise<T> {
  await writePendingRouteResume(target);

  try {
    const result = await action();
    if (!result.ok) {
      await clearPendingRouteResume();
    }

    return result;
  } catch (error) {
    await clearPendingRouteResume();
    throw error;
  }
}
