import { buildNextKothEmbed } from '../templates/koth-messages.js';
/** `/koth siguiente`: muestra el próximo KOTH. */
export function createKothNextSubcommand(deps) {
    return {
        name: 'siguiente',
        description: 'Muestra el próximo KOTH de Boutcraft',
        async execute(interaction) {
            const now = deps.clock.now();
            const next = deps.timeService.getNextOccurrence(now);
            await interaction.reply({ embeds: [buildNextKothEmbed(next, now, deps.messageContext)] });
        },
    };
}
//# sourceMappingURL=koth-next.command.js.map