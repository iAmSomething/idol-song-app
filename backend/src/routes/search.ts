import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { buildNotImplementedEnvelope } from '../lib/not-implemented.js';

export function registerSearchRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/search', async (_request, reply) => {
    return reply.code(501).send(buildNotImplementedEnvelope('/v1/search', config.appTimezone));
  });
}
