import { type App, createApp } from './app.js';
import { loadEnv } from './config/env.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

async function main(): Promise<void> {
  const env = loadEnv();
  const app = createApp(env, {
    onFatalError: (error) => {
      app.logger.fatal({ err: error }, 'Error crítico al iniciar los módulos');
      void shutdown(app, 1);
    },
  });

  registerProcessHandlers(app);
  await app.start();
}

function registerProcessHandlers(app: App): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      app.logger.info({ signal }, 'Señal de apagado recibida');
      void shutdown(app, 0);
    });
  }

  process.on('unhandledRejection', (reason) => {
    app.logger.error({ err: reason }, 'Promesa rechazada sin manejar');
  });

  process.once('uncaughtException', (error) => {
    app.logger.fatal({ err: error }, 'Excepción no capturada');
    void shutdown(app, 1);
  });
}

async function shutdown(app: App, exitCode: number): Promise<void> {
  try {
    await app.stop();
  } finally {
    process.exit(exitCode);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error al iniciar Boutcraft KOTH Bot:\n${message}\n`);
  process.exit(1);
});
