import { buildDirectReminderMessage, buildDirectReminderPreviewMessage, buildSubscriptionConfirmationDm, } from '../templates/koth-dm-messages.js';
import { classifyDirectMessageError } from './classify-direct-message-error.js';
/** Adaptador de Discord: escribe MD a los suscriptores de KOTH. */
export class DiscordKothDirectMessenger {
    options;
    constructor(options) {
        this.options = options;
    }
    async sendReminder(userId, reminder) {
        const membership = await this.checkMembership(userId);
        if (membership !== 'member')
            return membership;
        return this.deliver(userId, buildDirectReminderMessage(reminder, this.options.messageContext));
    }
    sendPreview(userId, reminder) {
        return this.deliver(userId, buildDirectReminderPreviewMessage(reminder, this.options.messageContext));
    }
    sendSubscriptionConfirmation(userId) {
        return this.deliver(userId, buildSubscriptionConfirmationDm(this.options.messageContext));
    }
    /**
     * Consulta a Discord (sin caché) si el usuario sigue en el servidor. Usa la
     * consulta de un único miembro, que no requiere el intent privilegiado de miembros.
     */
    async checkMembership(userId) {
        try {
            const guild = await this.options.client.guilds.fetch(this.options.guildId);
            await guild.members.fetch({ user: userId, force: true });
            return 'member';
        }
        catch (error) {
            return classifyDirectMessageError(error);
        }
    }
    async deliver(userId, message) {
        try {
            const sent = await this.options.client.users.send(userId, {
                ...message,
                allowedMentions: { parse: [] },
            });
            return { kind: 'sent', messageId: sent.id };
        }
        catch (error) {
            return classifyDirectMessageError(error);
        }
    }
}
//# sourceMappingURL=koth-direct-message.service.js.map