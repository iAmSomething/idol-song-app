const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;

type RuntimeFailureLogger = {
  info(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
  fatal(payload: Record<string, unknown>, message: string): void;
};

export type RuntimeFailureApp = {
  close(): Promise<void>;
  log: RuntimeFailureLogger;
};

type RuntimeFailureEvent =
  | { kind: 'signal'; signal: NodeJS.Signals }
  | { kind: 'uncaughtException'; error: unknown }
  | { kind: 'unhandledRejection'; reason: unknown };

export type RegisterRuntimeFailureHandlersOptions = {
  app: RuntimeFailureApp;
  processObject?: NodeJS.Process;
  shutdownTimeoutMs?: number;
};

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

function buildFailurePayload(event: RuntimeFailureEvent, exitCode: number): Record<string, unknown> {
  switch (event.kind) {
    case 'signal':
      return {
        shutdown_reason: 'signal',
        signal: event.signal,
        exit_code: exitCode,
      };
    case 'uncaughtException':
      return isErrorLike(event.error)
        ? {
            failure_class: 'uncaughtException',
            err: event.error,
            exit_code: exitCode,
          }
        : {
            failure_class: 'uncaughtException',
            thrown_value: event.error,
            exit_code: exitCode,
          };
    case 'unhandledRejection':
      return isErrorLike(event.reason)
        ? {
            failure_class: 'unhandledRejection',
            err: event.reason,
            exit_code: exitCode,
          }
        : {
            failure_class: 'unhandledRejection',
            rejection_reason: event.reason,
            exit_code: exitCode,
          };
  }
}

function createStartMessage(event: RuntimeFailureEvent): string {
  return event.kind === 'signal'
    ? 'Starting graceful shutdown'
    : 'Starting graceful shutdown after runtime-fatal failure';
}

function createCompleteMessage(event: RuntimeFailureEvent): string {
  return event.kind === 'signal'
    ? 'Graceful shutdown finished'
    : 'Graceful shutdown finished after runtime-fatal failure';
}

function createFailureMessage(event: RuntimeFailureEvent): string {
  switch (event.kind) {
    case 'signal':
      return 'Graceful shutdown failed';
    case 'uncaughtException':
      return 'Runtime fatal exception detected';
    case 'unhandledRejection':
      return 'Runtime fatal rejection detected';
  }
}

export function registerRuntimeFailureHandlers({
  app,
  processObject = process,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
}: RegisterRuntimeFailureHandlersOptions): void {
  let shutdownPromise: Promise<never> | null = null;
  let forcedExitTimer: NodeJS.Timeout | null = null;

  const clearForcedExitTimer = () => {
    if (!forcedExitTimer) {
      return;
    }

    clearTimeout(forcedExitTimer);
    forcedExitTimer = null;
  };

  const exitProcess = (code: number): never => {
    clearForcedExitTimer();
    processObject.exit(code);
    throw new Error('Unreachable');
  };

  const startShutdown = (event: RuntimeFailureEvent): Promise<never> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    const exitCode = event.kind === 'signal' ? 0 : 1;

    shutdownPromise = (async () => {
      const payload = buildFailurePayload(event, exitCode);

      if (event.kind === 'signal') {
        app.log.info(payload, createStartMessage(event));
      } else {
        app.log.fatal(payload, createFailureMessage(event));
        app.log.info(payload, createStartMessage(event));
      }

      forcedExitTimer = setTimeout(() => {
        app.log.error(
          {
            ...payload,
            shutdown_timeout_ms: shutdownTimeoutMs,
          },
          'Graceful shutdown timed out; forcing process exit',
        );
        processObject.exit(1);
      }, shutdownTimeoutMs);

      try {
        await app.close();
        app.log.info(payload, createCompleteMessage(event));
        return exitProcess(exitCode);
      } catch (error) {
        app.log.error(
          {
            ...payload,
            err: isErrorLike(error) ? error : undefined,
            shutdown_error: isErrorLike(error) ? undefined : error,
          },
          'Graceful shutdown failed',
        );
        return exitProcess(1);
      }
    })();

    return shutdownPromise;
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    processObject.on(signal, () => {
      void startShutdown({ kind: 'signal', signal });
    });
  }

  processObject.on('uncaughtException', (error) => {
    void startShutdown({ kind: 'uncaughtException', error });
  });

  processObject.on('unhandledRejection', (reason) => {
    void startShutdown({ kind: 'unhandledRejection', reason });
  });
}
