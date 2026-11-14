import { MessageFlags } from 'discord.js';
import type { SlashSubcommand } from '../../../shared/types/command.js';
import {
  buildNoSubscribersReply,
  buildSubscriberNotFoundReply,
  buildSubscriberRemovedReply,
  buildSubscribersEmbeds,
} from '../templates/koth-dm-messages.js';
import type { KothCommandDependencies } from './koth-command.dependencies.js';
import { ensureCanManageServer } from './koth-permissions.js';

const USER_OPTION = 'usuario';

/** `/koth suscriptores`: lista de los miembros suscritos a los MD (solo administradores). */
export function createKothSubscribersSubcommand(deps: KothCommandDependencies): SlashSubcommand {
  const { icons } = deps.messageContext;

  return {
    name: 'suscriptores',
    description: 'Muestra quién está suscrito a los MD de KOTH (solo administradores)',
    async execute(interaction) {
      if (!(await ensureCanManageServer(interaction, icons))) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const subscribers = deps.subscriptions.list();
      if (subscribers.length === 0) {
        await interaction.editReply(buildNoSubscribersReply(icons));
        return;
      }

      // Un embed por mensaje: la lista puede superar el límite de caracteres de Discord.
      const [first, ...rest] = buildSubscribersEmbeds(subscribers, { icons });
      await interaction.editReply({ embeds: first === undefined ? [] : [first] });
      for (const embed of rest) {
        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    },
  };
}

/** `/koth quitar usuario:@miembro`: da de baja a un suscriptor (solo administradores). */
export function createKothRemoveSubscriberSubcommand(
  deps: KothCommandDependencies,
): SlashSubcommand {
  const { icons } = deps.messageContext;

  return {
    name: 'quitar',
    description: 'Quita a un miembro de los MD de KOTH (solo administradores)',
    configure: (builder) =>
      builder.addUserOption((option) =>
        option
          .setName(USER_OPTION)
          .setDescription('Miembro al que quitar de la lista')
          .setRequired(true),
      ),

    async execute(interaction) {
      if (!(await ensureCanManageServer(interaction, icons))) return;

      const user = interaction.options.getUser(USER_OPTION, true);
      const removed = deps.subscriptions.unsubscribe(user.id);
      await interaction.reply({
        content: removed
          ? buildSubscriberRemovedReply(user.id, icons)
          : buildSubscriberNotFoundReply(user.id, icons),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    },
  };
}
