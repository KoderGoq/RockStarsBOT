import { DiscordAPIError } from 'discord.js';
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
        return this.deliver(userId, 'aviso', buildDirectReminderMessage(reminder, this.options.messageContext));
    }
    sendPreview(userId, reminder) {
        return this.deliver(userId, 'prueba', buildDirectReminderPreviewMessage(reminder, this.options.messageContext));
    }
    sendSubscriptionConfirmation(userId) {
        return this.deliver(userId, 'confirmación', buildSubscriptionConfirmationDm(this.options.messageContext));
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
            return this.classify(userId, 'comprobar miembro', error);
        }
    }
    async deliver(userId, purpose, message) {
        try {
            const sent = await this.options.client.users.send(userId, {
                ...message,
                allowedMentions: { parse: [] },
            });
            return { kind: 'sent', messageId: sent.id };
        }
        catch (error) {
            return this.classify(userId, purpose, error);
        }
    }
    /**
     * Traduce el error a un resultado y deja constancia del motivo real. Lo esperable (MD
     * cerrados, usuario que se fue) va a `debug`; un límite de Discord o un fallo inesperado
     * van a `warn`, con el código de Discord, para poder diagnosticarlos.
     */
    classify(userId, purpose, error) {
        const outcome = classifyDirectMessageError(error);
        const details = { userId, purpose, outcome: outcome.kind, ...describeError(error) };
        if (outcome.kind === 'failed' || outcome.kind === 'rate-limited') {
            this.options.logger.warn(details, 'Discord no permitió enviar el MD');
        }
        else {
            this.options.logger.debug(details, 'No se pudo enviar el MD');
        }
        return outcome;
    }
}
function describeError(error) {
    if (error instanceof DiscordAPIError) {
        return { code: error.code, status: error.status, reason: error.message };
    }
    return { reason: error instanceof Error ? error.message : String(error) };
}
//# sourceMappingURL=koth-direct-message.service.js.map