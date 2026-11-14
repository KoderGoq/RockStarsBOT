import { type ButtonInteraction, MessageFlags } from 'discord.js';
import type { Logger } from 'pino';
import type { IconResolver } from '../../shared/icons/icon-registry.js';
import type { ButtonHandler } from '../../shared/types/button.js';
import { replyWithError } from './reply-with-error.js';

const UNKNOWN_BUTTON_TEXT = 'Este botón ya no está disponible.';

/** Registro y despacho de botones por su `customId`, con manejo centralizado de errores. */
export class ButtonRegistry {
  private readonly handlers = new Map<string, ButtonHandler>();

  constructor(
    handlers: readonly ButtonHandler[],
    private readonly icons: IconResolver,
    private readonly logger: Logger,
  ) {
    for (const handler of handlers) {
      if (this.handlers.has(handler.customId)) {
        throw new Error(`Botón duplicado: ${handler.customId}`);
      }
      this.handlers.set(handler.customId, handler);
    }
  }

  /** Nunca lanza: los errores se registran y se informa al usuario. */
  async handle(interaction: ButtonInteraction): Promise<void> {
    const handler = this.handlers.get(interaction.customId);
    if (handler === undefined) {
      // Un mensaje antiguo con un botón que ya no existe: se responde para que no falle en silencio.
      this.logger.warn({ customId: interaction.customId }, 'Botón no registrado');
      await this.replyUnknownButton(interaction);
      return;
    }

    try {
      await handler.execute(interaction);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, customId: interaction.customId, user: interaction.user.id },
        'Error al ejecutar botón',
      );
      await replyWithError(interaction, this.icons, this.logger);
    }
  }

  private async replyUnknownButton(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.reply({
        content: `${this.icons.get('circle-x')} ${UNKNOWN_BUTTON_TEXT}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error: unknown) {
      this.logger.error({ err: error }, 'No se pudo responder a un botón desconocido');
    }
  }
}
