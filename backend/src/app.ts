import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig, type AppConfig } from './config.js';
import { ReadApiError, buildReadErrorEnvelope } from './lib/api.js';
import { closeDbPool, createDbPool, type DbPool } from './lib/db.js';
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

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const db = options.db ?? createDbPool(config);
  const app = Fastify({
    logger: true,
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
