import type { FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';

import type { AppEnv } from '../config.js';
import type { ReadyStatusSnapshot } from './readiness.js';

const BACKEND_SERVICE_NAME = 'idol-song-app-backend';
const REDACTION_CENSOR = '[Redacted]';

export type BackendLogLevel = 'debug' | 'info';
export type RequestSummaryLevel = 'info' | 'warn' | 'error';

type FastifyLoggerOptions = Exclude<FastifyServerOptions['logger'], boolean | undefined>;

type DependencyStateSummary = Record<string, ReadyStatusSnapshot['dependencies'][keyof ReadyStatusSnapshot['dependencies']]['status']>;

function trimQueryFromUrl(url: string): string {
  const [path] = url.split('?');
  return path || url;
}

function getRoutePattern(request: FastifyRequest): string {
  const routePattern = request.routeOptions.url;

  if (typeof routePattern === 'string' && routePattern.length > 0) {
    return routePattern;
  }

  return trimQueryFromUrl(request.url);
}

export function resolveBackendLogLevel(appEnv: AppEnv): BackendLogLevel {
  return appEnv === 'development' ? 'debug' : 'info';
}

export function buildBackendLoggerOptions(appEnv: AppEnv): FastifyLoggerOptions {
  return {
    level: resolveBackendLogLevel(appEnv),
    base: {
      service: BACKEND_SERVICE_NAME,
      app_env: appEnv,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.set-cookie',
        'req.headers.x-forwarded-for',
        'headers.authorization',
        'headers.cookie',
        'headers.set-cookie',
        'headers.x-forwarded-for',
      ],
      censor: REDACTION_CENSOR,
      remove: false,
    },
  };
}

export function shouldLogRequestSummary(request: FastifyRequest): boolean {
  if (request.method === 'OPTIONS') {
    return false;
  }

  const path = trimQueryFromUrl(request.url);

  if (path === '/health' || path === '/ready') {
    return false;
  }

  if (!path.startsWith('/v1/')) {
    return false;
  }

  return true;
}

export function resolveRequestSummaryLevel(statusCode: number): RequestSummaryLevel {
  if (statusCode >= 500) {
    return 'error';
  }

  if (statusCode >= 400) {
    return 'warn';
  }

  return 'info';
}

export function buildRequestSummaryPayload(request: FastifyRequest, reply: FastifyReply): Record<string, unknown> {
  return {
    method: request.method,
    route: getRoutePattern(request),
    status_code: reply.statusCode,
    duration_ms: Number(reply.elapsedTime.toFixed(1)),
  };
}

function collectDependencyStates(snapshot: ReadyStatusSnapshot): DependencyStateSummary {
  return {
    parity_report: snapshot.dependencies.parity_report.status,
    shadow_report: snapshot.dependencies.shadow_report.status,
    runtime_gate_report: snapshot.dependencies.runtime_gate_report.status,
  };
}

export function buildReadyStatusLogPayload(
  request: FastifyRequest,
  snapshot: ReadyStatusSnapshot,
): Record<string, unknown> {
  return {
    route: '/ready',
    ready_status: snapshot.status,
    readiness_reasons: snapshot.reasons,
    projection_status: snapshot.projections.status,
    projection_lag_minutes: snapshot.projections.lag_minutes,
    dependency_states: collectDependencyStates(snapshot),
  };
}
