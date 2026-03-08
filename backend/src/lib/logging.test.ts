import test from 'node:test';
import assert from 'node:assert/strict';

import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  buildBackendLoggerOptions,
  buildRequestSummaryPayload,
  resolveBackendLogLevel,
  resolveRequestSummaryLevel,
  shouldLogRequestSummary,
} from './logging.js';

function createRouteOptions(url: string): FastifyRequest['routeOptions'] {
  return {
    url,
  } as FastifyRequest['routeOptions'];
}

function createRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    id: 'request-123',
    method: 'GET',
    routeOptions: createRouteOptions('/v1/search'),
    url: '/v1/search?q=YENA',
    ...overrides,
  } as FastifyRequest;
}

function createReply(overrides: Partial<FastifyReply> = {}): FastifyReply {
  return {
    statusCode: 200,
    elapsedTime: 12.4,
    ...overrides,
  } as FastifyReply;
}

test('logger levels follow the environment policy', () => {
  assert.equal(resolveBackendLogLevel('development'), 'debug');
  assert.equal(resolveBackendLogLevel('preview'), 'info');
  assert.equal(resolveBackendLogLevel('production'), 'info');
});

test('logger options redact sensitive header paths and bind service metadata', () => {
  const loggerOptions = buildBackendLoggerOptions('preview');
  const redact = 'redact' in loggerOptions ? (loggerOptions.redact as { paths: string[] } | undefined) : undefined;

  assert.deepEqual(loggerOptions.base, {
    service: 'idol-song-app-backend',
    app_env: 'preview',
  });
  assert.equal(loggerOptions.level, 'info');
  assert.ok(redact && typeof redact === 'object');
  assert.deepEqual(redact.paths, [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers.set-cookie',
    'req.headers.x-forwarded-for',
    'headers.authorization',
    'headers.cookie',
    'headers.set-cookie',
    'headers.x-forwarded-for',
  ]);
});

test('request summary policy skips service probes and keeps public read routes', () => {
  const healthRequest = createRequest({
    routeOptions: createRouteOptions('/health'),
    url: '/health',
  });
  const readyRequest = createRequest({
    routeOptions: createRouteOptions('/ready'),
    url: '/ready',
  });
  const searchRequest = createRequest();
  const optionsRequest = createRequest({
    method: 'OPTIONS',
  });

  assert.equal(shouldLogRequestSummary(healthRequest), false);
  assert.equal(shouldLogRequestSummary(readyRequest), false);
  assert.equal(shouldLogRequestSummary(searchRequest), true);
  assert.equal(shouldLogRequestSummary(optionsRequest), false);

  const searchPayload = buildRequestSummaryPayload(searchRequest, createReply({ statusCode: 404, elapsedTime: 18.9 }));
  assert.equal(searchPayload.route, '/v1/search');
  assert.equal(searchPayload.method, 'GET');
  assert.equal(searchPayload.status_code, 404);
  assert.equal(typeof searchPayload.duration_ms, 'number');
});

test('request summary log levels map to status classes', () => {
  assert.equal(resolveRequestSummaryLevel(200), 'info');
  assert.equal(resolveRequestSummaryLevel(403), 'warn');
  assert.equal(resolveRequestSummaryLevel(429), 'warn');
  assert.equal(resolveRequestSummaryLevel(500), 'error');
});
