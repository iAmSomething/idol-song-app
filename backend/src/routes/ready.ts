import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { pingDatabase, type DbQueryable } from '../lib/db.js';
import type { ReadyStatusProvider } from '../lib/readiness.js';

type ReadyContext = {
  config: AppConfig;
  db: DbQueryable;
  readyStatusProvider: ReadyStatusProvider;
};

export function registerReadyRoute(app: FastifyInstance, context: ReadyContext): void {
  app.get('/ready', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');

    const readiness = await context.readyStatusProvider();
    const reasons = [...readiness.reasons];
    let status = readiness.status;
    let databaseStatus: 'ready' | 'not_ready' = 'ready';

    try {
      await pingDatabase(context.db);
    } catch {
      databaseStatus = 'not_ready';
      status = 'not_ready';
      reasons.unshift('database_unreachable');
    }

    const response = {
      status,
      service: 'idol-song-app-backend',
      database: {
        status: databaseStatus,
        mode: context.config.databaseMode,
      },
      projections: readiness.projections,
      dependencies: readiness.dependencies,
      reasons,
      timezone: context.config.appTimezone,
      now: new Date().toISOString(),
    };

    if (status === 'not_ready') {
      return reply.code(503).send(response);
    }

    return reply.code(200).send(response);
  });
}
