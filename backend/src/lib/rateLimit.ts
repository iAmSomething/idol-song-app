import type { FastifyReply, FastifyRequest } from 'fastify';

import type { RateLimitBucketName, RateLimitPolicy } from '../config.js';

const RATE_LIMIT_PRUNE_INTERVAL = 200;

type RateLimitStoreEntry = {
  count: number;
  resetAtMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  bucketName: RateLimitBucketName;
  limit: number;
  remaining: number;
  resetAt: string;
  resetInSeconds: number;
  retryAfterSeconds: number;
  windowSeconds: number;
  identifierKind: 'ip';
};

function parsePathname(rawUrl: string): string {
  try {
    return new URL(rawUrl, 'http://backend.local').pathname;
  } catch {
    return rawUrl.split('?')[0] || rawUrl;
  }
}

function getHeaderValue(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) {
    const first = raw.find((value) => value.trim().length > 0);
    return first ? first.trim() : null;
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return null;
}

function getForwardedIp(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const first = raw
    .split(',')
    .map((token) => token.trim())
    .find((token) => token.length > 0);

  return first || null;
}

function normalizeIdentifier(value: string | null | undefined): string {
  if (!value) {
    return 'unknown';
  }

  return value.trim().toLowerCase() || 'unknown';
}

export function resolveReadRateLimitBucket(rawUrl: string): RateLimitBucketName | null {
  const pathname = parsePathname(rawUrl);

  if (pathname === '/v1/search') {
    return 'search';
  }

  if (pathname === '/v1/calendar/month') {
    return 'calendarMonth';
  }

  if (pathname === '/v1/radar') {
    return 'radar';
  }

  if (pathname === '/v1/releases/lookup' || pathname.startsWith('/v1/releases/')) {
    return 'releaseDetail';
  }

  if (pathname.startsWith('/v1/entities/')) {
    return 'entityDetail';
  }

  return null;
}

export function resolveRateLimitIdentifier(request: FastifyRequest): { identifier: string; identifierKind: 'ip' } {
  const cfConnectingIp = getHeaderValue(request.headers['cf-connecting-ip']);
  const forwardedFor = getForwardedIp(getHeaderValue(request.headers['x-forwarded-for']));
  const realIp = getHeaderValue(request.headers['x-real-ip']);
  const identifier = normalizeIdentifier(cfConnectingIp || forwardedFor || realIp || request.ip);

  return {
    identifier,
    identifierKind: 'ip',
  };
}

export function applyRateLimitHeaders(reply: FastifyReply, decision: RateLimitDecision): void {
  reply.header('RateLimit-Limit', String(decision.limit));
  reply.header('RateLimit-Remaining', String(decision.remaining));
  reply.header('RateLimit-Reset', String(decision.resetInSeconds));
  reply.header('X-RateLimit-Bucket', decision.bucketName);

  if (!decision.allowed) {
    reply.header('Retry-After', String(decision.retryAfterSeconds));
  }
}

export function buildRateLimitMeta(decision: RateLimitDecision): Record<string, unknown> {
  return {
    rate_limit_bucket: decision.bucketName,
    rate_limit_limit: decision.limit,
    rate_limit_remaining: decision.remaining,
    rate_limit_reset_at: decision.resetAt,
    rate_limit_retry_after_seconds: decision.retryAfterSeconds,
    rate_limit_window_seconds: decision.windowSeconds,
    rate_limit_identifier_kind: decision.identifierKind,
  };
}

export class InMemoryFixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitStoreEntry>();
  private operationCount = 0;

  consume(bucketName: RateLimitBucketName, identifier: string, policy: RateLimitPolicy, now = Date.now()): RateLimitDecision {
    this.prune(now);

    const key = `${bucketName}:${identifier}`;
    const existing = this.entries.get(key);
    const resetAtMs = !existing || now >= existing.resetAtMs ? now + policy.windowMs : existing.resetAtMs;
    const count = !existing || now >= existing.resetAtMs ? 1 : existing.count + 1;

    this.entries.set(key, {
      count,
      resetAtMs,
    });

    const allowed = count <= policy.max;
    const remaining = Math.max(0, policy.max - count);
    const resetInSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));

    return {
      allowed,
      bucketName,
      limit: policy.max,
      remaining,
      resetAt: new Date(resetAtMs).toISOString(),
      resetInSeconds,
      retryAfterSeconds: resetInSeconds,
      windowSeconds: Math.ceil(policy.windowMs / 1000),
      identifierKind: 'ip',
    };
  }

  private prune(now: number): void {
    this.operationCount += 1;

    if (this.operationCount % RATE_LIMIT_PRUNE_INTERVAL !== 0) {
      return;
    }

    for (const [key, value] of this.entries.entries()) {
      if (value.resetAtMs <= now) {
        this.entries.delete(key);
      }
    }
  }
}
