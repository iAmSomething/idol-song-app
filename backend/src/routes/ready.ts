import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { pingDatabase, type DbQueryable } from '../lib/db.js';

type ReadyContext = {
  config: AppConfig;
  db: DbQueryable;
};

export function registerReadyRoute(app: FastifyInstance, context: ReadyContext): void {
  app.get('/ready', async () => {
    await pingDatabase(context.db);

    return {
      status: 'ready',
      service: 'idol-song-app-backend',
      database: {
        status: 'ready',
        mode: context.config.databaseMode,
      },
      timezone: context.config.appTimezone,
      now: new Date().toISOString(),
    };
  });
}
