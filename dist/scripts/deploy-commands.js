import { REST, Routes } from 'discord.js';
import { loadEnv } from '../config/env.js';
import { createDiscordClient } from '../core/client.js';
import { createLogger } from '../core/logger.js';
import { IN_MEMORY_DATABASE, openDatabase } from '../infrastructure/database/database.js';
import { createModules } from '../modules/index.js';
import { IconRegistry } from '../shared/icons/icon-registry.js';
import { systemClock } from '../shared/utils/clock.js';
/**
 * Registra (o actualiza) los comandos slash en el servidor configurado.
 * Los comandos de servidor (guild) se aplican al instante.
 */
async function deployCommands() {
    const env = loadEnv();
    const logger = createLogger(env.LOG_LEVEL);
    const body = collectCommandDefinitions(env, logger);
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
        body,
    });
    logger.info({ guildId: env.DISCORD_GUILD_ID, commands: body.map((command) => `/${command.name}`) }, 'Comandos slash registrados');
}
/**
 * Construye los módulos solo para leer la definición de sus comandos. No se conecta a
 * Discord ni toca la base de datos real: usa un cliente sin iniciar sesión y una base
 * de datos en memoria.
 */
function collectCommandDefinitions(env, logger) {
    const client = createDiscordClient();
    const database = openDatabase(IN_MEMORY_DATABASE);
    try {
        return createModules({
            env,
            clock: systemClock,
            icons: new IconRegistry(),
            client,
            database,
            logger,
        })
            .flatMap((bundle) => bundle.commands)
            .map((command) => command.data);
    }
    finally {
        database.close();
        void client.destroy();
    }
}
deployCommands().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`No se pudieron registrar los comandos:\n${message}\n`);
    process.exit(1);
});
//# sourceMappingURL=deploy-commands.js.map