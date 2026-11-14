import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { IconResolver } from '../../../shared/icons/icon-registry.js';
import { buildNoPermissionMessage } from '../templates/koth-messages.js';

/**
 * Comprueba que quien ejecuta el comando tiene "Gestionar servidor". Si no, le
 * responde (solo a él) y devuelve `false`: el comando debe terminar sin hacer nada.
 */
export async function ensureCanManageServer(
  interaction: ChatInputCommandInteraction,
  icons: IconResolver,
): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true) {
    return true;
  }

  await interaction.reply({
    content: buildNoPermissionMessage(icons),
    flags: MessageFlags.Ephemeral,
  });
  return false;
}
