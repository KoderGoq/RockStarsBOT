import {
  type Client,
  DiscordAPIError,
  RESTJSONErrorCodes,
  type SendableChannels,
} from 'discord.js';
import type { KothSubscriptionPanelGateway } from '../domain/koth.ports.js';
import { buildSubscriptionPanelMessage } from '../templates/koth-dm-messages.js';
import type { MessageContext } from '../templates/koth-messages.js';

export interface DiscordKothSubscriptionPanelGatewayOptions {
  readonly client: Client;
  readonly messageContext: MessageContext;
}

/** Adaptador de Discord: publica y actualiza el panel de suscripción en su canal. */
export class DiscordKothSubscriptionPanelGateway implements KothSubscriptionPanelGateway {
  constructor(private readonly options: DiscordKothSubscriptionPanelGatewayOptions) {}

  /** Comprueba al arrancar que el canal existe y que el bot puede escribir en él. */
  async verifyChannel(channelId: string): Promise<void> {
    await this.resolveChannel(channelId);
  }

  async create(channelId: string): Promise<{ readonly messageId: string }> {
    const channel = await this.resolveChannel(channelId);
    const sent = await channel.send(buildSubscriptionPanelMessage(this.options.messageContext));
    return { messageId: sent.id };
  }

  async update(channelId: string, messageId: string): Promise<boolean> {
    const channel = await this.resolveChannel(channelId);
    if (!('messages' in channel)) {
      throw new Error(`El canal ${channelId} no permite editar mensajes`);
    }

    try {
      await channel.messages.edit(
        messageId,
        buildSubscriptionPanelMessage(this.options.messageContext),
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage) {
        return false;
      }
      throw error;
    }
  }

  private async resolveChannel(channelId: string): Promise<SendableChannels> {
    const channel = await this.options.client.channels.fetch(channelId);

    if (channel === null) {
      throw new Error(
        `No se encontró el canal de suscripción ${channelId} (¿el bot tiene acceso?)`,
      );
    }
    if (!channel.isSendable()) {
      throw new Error(`El canal ${channelId} no admite mensajes de texto`);
    }
    return channel;
  }
}
