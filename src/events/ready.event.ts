import { type Client, Events } from 'discord.js';
import type { Logger } from 'pino';

export interface ReadyEventOptions {
  readonly logger: Logger;
  /** Se ejecuta una sola vez, tras la primera conexión con Discord. */
  readonly onReady: () => Promise<void>;
}

export function registerReadyEvent(client: Client, options: ReadyEventOptions): void {
  client.once(Events.ClientReady, (readyClient) => {
    options.logger.info(
      { user: readyClient.user.tag, guilds: readyClient.guilds.cache.size },
      'Conectado a Discord',
    );
    void options.onReady();
  });
}
