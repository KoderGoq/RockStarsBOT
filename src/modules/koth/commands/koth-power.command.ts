import { MessageFlags } from 'discord.js';
import type { SlashSubcommand } from '../../../shared/types/command.js';
import {
  buildAlreadyPausedReply,
  buildAlreadyRunningReply,
  buildPausedReply,
  buildResumedReply,
} from '../templates/koth-admin-messages.js';
import type { KothCommandDependencies } from './koth-command.dependencies.js';
import { ensureCanManageServer } from './koth-permissions.js';

/**
 * `/koth apagar`: apaga los avisos (solo administradores). El bot sigue conectado y
 * atendiendo comandos; simplemente deja de anunciar KOTH y de enviar MD hasta que
 * alguien use `/koth encender`. El estado se conserva aunque el bot se reinicie.
 */
export function createKothPauseSubcommand(deps: KothCommandDependencies): SlashSubcommand {
  const { icons } = deps.messageContext;

  return {
    name: 'apagar',
    description: 'Apaga los avisos de KOTH; el bot sigue conectado (solo administradores)',
    async execute(interaction) {
      if (!(await ensureCanManageServer(interaction, icons))) return;

      const change = deps.pause.pause(interaction.user.id);
      await interaction.reply({
        content:
          change.kind === 'changed'
            ? buildPausedReply(icons)
            : buildAlreadyPausedReply(change.state, icons),
        flags: MessageFlags.Ephemeral,
      });
    },
  };
}

/** `/koth encender`: vuelve a encender los avisos (solo administradores). */
export function createKothResumeSubcommand(deps: KothCommandDependencies): SlashSubcommand {
  const { icons } = deps.messageContext;

  return {
    name: 'encender',
    description: 'Vuelve a encender los avisos de KOTH (solo administradores)',
    async execute(interaction) {
      if (!(await ensureCanManageServer(interaction, icons))) return;

      const change = deps.pause.resume(interaction.user.id);
      await interaction.reply({
        content:
          change.kind === 'changed' ? buildResumedReply(icons) : buildAlreadyRunningReply(icons),
        flags: MessageFlags.Ephemeral,
      });
    },
  };
}
