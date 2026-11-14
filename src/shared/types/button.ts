import type { ButtonInteraction } from 'discord.js';

/** Acción asociada a un botón de un mensaje del bot, identificada por su `customId`. */
export interface ButtonHandler {
  readonly customId: string;
  execute(interaction: ButtonInteraction): Promise<void>;
}
