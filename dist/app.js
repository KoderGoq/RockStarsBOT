import { createDiscordClient } from './core/client.js';
import { CommandRegistry } from './core/commands/command-registry.js';
import { loadApplicationIcons } from './core/icons/load-application-icons.js';
import { createLogger } from './core/logger.js';
import { registerInteractionCreateEvent } from './events/interaction-create.event.js';
import { registerReadyEvent } from './events/ready.event.js';
import { openDatabase } from './infrastructure/database/database.js';
import { createCommands, createModules } from './modules/index.js';
import { IconRegistry } from './shared/icons/icon-registry.js';
import { systemClock } from './shared/utils/clock.js';
/** Raíz de composición: crea e interconecta todas las dependencias. */
export function createApp(env, options) {
    const clock = options.clock ?? systemClock;
    const logger = createLogger(env.LOG_LEVEL);
    const database = openDatabase(env.DATABASE_PATH);
    const client = createDiscordClient();
    const icons = new IconRegistry();
    const registry = new CommandRegistry(createCommands({ env, clock, icons }), icons, logger);
    const modules = createModules({ env, clock, icons, client, database, logger });
    let stopped = false;
    async function startModules() {
        try {
            if (client.isReady()) {
                await loadApplicationIcons(client, icons, logger);
            }
            for (const module of modules) {
                await module.start();
                logger.info({ module: module.name }, 'Módulo iniciado');
            }
        }
        catch (error) {
            options.onFatalError(error);
        }
    }
    async function stop() {
        if (stopped)
            return;
        stopped = true;
        for (const module of modules) {
            try {
                await module.stop();
            }
            catch (error) {
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
//# sourceMappingURL=app.js.map