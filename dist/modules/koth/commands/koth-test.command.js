import { MessageFlags } from 'discord.js';
import { DiscordKothAnnouncer } from '../services/koth-notification.service.js';
import { buildPreviewFailedReply, buildPreviewSentReply } from '../templates/koth-dm-messages.js';
import { buildReminderNotConfiguredMessage, buildTestFailedMessage, buildTestPublishedMessage, buildTestReminderMessage, } from '../templates/koth-messages.js';
import { ensureCanManageServer } from './koth-permissions.js';
const OFFSET_OPTION = 'aviso';
const TARGET_OPTION = 'destino';
const DEFAULT_OFFSET_MINUTES = 60;
const TARGET_CHANNEL = 'canal';
const TARGET_DIRECT_MESSAGE = 'md';
/**
 * `/koth prueba [aviso] [destino]`: muestra cómo se ven los mensajes del bot.
 * - `destino:canal` (por defecto): publica un aviso de ejemplo en el canal de avisos.
 * - `destino:md`: envía el MD de ejemplo solo a quien ejecuta el comando.
 *
 * Solo para quien tenga "Gestionar servidor". No usa la base de datos, por lo que
 * no interfiere con los avisos reales.
 */
export function createKothTestSubcommand(deps) {
    const { icons } = deps.messageContext;
    return {
        name: 'prueba',
        description: 'Muestra cómo se ven los mensajes del bot (solo administradores)',
        configure: (builder) => builder
            .addIntegerOption((option) => option
            .setName(OFFSET_OPTION)
            .setDescription('Qué aviso simular en el canal (por defecto, el de 1 hora)')
            .addChoices(...deps.timeService.reminderOffsetsMinutes.map((minutes) => ({
            name: `${minutes} minutos antes`,
            value: minutes,
        }))))
            .addStringOption((option) => option
            .setName(TARGET_OPTION)
            .setDescription('Dónde enviar la prueba (por defecto, el canal de avisos)')
            .addChoices({ name: 'Canal de avisos', value: TARGET_CHANNEL }, { name: 'Mis mensajes privados (MD)', value: TARGET_DIRECT_MESSAGE })),
        async execute(interaction) {
            if (!(await ensureCanManageServer(interaction, icons)))
                return;
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const target = interaction.options.getString(TARGET_OPTION) ?? TARGET_CHANNEL;
            const offset = interaction.options.getInteger(OFFSET_OPTION) ?? DEFAULT_OFFSET_MINUTES;
            const next = deps.timeService.getNextOccurrence(deps.clock.now());
            const reminders = deps.timeService.getReminders(next);
            if (target === TARGET_DIRECT_MESSAGE) {
                // El contenido del MD no depende de la antelación: sirve cualquier aviso del KOTH.
                const [preview] = reminders;
                if (preview === undefined)
                    return;
                const outcome = await deps.messenger.sendPreview(interaction.user.id, preview);
                await interaction.editReply(outcome.kind === 'sent'
                    ? buildPreviewSentReply(icons)
                    : buildPreviewFailedReply(outcome, icons));
                return;
            }
            const reminder = reminders.find((candidate) => candidate.offsetMinutes === offset);
            if (reminder === undefined) {
                await interaction.editReply(buildReminderNotConfiguredMessage(offset, icons));
                return;
            }
            const announcer = new DiscordKothAnnouncer({
                client: interaction.client,
                channelId: deps.announcementChannelId,
                messageContext: deps.messageContext,
            });
            try {
                await announcer.publish(buildTestReminderMessage(reminder, deps.messageContext));
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                await interaction.editReply(buildTestFailedMessage(deps.announcementChannelId, reason, icons));
                return;
            }
            await interaction.editReply(buildTestPublishedMessage(reminder.offsetMinutes, deps.announcementChannelId, icons));
        },
    };
}
//# sourceMappingURL=koth-test.command.js.map