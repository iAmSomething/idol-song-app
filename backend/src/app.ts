import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';

import { loadConfig, type AppConfig } from './config.js';
import { ReadApiError, buildReadErrorEnvelope } from './lib/api.js';
import { closeDbPool, createDbPool, type DbPool, withFailFastReadTimeouts } from './lib/db.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerEntityRoutes } from './routes/entities.js';
import { registerHealthRoute } from './routes/health.js';
import { registerRadarRoutes } from './routes/radar.js';
import { registerReadyRoute } from './routes/ready.js';
import { registerReviewRoutes } from './routes/review.js';
import { registerReleaseRoutes } from './routes/releases.js';
import { registerSearchRoutes } from './routes/search.js';

export type BuildAppOptions = {
  config?: AppConfig;
  db?: DbPool;
};

const ACCESS_CONTROL_ALLOW_METHODS = 'GET,OPTIONS';
const DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS = 'Content-Type';

function appendVaryHeader(reply: FastifyReply, value: string): void {
  const current = reply.getHeader('Vary');

  if (typeof current !== 'string' || current.length === 0) {
    reply.header('Vary', value);
    return;
  }

  const tokens = current
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (!tokens.includes(value)) {
    reply.header('Vary', [...tokens, value].join(', '));
  }
}

function getRequestOrigin(request: { headers: Record<string, unknown> }): string | null {
  const raw = request.headers.origin;

  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function getRequestedAccessControlHeaders(request: { headers: Record<string, unknown> }): string {
  const raw = request.headers['access-control-request-headers'];

  if (Array.isArray(raw)) {
    return raw.join(', ');
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS;
}

function applyCorsHeaders(reply: FastifyReply, origin: string, requestedHeaders: string): void {
  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Methods', ACCESS_CONTROL_ALLOW_METHODS);
  reply.header('Access-Control-Allow-Headers', requestedHeaders);
  reply.header('Access-Control-Max-Age', '600');
  appendVaryHeader(reply, 'Origin');
  appendVaryHeader(reply, 'Access-Control-Request-Headers');
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const db = withFailFastReadTimeouts(options.db ?? createDbPool(config));
  const app = Fastify({
    logger: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    const origin = getRequestOrigin(request);

    if (!origin) {
      return;
    }

    appendVaryHeader(reply, 'Origin');

    if (!config.allowedWebOrigins.includes(origin)) {
      return reply
        .code(403)
        .send(
          buildReadErrorEnvelope(request, config.appTimezone, 'disallowed_origin', 'Origin is not allowed.', {
            app_env: config.appEnv,
            origin,
          }),
        );
    }

    applyCorsHeaders(reply, origin, getRequestedAccessControlHeaders(request));

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ReadApiError) {
      return reply
        .code(error.statusCode)
        .send(buildReadErrorEnvelope(request, config.appTimezone, error.code, error.message, error.meta));
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply
      .code(500)
      .send(buildReadErrorEnvelope(request, config.appTimezone, 'internal_error', 'Unexpected server error.'));
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/v1/')) {
      return reply
        .code(404)
        .send(buildReadErrorEnvelope(request, config.appTimezone, 'not_found', 'Route not found.'));
    }

    return reply.code(404).send({
      error: 'Not Found',
    });
  });

  app.addHook('onClose', async () => {
    await closeDbPool(db);
  });

  registerHealthRoute(app);
  registerReadyRoute(app, { config, db });
  registerCalendarRoutes(app, { config, db });
  registerSearchRoutes(app, { config, db });
  registerEntityRoutes(app, { config, db });
  registerReleaseRoutes(app, { config, db });
  registerRadarRoutes(app, { config, db });
  registerReviewRoutes(app, { config, db });

  return app;
}
