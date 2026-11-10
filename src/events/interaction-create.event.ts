import { type Client, Events } from 'discord.js';
import type { CommandRegistry } from '../core/commands/command-registry.js';

export function registerInteractionCreateEvent(client: Client, registry: CommandRegistry): void {
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    void registry.handle(interaction);
  });
}
