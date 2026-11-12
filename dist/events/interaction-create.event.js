import { Events } from 'discord.js';
export function registerInteractionCreateEvent(client, registry) {
    client.on(Events.InteractionCreate, (interaction) => {
        if (!interaction.isChatInputCommand())
            return;
        void registry.handle(interaction);
    });
}
//# sourceMappingURL=interaction-create.event.js.map