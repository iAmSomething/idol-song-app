import type { FastifyInstance } from 'fastify';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function registerShutdownHandlers(app: FastifyInstance): void {
  let shutdownPromise: Promise<never> | null = null;

  const startShutdown = (signal: NodeJS.Signals): Promise<never> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      app.log.info({ signal }, 'Starting graceful shutdown');

      try {
        await app.close();
        app.log.info({ signal }, 'Graceful shutdown finished');
        process.exit(0);
      } catch (error) {
        app.log.error({ err: error, signal }, 'Graceful shutdown failed');
        process.exit(1);
      }

      throw new Error('Unreachable');
    })();

    return shutdownPromise;
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => {
      void startShutdown(signal);
    });
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp({ config });
  registerShutdownHandlers(app);

  try {
    await app.listen({
      host: '0.0.0.0',
      port: config.port,
    });
  } catch (error) {
    app.log.error(error);
    await app.close().catch(() => undefined);
    process.exit(1);
  }
}

void main();
