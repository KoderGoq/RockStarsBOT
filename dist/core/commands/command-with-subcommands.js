import { SlashCommandBuilder } from 'discord.js';
/** Construye un comando slash que delega en sus subcomandos por nombre. */
export function createCommandWithSubcommands(options) {
    const builder = new SlashCommandBuilder()
        .setName(options.name)
        .setDescription(options.description);
    for (const subcommand of options.subcommands) {
        builder.addSubcommand((sub) => {
            sub.setName(subcommand.name).setDescription(subcommand.description);
            return subcommand.configure?.(sub) ?? sub;
        });
    }
    const subcommandsByName = new Map(options.subcommands.map((sub) => [sub.name, sub]));
    return {
        data: builder.toJSON(),
        async execute(interaction) {
            const name = interaction.options.getSubcommand(true);
            const subcommand = subcommandsByName.get(name);
            if (subcommand === undefined) {
                throw new Error(`Subcomando desconocido: /${options.name} ${name}`);
            }
            await subcommand.execute(interaction);
        },
    };
}
//# sourceMappingURL=command-with-subcommands.js.map