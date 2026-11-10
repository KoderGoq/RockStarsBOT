import type { BaseMessageOptions, Client, SendableChannels } from 'discord.js';
import type { AnnouncementResult, KothAnnouncer } from '../domain/koth.ports.js';
import type { KothReminder } from '../domain/koth.types.js';
import { buildReminderMessage, type MessageContext } from '../templates/koth-messages.js';

export interface DiscordKothAnnouncerOptions {
  readonly client: Client;
  readonly channelId: string;
  readonly messageContext: MessageContext;
}

/** Adaptador de Discord: publica los avisos de KOTH en el canal configurado. */
export class DiscordKothAnnouncer implements KothAnnouncer {
  constructor(private readonly options: DiscordKothAnnouncerOptions) {}

  /** Comprueba al arrancar que el canal existe y que el bot puede escribir en él. */
  async verifyChannel(): Promise<void> {
    await this.resolveChannel();
  }

  async announce(reminder: KothReminder): Promise<AnnouncementResult> {
    return this.publish(buildReminderMessage(reminder, this.options.messageContext));
  }

  /** Publica un mensaje arbitrario en el canal de avisos (también lo usa `/koth prueba`). */
  async publish(message: BaseMessageOptions): Promise<AnnouncementResult> {
    const channel = await this.resolveChannel();
    // Por defecto no se menciona a nadie; el propio mensaje puede declarar excepciones.
    const sent = await channel.send({ allowedMentions: { parse: [] }, ...message });
    return { messageId: sent.id };
  }

  private async resolveChannel(): Promise<SendableChannels> {
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
