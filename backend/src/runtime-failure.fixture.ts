import { registerRuntimeFailureHandlers, type RuntimeFailureApp } from './runtime-failures.js';

type FailureMode = 'uncaughtException' | 'unhandledRejection' | 'hangingRejection';

function writeLog(level: 'info' | 'error' | 'fatal', payload: Record<string, unknown>, message: string) {
  console.log(
    JSON.stringify({
      level,
      message,
      ...payload,
    }),
  );
}

function createFixtureApp(mode: FailureMode): RuntimeFailureApp {
  return {
    log: {
      info(payload, message) {
        writeLog('info', payload, message);
      },
      error(payload, message) {
        writeLog('error', payload, message);
      },
      fatal(payload, message) {
        writeLog('fatal', payload, message);
      },
    },
    async close() {
      writeLog('info', { fixture_close_started: true }, 'Fixture close started');

      if (mode === 'hangingRejection') {
        await new Promise(() => undefined);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      writeLog('info', { fixture_close_finished: true }, 'Fixture close finished');
    },
  };
}

async function main() {
  const mode = process.argv[2] as FailureMode | undefined;
  if (!mode) {
    throw new Error('Missing runtime failure fixture mode');
  }

  registerRuntimeFailureHandlers({
    app: createFixtureApp(mode),
    shutdownTimeoutMs: 50,
  });

  if (mode === 'uncaughtException') {
    setTimeout(() => {
      throw new Error('fixture uncaught exception');
    }, 0);
    return;
  }

  setTimeout(() => {
    Promise.reject(new Error(mode === 'hangingRejection' ? 'fixture hanging rejection' : 'fixture unhandled rejection'));
  }, 0);
}

void main();
