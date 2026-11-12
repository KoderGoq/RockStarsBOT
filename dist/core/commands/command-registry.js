import { MessageFlags } from 'discord.js';
const COMMAND_ERROR_TEXT = 'Ha ocurrido un error al ejecutar el comando. Inténtalo de nuevo en unos instantes.';
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
            await this.replyWithError(interaction);
        }
    }
    async replyWithError(interaction) {
        const payload = {
            content: `${this.icons.get('circle-x')} ${COMMAND_ERROR_TEXT}`,
            flags: MessageFlags.Ephemeral,
        };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload);
            }
            else {
                await interaction.reply(payload);
            }
        }
        catch (error) {
            this.logger.error({ err: error }, 'No se pudo notificar el error al usuario');
        }
    }
}
//# sourceMappingURL=command-registry.js.map