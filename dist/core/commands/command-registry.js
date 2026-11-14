import { replyWithError } from '../interactions/reply-with-error.js';
/** Registro y despacho de comandos slash con manejo centralizado de errores. */
export class CommandRegistry {
    icons;
    logger;
    commands = new Map();
    constructor(commands, icons, logger) {
        this.icons = icons;
        this.logger = logger;
        for (const command of commands) {
            if (this.commands.has(command.data.name)) {
                throw new Error(`Comando duplicado: /${command.data.name}`);
            }
            this.commands.set(command.data.name, command);
        }
    }
    /** Nunca lanza: los errores se registran y se informa al usuario. */
    async handle(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (command === undefined) {
            this.logger.warn({ command: interaction.commandName }, 'Comando no registrado');
            return;
        }
        try {
            await command.execute(interaction);
        }
        catch (error) {
            this.logger.error({ err: error, command: interaction.commandName, user: interaction.user.id }, 'Error al ejecutar comando');
            await replyWithError(interaction, this.icons, this.logger);
        }
    }
}
//# sourceMappingURL=command-registry.js.map