import { MessageFlags } from 'discord.js';
const INTERACTION_ERROR_TEXT = 'Ha ocurrido un error al ejecutar la acción. Inténtalo de nuevo en unos instantes.';
/**
 * Avisa (solo a quien interactuó) de que algo ha fallado. Funciona tanto si la interacción
 * ya se había respondido como si no. Nunca lanza: si tampoco se puede avisar, solo se registra.
 */
export async function replyWithError(interaction, icons, logger) {
    const payload = {
        content: `${icons.get('circle-x')} ${INTERACTION_ERROR_TEXT}`,
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
        logger.error({ err: error }, 'No se pudo notificar el error al usuario');
    }
}
//# sourceMappingURL=reply-with-error.js.map