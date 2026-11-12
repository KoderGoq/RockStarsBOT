import { buildReminderMessage } from '../templates/koth-messages.js';
/** Adaptador de Discord: publica los avisos de KOTH en el canal configurado. */
export class DiscordKothAnnouncer {
    options;
    constructor(options) {
        this.options = options;
    }
    /** Comprueba al arrancar que el canal existe y que el bot puede escribir en él. */
    async verifyChannel() {
        await this.resolveChannel();
    }
    async announce(reminder) {
        return this.publish(buildReminderMessage(reminder, this.options.messageContext));
    }
    /** Publica un mensaje arbitrario en el canal de avisos (también lo usa `/koth prueba`). */
    async publish(message) {
        const channel = await this.resolveChannel();
        // Por defecto no se menciona a nadie; el propio mensaje puede declarar excepciones.
        const sent = await channel.send({ allowedMentions: { parse: [] }, ...message });
        return { messageId: sent.id };
    }
    async resolveChannel() {
        const { client, channelId } = this.options;
        const channel = await client.channels.fetch(channelId);
        if (channel === null) {
            throw new Error(`No se encontró el canal de anuncios ${channelId} (¿el bot tiene acceso?)`);
        }
        if (!channel.isSendable()) {
            throw new Error(`El canal ${channelId} no admite mensajes de texto`);
        }
        return channel;
    }
}
//# sourceMappingURL=koth-notification.service.js.map