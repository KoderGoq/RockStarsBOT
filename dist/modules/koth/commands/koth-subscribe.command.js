import { MessageFlags } from 'discord.js';
import { buildAlreadySubscribedReply, buildDmsClosedReply, buildNotSubscribedReply, buildSubscribedReply, buildSubscriptionUnavailableReply, buildUnsubscribedReply, } from '../templates/koth-dm-messages.js';
/** `/koth suscribirme`: el miembro pide recibir un MD antes de cada KOTH. */
export function createKothSubscribeSubcommand(deps) {
    const { icons } = deps.messageContext;
    return {
        name: 'suscribirme',
        description: 'Recibe un mensaje privado del bot unos minutos antes de cada KOTH',
        async execute(interaction) {
            // Escribir el MD de confirmación puede tardar más de los 3 s que da Discord.
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const result = await deps.subscriptions.subscribe(interaction.user.id);
            await interaction.editReply(describeSubscribeResult(result, icons));
        },
    };
}
/** `/koth cancelar`: el miembro deja de recibir los MD. */
export function createKothUnsubscribeSubcommand(deps) {
    const { icons } = deps.messageContext;
    return {
        name: 'cancelar',
        description: 'Deja de recibir los mensajes privados de KOTH',
        async execute(interaction) {
            const removed = deps.subscriptions.unsubscribe(interaction.user.id);
            await interaction.reply({
                content: removed ? buildUnsubscribedReply(icons) : buildNotSubscribedReply(icons),
                flags: MessageFlags.Ephemeral,
            });
        },
    };
}
function describeSubscribeResult(result, icons) {
    switch (result.kind) {
        case 'subscribed':
            return buildSubscribedReply(icons);
        case 'already-subscribed':
            return buildAlreadySubscribedReply(icons);
        case 'dms-closed':
            return buildDmsClosedReply(icons);
        case 'unavailable':
            return buildSubscriptionUnavailableReply(icons);
    }
}
//# sourceMappingURL=koth-subscribe.command.js.map