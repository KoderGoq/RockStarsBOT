import { buildScheduleEmbed } from '../templates/koth-messages.js';
/** `/koth horarios`: muestra los horarios oficiales de KOTH. */
export function createKothScheduleSubcommand(deps) {
    return {
        name: 'horarios',
        description: 'Muestra los horarios oficiales de KOTH',
        async execute(interaction) {
            const { timeService } = deps;
            const embed = buildScheduleEmbed(timeService.getNextOccurrencePerSlot(deps.clock.now()), timeService.reminderOffsetsMinutes, deps.messageContext);
            await interaction.reply({ embeds: [embed] });
        },
    };
}
//# sourceMappingURL=koth-schedule.command.js.map