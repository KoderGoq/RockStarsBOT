import type { BaseMessageOptions, Client } from 'discord.js';
import type {
  DirectMessageOutcome,
  KothDirectMessenger,
  UndeliveredOutcome,
} from '../domain/koth.ports.js';
import type { KothReminder } from '../domain/koth.types.js';
import {
  buildDirectReminderMessage,
  buildDirectReminderPreviewMessage,
  buildSubscriptionConfirmationDm,
} from '../templates/koth-dm-messages.js';
import type { MessageContext } from '../templates/koth-messages.js';
import { classifyDirectMessageError } from './classify-direct-message-error.js';

export interface DiscordKothDirectMessengerOptions {
  readonly client: Client;
  readonly guildId: string;
  readonly messageContext: MessageContext;
}

/** Adaptador de Discord: escribe MD a los suscriptores de KOTH. */
export class DiscordKothDirectMessenger implements KothDirectMessenger {
  constructor(private readonly options: DiscordKothDirectMessengerOptions) {}

  async sendReminder(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome> {
    const membership = await this.checkMembership(userId);
    if (membership !== 'member') return membership;

    return this.deliver(userId, buildDirectReminderMessage(reminder, this.options.messageContext));
  }

  sendPreview(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome> {
    return this.deliver(
      userId,
      buildDirectReminderPreviewMessage(reminder, this.options.messageContext),
    );
  }

  sendSubscriptionConfirmation(userId: string): Promise<DirectMessageOutcome> {
    return this.deliver(userId, buildSubscriptionConfirmationDm(this.options.messageContext));
  }

  /**
   * Consulta a Discord (sin caché) si el usuario sigue en el servidor. Usa la
   * consulta de un único miembro, que no requiere el intent privilegiado de miembros.
   */
  private async checkMembership(userId: string): Promise<'member' | UndeliveredOutcome> {
    try {
      const guild = await this.options.client.guilds.fetch(this.options.guildId);
      await guild.members.fetch({ user: userId, force: true });
      return 'member';
    } catch (error: unknown) {
      return classifyDirectMessageError(error);
    }
  }

  private async deliver(
    userId: string,
    message: BaseMessageOptions,
  ): Promise<DirectMessageOutcome> {
    try {
      const sent = await this.options.client.users.send(userId, {
        ...message,
        allowedMentions: { parse: [] },
      });
      return { kind: 'sent', messageId: sent.id };
    } catch (error: unknown) {
      return classifyDirectMessageError(error);
    }
  }
}
