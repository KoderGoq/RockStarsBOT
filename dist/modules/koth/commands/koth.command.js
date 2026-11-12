import { createCommandWithSubcommands } from '../../../core/commands/command-with-subcommands.js';
import { KOTH_COMMAND_NAME } from '../domain/koth.constants.js';
import { createKothNextSubcommand } from './koth-next.command.js';
import { createKothScheduleSubcommand } from './koth-schedule.command.js';
import { createKothTestSubcommand } from './koth-test.command.js';
/** `/koth`: agrupa los subcomandos del módulo. Añade aquí los nuevos subcomandos. */
export function createKothCommand(deps) {
    return createCommandWithSubcommands({
        name: KOTH_COMMAND_NAME,
        description: 'Información sobre los eventos KOTH de Boutcraft',
        subcommands: [
            createKothNextSubcommand(deps),
            createKothScheduleSubcommand(deps),
            createKothTestSubcommand(deps),
        ],
    });
}
//# sourceMappingURL=koth.command.js.map