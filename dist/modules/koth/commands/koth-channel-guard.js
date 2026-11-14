import { MessageFlags } from 'discord.js';
import { buildWrongChannelReply } from '../templates/koth-dm-messages.js';
/**
 * Los comandos de suscripción solo funcionan en el canal exclusivo de suscripción (si hay
 * uno configurado), para que no se llenen de comandos otros canales. Si se usan en otro,
 * se responde (solo a quien lo usó) indicando dónde ir y devuelve `false`.
 *
 * También vale un hilo (thread) dentro del canal de suscripción.
 */
export async function ensureInSubscriptionChannel(interaction, context) {
    const allowedChannelId = context.subscriptionChannelId;
    if (allowedChannelId === null || isInChannel(interaction, allowedChannelId)) {
        return true;
    }
    await interaction.reply({
        content: buildWrongChannelReply(allowedChannelId, context.icons),
        flags: MessageFlags.Ephemeral,
    });
    return false;
}
function isInChannel(interaction, channelId) {
    if (interaction.channelId === channelId)
        return true;
    const channel = interaction.channel;
    return channel?.isThread() === true && channel.parentId === channelId;
}
//# sourceMappingURL=koth-channel-guard.js.map