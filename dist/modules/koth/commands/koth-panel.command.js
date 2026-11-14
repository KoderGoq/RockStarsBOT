import { MessageFlags } from 'discord.js';
import { buildPanelFailedReply, buildPanelNotConfiguredReply, buildPanelPublishedReply, } from '../templates/koth-dm-messages.js';
import { ensureCanManageServer } from './koth-permissions.js';
/**
 * `/koth panel`: publica en el canal de suscripción el mensaje con los botones, o lo
 * actualiza si ya existe (solo administradores). Se ejecuta a mano a propósito: así el
 * bot nunca publica mensajes por su cuenta al arrancar.
 */
export function createKothPanelSubcommand(deps) {
    const { icons, subscriptionChannelId } = deps.messageContext;
    return {
        name: 'panel',
        description: 'Publica o actualiza el mensaje con los botones de suscripción (solo administradores)',
        async execute(interaction) {
            if (!(await ensureCanManageServer(interaction, icons)))
                return;
            if (deps.panel === null || subscriptionChannelId === null) {
                await interaction.reply({
                    content: buildPanelNotConfiguredReply(icons),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                const result = await deps.panel.publish();
                await interaction.editReply(buildPanelPublishedReply(result.kind, subscriptionChannelId, icons));
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                await interaction.editReply(buildPanelFailedReply(subscriptionChannelId, reason, icons));
            }
        },
    };
}
//# sourceMappingURL=koth-panel.command.js.map