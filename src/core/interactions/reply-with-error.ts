import { MessageFlags, type RepliableInteraction } from 'discord.js';
import type { Logger } from 'pino';
import type { IconResolver } from '../../shared/icons/icon-registry.js';

const INTERACTION_ERROR_TEXT =
  'Ha ocurrido un error al ejecutar la acción. Inténtalo de nuevo en unos instantes.';

/**
 * Avisa (solo a quien interactuó) de que algo ha fallado. Funciona tanto si la interacción
 * ya se había respondido como si no. Nunca lanza: si tampoco se puede avisar, solo se registra.
 */
export async function replyWithError(
  interaction: RepliableInteraction,
  icons: IconResolver,
  logger: Logger,
): Promise<void> {
  const payload = {
    content: `${icons.get('circle-x')} ${INTERACTION_ERROR_TEXT}`,
    flags: MessageFlags.Ephemeral,
  } as const;

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (error: unknown) {
    logger.error({ err: error }, 'No se pudo notificar el error al usuario');
  }
}
