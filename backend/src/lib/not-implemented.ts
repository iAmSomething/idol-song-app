import type { FastifyRequest } from 'fastify';

import { buildReadErrorEnvelope } from './api.js';

export function buildNotImplementedEnvelope(request: FastifyRequest, timezone: string) {
  return buildReadErrorEnvelope(
    request,
    timezone,
    'not_implemented',
    'Route shell is registered but not implemented yet.',
  );
}
