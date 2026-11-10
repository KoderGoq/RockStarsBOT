import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { SlashSubcommand } from '../../../shared/types/command.js';
import type { ReminderOffsetMinutes } from '../domain/koth.types.js';
import { DiscordKothAnnouncer } from '../services/koth-notification.service.js';
import { buildTestReminderMessage } from '../templates/koth-messages.js';
import type { KothCommandDependencies } from './koth-command.dependencies.js';

const OFFSET_OPTION = 'aviso';
const DEFAULT_OFFSET_MINUTES: ReminderOffsetMinutes = 60;

/**
 * `/koth prueba [aviso]`: publica en el canal de avisos un mensaje de ejemplo con
 * el formato real. Solo para quien tenga "Gestionar servidor". No usa la base de
 * datos, por lo que no interfiere con los avisos reales.
 */
export function createKothTestSubcommand(deps: KothCommandDependencies): SlashSubcommand {
  return {
    name: 'prueba',
    description: 'Publica un mensaje de prueba en el canal de avisos (solo administradores)',
    configure: (builder) =>
      builder.addIntegerOption((option) =>
        option
          .setName(OFFSET_OPTION)
          .setDescription('Qué aviso simular (por defecto, el de 1 hora)')
          .addChoices(
            ...deps.timeService.reminderOffsetsMinutes.map((minutes) => ({
              name: `${minutes} minutos antes`,
              value: minutes,
            })),
          ),
      ),

    async execute(interaction) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: '⛔ Solo quien tenga el permiso **Gestionar servidor** puede usar este comando.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const offset = interaction.options.getInteger(OFFSET_OPTION) ?? DEFAULT_OFFSET_MINUTES;
      const next = deps.timeService.getNextOccurrence(deps.clock.now());
      const reminder = deps.timeService
        .getReminders(next)
        .find((candidate) => candidate.offsetMinutes === offset);
      if (reminder === undefined) {
        await interaction.editReply(`❌ No hay un aviso configurado de ${offset} minutos.`);
        return;
      }

      const announcer = new DiscordKothAnnouncer({
        client: interaction.client,
        channelId: deps.announcementChannelId,
        messageContext: deps.messageContext,
      });

      try {
        await announcer.publish(buildTestReminderMessage(reminder, deps.messageContext));
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        await interaction.editReply(
          `❌ No pude publicar en <#${deps.announcementChannelId}>: ${reason}\n` +
            'Revisa que el bot tenga **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ese canal.',
        );
        return;
      }

      await interaction.editReply(
        `✅ Mensaje de prueba (aviso de ${offset} min) publicado en <#${deps.announcementChannelId}>.`,
      );
    },
  };
}
