import type { FastifyRequest } from 'fastify';

export type ReadApiErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'stale_projection'
  | 'internal_error'
  | 'not_implemented';

export class ReadApiError extends Error {
  readonly statusCode: number;
  readonly code: ReadApiErrorCode;
  readonly meta: Record<string, unknown>;

  constructor(statusCode: number, code: ReadApiErrorCode, message: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ReadApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.meta = meta;
  }
}

export function routeError(
  statusCode: number,
  code: ReadApiErrorCode,
  message: string,
  meta: Record<string, unknown> = {},
): ReadApiError {
  return new ReadApiError(statusCode, code, message, meta);
}

function buildGeneratedAt(value?: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function getRoutePath(request: FastifyRequest): string {
  return request.routeOptions.url || request.url;
}

export function buildReadDataEnvelope<T>(
  request: FastifyRequest,
  timezone: string,
  data: T,
  meta: Record<string, unknown> = {},
  generatedAt?: Date | string,
) {
  return {
    meta: {
      request_id: request.id,
      generated_at: buildGeneratedAt(generatedAt),
      timezone,
      route: getRoutePath(request),
      source: 'backend',
      ...meta,
    },
    data,
  };
}

export function buildReadErrorEnvelope(
  request: FastifyRequest,
  timezone: string,
  code: ReadApiErrorCode,
  message: string,
  meta: Record<string, unknown> = {},
) {
  return {
    meta: {
      generated_at: buildGeneratedAt(),
      timezone,
      request_id: request.id,
      route: getRoutePath(request),
      ...meta,
    },
    error: {
      code,
      message,
    },
  };
}
