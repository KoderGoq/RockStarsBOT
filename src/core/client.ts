import { Client, GatewayIntentBits } from 'discord.js';

/**
 * Cliente de Discord con los intents mínimos necesarios.
 * `Guilds` basta para comandos slash y para publicar en canales; no se necesita
 * leer el contenido de los mensajes.
 */
export function createDiscordClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [] },
  });
}
