import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'idol-song-app-backend',
      now: new Date().toISOString(),
    };
  });
}
