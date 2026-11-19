import { createCommandWithSubcommands } from '../../../core/commands/command-with-subcommands.js';
import { KOTH_COMMAND_NAME } from '../domain/koth.constants.js';
import { createKothNextSubcommand } from './koth-next.command.js';
import { createKothPanelSubcommand } from './koth-panel.command.js';
import { createKothPauseSubcommand, createKothResumeSubcommand } from './koth-power.command.js';
import { createKothScheduleSubcommand } from './koth-schedule.command.js';
import { createKothSubscribeSubcommand, createKothUnsubscribeSubcommand, } from './koth-subscribe.command.js';
import { createKothRemoveSubscriberSubcommand, createKothSubscribersSubcommand, } from './koth-subscribers.command.js';
import { createKothTestSubcommand } from './koth-test.command.js';
/** `/koth`: agrupa los subcomandos del módulo. Añade aquí los nuevos subcomandos. */
export function createKothCommand(deps) {
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
            createKothPanelSubcommand(deps),
            createKothPauseSubcommand(deps),
            createKothResumeSubcommand(deps),
            createKothTestSubcommand(deps),
        ],
    });
}
//# sourceMappingURL=koth.command.js.map