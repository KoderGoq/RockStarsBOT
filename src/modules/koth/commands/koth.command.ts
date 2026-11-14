import { createCommandWithSubcommands } from '../../../core/commands/command-with-subcommands.js';
import type { SlashCommand } from '../../../shared/types/command.js';
import { KOTH_COMMAND_NAME } from '../domain/koth.constants.js';
import type { KothCommandDependencies } from './koth-command.dependencies.js';
import { createKothNextSubcommand } from './koth-next.command.js';
import { createKothScheduleSubcommand } from './koth-schedule.command.js';
import {
  createKothSubscribeSubcommand,
  createKothUnsubscribeSubcommand,
} from './koth-subscribe.command.js';
import {
  createKothRemoveSubscriberSubcommand,
  createKothSubscribersSubcommand,
} from './koth-subscribers.command.js';
import { createKothTestSubcommand } from './koth-test.command.js';

/** `/koth`: agrupa los subcomandos del módulo. Añade aquí los nuevos subcomandos. */
export function createKothCommand(deps: KothCommandDependencies): SlashCommand {
  return createCommandWithSubcommands({
    name: KOTH_COMMAND_NAME,
    description: 'Información sobre los eventos KOTH de Boutcraft',
    subcommands: [
      createKothNextSubcommand(deps),
      createKothScheduleSubcommand(deps),
      createKothSubscribeSubcommand(deps),
      createKothUnsubscribeSubcommand(deps),
      createKothSubscribersSubcommand(deps),
      createKothRemoveSubscriberSubcommand(deps),
      createKothTestSubcommand(deps),
    ],
  });
}
