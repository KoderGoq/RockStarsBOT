import { type BaseMessageOptions, type Client, DiscordAPIError } from 'discord.js';
import type { Logger } from 'pino';
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
  readonly logger: Logger;
}

/** Adaptador de Discord: escribe MD a los suscriptores de KOTH. */
export class DiscordKothDirectMessenger implements KothDirectMessenger {
  constructor(private readonly options: DiscordKothDirectMessengerOptions) {}

  async sendReminder(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome> {
    const membership = await this.checkMembership(userId);
    if (membership !== 'member') return membership;

    return this.deliver(
      userId,
      'aviso',
      buildDirectReminderMessage(reminder, this.options.messageContext),
    );
  }

  sendPreview(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome> {
    return this.deliver(
      userId,
      'prueba',
      buildDirectReminderPreviewMessage(reminder, this.options.messageContext),
    );
  }

  sendSubscriptionConfirmation(userId: string): Promise<DirectMessageOutcome> {
    return this.deliver(
      userId,
      'confirmación',
      buildSubscriptionConfirmationDm(this.options.messageContext),
    );
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
      return this.classify(userId, 'comprobar miembro', error);
    }
  }

  private async deliver(
    userId: string,
    purpose: string,
    message: BaseMessageOptions,
  ): Promise<DirectMessageOutcome> {
    try {
      const sent = await this.options.client.users.send(userId, {
        ...message,
        allowedMentions: { parse: [] },
      });
      return { kind: 'sent', messageId: sent.id };
    } catch (error: unknown) {
      return this.classify(userId, purpose, error);
    }
  }

  /**
   * Traduce el error a un resultado y deja constancia del motivo real. Lo esperable (MD
   * cerrados, usuario que se fue) va a `debug`; un límite de Discord o un fallo inesperado
   * van a `warn`, con el código de Discord, para poder diagnosticarlos.
   */
  private classify(userId: string, purpose: string, error: unknown): UndeliveredOutcome {
    const outcome = classifyDirectMessageError(error);
    const details = { userId, purpose, outcome: outcome.kind, ...describeError(error) };

    if (outcome.kind === 'failed' || outcome.kind === 'rate-limited') {
      this.options.logger.warn(details, 'Discord no permitió enviar el MD');
    } else {
      this.options.logger.debug(details, 'No se pudo enviar el MD');
    }
    return outcome;
  }
}

function describeError(error: unknown): {
  code?: string | number;
  status?: number;
  reason: string;
} {
  if (error instanceof DiscordAPIError) {
    return { code: error.code, status: error.status, reason: error.message };
  }
  return { reason: error instanceof Error ? error.message : String(error) };
}
