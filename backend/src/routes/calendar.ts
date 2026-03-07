import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { buildNotImplementedEnvelope } from '../lib/not-implemented.js';

export function registerCalendarRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/calendar/month', async (request, reply) => {
    const { month } = request.query as { month?: string };

    if (!month) {
      return reply.code(400).send({
        meta: {
          route: '/v1/calendar/month',
          generated_at: new Date().toISOString(),
          timezone: config.appTimezone,
        },
        error: {
          code: 'invalid_request',
          message: 'month query parameter is required (YYYY-MM).',
        },
      });
    }

    return reply.code(501).send(buildNotImplementedEnvelope('/v1/calendar/month', config.appTimezone));
  });
}
