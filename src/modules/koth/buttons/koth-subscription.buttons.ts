import { MessageFlags } from 'discord.js';
import type { ButtonHandler } from '../../../shared/types/button.js';
import { KOTH_SUBSCRIBE_BUTTON_ID, KOTH_UNSUBSCRIBE_BUTTON_ID } from '../domain/koth.constants.js';
import type { KothCommandDependencies } from '../commands/koth-command.dependencies.js';
import {
  buildNotSubscribedReply,
  buildSubscribeResultReply,
  buildUnsubscribedReply,
} from '../templates/koth-dm-messages.js';

/** Botones del panel de suscripción. Hacen lo mismo que `/koth suscribirme` y `/koth cancelar`. */
export function createKothSubscriptionButtons(deps: KothCommandDependencies): ButtonHandler[] {
  const { icons } = deps.messageContext;

  return [
    {
      customId: KOTH_SUBSCRIBE_BUTTON_ID,
      async execute(interaction) {
        // Escribir el MD de confirmación puede tardar más de los 3 s que da Discord.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await deps.subscriptions.subscribe(interaction.user.id);
        await interaction.editReply(buildSubscribeResultReply(result, icons));
      },
    },
    {
      customId: KOTH_UNSUBSCRIBE_BUTTON_ID,
      async execute(interaction) {
        const removed = deps.subscriptions.unsubscribe(interaction.user.id);
        await interaction.reply({
          content: removed ? buildUnsubscribedReply(icons) : buildNotSubscribedReply(icons),
          flags: MessageFlags.Ephemeral,
        });
      },
    },
  ];
}
