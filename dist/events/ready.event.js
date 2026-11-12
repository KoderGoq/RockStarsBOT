import { Events } from 'discord.js';
export function registerReadyEvent(client, options) {
    client.once(Events.ClientReady, (readyClient) => {
        options.logger.info({ user: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, 'Conectado a Discord');
        void options.onReady();
    });
}
//# sourceMappingURL=ready.event.js.map