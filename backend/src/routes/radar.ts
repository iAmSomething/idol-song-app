import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { buildNotImplementedEnvelope } from '../lib/not-implemented.js';

export function registerRadarRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/radar', async (_request, reply) => {
    return reply.code(501).send(buildNotImplementedEnvelope('/v1/radar', config.appTimezone));
  });
}
