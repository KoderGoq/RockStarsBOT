import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import { createDiscordClient } from './core/client.js';
import { CommandRegistry } from './core/commands/command-registry.js';
import { createLogger } from './core/logger.js';
import { registerInteractionCreateEvent } from './events/interaction-create.event.js';
import { registerReadyEvent } from './events/ready.event.js';
import { openDatabase } from './infrastructure/database/database.js';
import { createCommands, createModules } from './modules/index.js';
import type { Clock } from './shared/types/clock.js';
import { systemClock } from './shared/utils/clock.js';

export interface App {
  readonly logger: Logger;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface AppOptions {
  readonly clock?: Clock;
  /** Se invoca si un módulo no puede arrancar; el proceso debería terminar. */
  readonly onFatalError: (error: unknown) => void;
}

/** Raíz de composición: crea e interconecta todas las dependencias. */
export function createApp(env: Env, options: AppOptions): App {
  const clock = options.clock ?? systemClock;
  const logger = createLogger(env.LOG_LEVEL);
  const database = openDatabase(env.DATABASE_PATH);
  const client = createDiscordClient();

  const registry = new CommandRegistry(createCommands({ env, clock }), logger);
  const modules = createModules({ env, clock, client, database, logger });
  let stopped = false;

  async function startModules(): Promise<void> {
    try {
      for (const module of modules) {
        await module.start();
        logger.info({ module: module.name }, 'Módulo iniciado');
      }
    } catch (error: unknown) {
      options.onFatalError(error);
    }
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;

    for (const module of modules) {
      try {
        await module.stop();
      } catch (error: unknown) {
        logger.error({ err: error, module: module.name }, 'Error al detener el módulo');
      }
    }
    await client.destroy();
    database.close();
    logger.info('Bot detenido');
  }

  registerReadyEvent(client, { logger, onReady: startModules });
  registerInteractionCreateEvent(client, registry);

  return {
    logger,
    async start() {
      logger.info({ timezone: env.TIMEZONE, database: env.DATABASE_PATH }, 'Iniciando bot');
      await client.login(env.DISCORD_TOKEN);
    },
    stop,
  };
}
