import { MessageFlags } from 'discord.js';
import { buildNotSubscribedReply, buildSubscribeResultReply, buildUnsubscribedReply, } from '../templates/koth-dm-messages.js';
import { ensureInSubscriptionChannel } from './koth-channel-guard.js';
/**
 * `/koth suscribirme`: el miembro pide recibir un MD antes de cada KOTH.
 * Solo funciona en el canal de suscripción, si hay uno configurado.
 */
export function createKothSubscribeSubcommand(deps) {
    const { messageContext } = deps;
    return {
        name: 'suscribirme',
        description: 'Recibe un mensaje privado del bot unos minutos antes de cada KOTH',
        async execute(interaction) {
            if (!(await ensureInSubscriptionChannel(interaction, messageContext)))
                return;
            // Escribir el MD de confirmación puede tardar más de los 3 s que da Discord.
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const result = await deps.subscriptions.subscribe(interaction.user.id);
            await interaction.editReply(buildSubscribeResultReply(result, messageContext.icons));
        },
    };
}
/**
 * `/koth cancelar`: el miembro deja de recibir los MD.
 * Solo funciona en el canal de suscripción, si hay uno configurado.
 */
export function createKothUnsubscribeSubcommand(deps) {
    const { messageContext } = deps;
    const { icons } = messageContext;
    return {
        name: 'cancelar',
        description: 'Deja de recibir los mensajes privados de KOTH',
        async execute(interaction) {
            if (!(await ensureInSubscriptionChannel(interaction, messageContext)))
                return;
            const removed = deps.subscriptions.unsubscribe(interaction.user.id);
            await interaction.reply({
                content: removed ? buildUnsubscribedReply(icons) : buildNotSubscribedReply(icons),
                flags: MessageFlags.Ephemeral,
            });
        },
    };
}
//# sourceMappingURL=koth-subscribe.command.js.map