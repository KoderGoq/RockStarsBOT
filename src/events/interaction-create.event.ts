import { type Client, Events } from 'discord.js';
import type { CommandRegistry } from '../core/commands/command-registry.js';
import type { ButtonRegistry } from '../core/interactions/button-registry.js';

export interface InteractionHandlers {
  readonly commands: CommandRegistry;
  readonly buttons: ButtonRegistry;
}

/** Enruta cada interacción (comando slash o botón) a su registro. */
export function registerInteractionCreateEvent(
  client: Client,
  handlers: InteractionHandlers,
): void {
  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isChatInputCommand()) {
      void handlers.commands.handle(interaction);
    } else if (interaction.isButton()) {
      void handlers.buttons.handle(interaction);
    }
  });
}
