import { REST, Routes } from 'discord.js';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { createCommands } from '../modules/index.js';
import { systemClock } from '../shared/utils/clock.js';

/**
 * Registra (o actualiza) los comandos slash en el servidor configurado.
 * Los comandos de servidor (guild) se aplican al instante.
 */
async function deployCommands(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const body = createCommands({ env, clock: systemClock }).map((command) => command.data);

  const rest = new REST().setToken(env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body,
  });

  logger.info(
    { guildId: env.DISCORD_GUILD_ID, commands: body.map((command) => `/${command.name}`) },
    'Comandos slash registrados',
  );
}

deployCommands().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`No se pudieron registrar los comandos:\n${message}\n`);
  process.exit(1);
});
