import type { SlashSubcommand } from '../../../shared/types/command.js';
import { buildNextKothEmbed } from '../templates/koth-messages.js';
import type { KothCommandDependencies } from './koth-command.dependencies.js';

/** `/koth siguiente`: muestra el próximo KOTH. */
export function createKothNextSubcommand(deps: KothCommandDependencies): SlashSubcommand {
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
