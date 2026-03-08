import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { registerRuntimeFailureHandlers } from './runtime-failures.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp({ config });
  registerRuntimeFailureHandlers({ app });

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
