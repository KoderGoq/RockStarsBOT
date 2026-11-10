import type { Client } from 'discord.js';
import type { Logger } from 'pino';
import type { IconRegistry } from '../../shared/icons/icon-registry.js';

/**
 * Carga los emojis de la aplicación en el registro de iconos. Debe llamarse con
 * el cliente ya conectado. Nunca lanza: si falla, el bot sigue funcionando con los
 * emojis Unicode de respaldo.
 */
export async function loadApplicationIcons(
  client: Client<true>,
  registry: IconRegistry,
  logger: Logger,
): Promise<void> {
  try {
    const emojis = await client.application.emojis.fetch();
    const { loaded, missing } = registry.load(emojis.values());

    if (missing.length > 0) {
      logger.warn(
        { missing },
        'Faltan iconos por sincronizar; se usan emojis Unicode de respaldo. Ejecuta: pnpm icons:sync',
      );
    }
    logger.info({ loaded: loaded.length }, 'Iconos de la aplicación cargados');
  } catch (error: unknown) {
    logger.error({ err: error }, 'No se pudieron cargar los iconos; se usan emojis de respaldo');
  }
}
