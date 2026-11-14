import { Events } from 'discord.js';
/** Enruta cada interacción (comando slash o botón) a su registro. */
export function registerInteractionCreateEvent(client, handlers) {
    client.on(Events.InteractionCreate, (interaction) => {
        if (interaction.isChatInputCommand()) {
            void handlers.commands.handle(interaction);
        }
        else if (interaction.isButton()) {
            void handlers.buttons.handle(interaction);
        }
    });
}
//# sourceMappingURL=interaction-create.event.js.map