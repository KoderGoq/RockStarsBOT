import type { SlashSubcommand } from '../../../shared/types/command.js';
import { buildScheduleEmbed } from '../templates/koth-messages.js';
import type { KothCommandDependencies } from './koth-command.dependencies.js';

/** `/koth horarios`: muestra los horarios oficiales de KOTH. */
export function createKothScheduleSubcommand(deps: KothCommandDependencies): SlashSubcommand {
  return {
    name: 'horarios',
    description: 'Muestra los horarios oficiales de KOTH',
    async execute(interaction) {
      const { timeService } = deps;
      const embed = buildScheduleEmbed(
        timeService.getNextOccurrencePerSlot(deps.clock.now()),
        timeService.reminderOffsetsMinutes,
        deps.messageContext,
      );
      await interaction.reply({ embeds: [embed] });
    },
  };
}
