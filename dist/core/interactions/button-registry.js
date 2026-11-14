import { MessageFlags } from 'discord.js';
import { replyWithError } from './reply-with-error.js';
const UNKNOWN_BUTTON_TEXT = 'Este botón ya no está disponible.';
/** Registro y despacho de botones por su `customId`, con manejo centralizado de errores. */
export class ButtonRegistry {
    icons;
    logger;
    handlers = new Map();
    constructor(handlers, icons, logger) {
        this.icons = icons;
        this.logger = logger;
        for (const handler of handlers) {
            if (this.handlers.has(handler.customId)) {
                throw new Error(`Botón duplicado: ${handler.customId}`);
            }
            this.handlers.set(handler.customId, handler);
        }
    }
    /** Nunca lanza: los errores se registran y se informa al usuario. */
    async handle(interaction) {
        const handler = this.handlers.get(interaction.customId);
        if (handler === undefined) {
            // Un mensaje antiguo con un botón que ya no existe: se responde para que no falle en silencio.
            this.logger.warn({ customId: interaction.customId }, 'Botón no registrado');
            await this.replyUnknownButton(interaction);
            return;
        }
        try {
            await handler.execute(interaction);
        }
        catch (error) {
            this.logger.error({ err: error, customId: interaction.customId, user: interaction.user.id }, 'Error al ejecutar botón');
            await replyWithError(interaction, this.icons, this.logger);
        }
    }
    async replyUnknownButton(interaction) {
        try {
            await interaction.reply({
                content: `${this.icons.get('circle-x')} ${UNKNOWN_BUTTON_TEXT}`,
                flags: MessageFlags.Ephemeral,
            });
        }
        catch (error) {
            this.logger.error({ err: error }, 'No se pudo responder a un botón desconocido');
        }
    }
}
//# sourceMappingURL=button-registry.js.map