import { DiscordAPIError, RESTJSONErrorCodes, } from 'discord.js';
import { buildSubscriptionPanelMessage } from '../templates/koth-dm-messages.js';
/** Adaptador de Discord: publica y actualiza el panel de suscripción en su canal. */
export class DiscordKothSubscriptionPanelGateway {
    options;
    constructor(options) {
        this.options = options;
    }
    /** Comprueba al arrancar que el canal existe y que el bot puede escribir en él. */
    async verifyChannel(channelId) {
        await this.resolveChannel(channelId);
    }
    async create(channelId) {
        const channel = await this.resolveChannel(channelId);
        const sent = await channel.send(buildSubscriptionPanelMessage(this.options.messageContext));
        return { messageId: sent.id };
    }
    async update(channelId, messageId) {
        const channel = await this.resolveChannel(channelId);
        if (!('messages' in channel)) {
            throw new Error(`El canal ${channelId} no permite editar mensajes`);
        }
        try {
            await channel.messages.edit(messageId, buildSubscriptionPanelMessage(this.options.messageContext));
            return true;
        }
        catch (error) {
            if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage) {
                return false;
            }
            throw error;
        }
    }
    async resolveChannel(channelId) {
        const channel = await this.options.client.channels.fetch(channelId);
        if (channel === null) {
            throw new Error(`No se encontró el canal de suscripción ${channelId} (¿el bot tiene acceso?)`);
        }
        if (!channel.isSendable()) {
            throw new Error(`El canal ${channelId} no admite mensajes de texto`);
        }
        return channel;
    }
}
//# sourceMappingURL=koth-panel-message.service.js.map