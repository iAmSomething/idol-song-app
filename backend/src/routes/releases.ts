import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { buildNotImplementedEnvelope } from '../lib/not-implemented.js';

export function registerReleaseRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/releases/lookup', async (_request, reply) => {
    return reply.code(501).send(buildNotImplementedEnvelope('/v1/releases/lookup', config.appTimezone));
  });

  app.get('/v1/releases/:id', async (_request, reply) => {
    return reply.code(501).send(buildNotImplementedEnvelope('/v1/releases/:id', config.appTimezone));
  });
}
