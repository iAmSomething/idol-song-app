import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig, type AppConfig } from './config.js';
import { createDbPool, type DbPool } from './lib/db.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerEntityRoutes } from './routes/entities.js';
import { registerHealthRoute } from './routes/health.js';
import { registerRadarRoutes } from './routes/radar.js';
import { registerReadyRoute } from './routes/ready.js';
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

  app.addHook('onClose', async () => {
    await db.end();
  });

  registerHealthRoute(app);
  registerReadyRoute(app, { config, db });
  registerCalendarRoutes(app, config);
  registerSearchRoutes(app, config);
  registerEntityRoutes(app, config);
  registerReleaseRoutes(app, config);
  registerRadarRoutes(app, { config, db });

  return app;
}
