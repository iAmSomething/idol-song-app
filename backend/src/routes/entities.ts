import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { buildNotImplementedEnvelope } from '../lib/not-implemented.js';

export function registerEntityRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/entities/:slug', async (_request, reply) => {
    return reply.code(501).send(buildNotImplementedEnvelope('/v1/entities/:slug', config.appTimezone));
  });
}
