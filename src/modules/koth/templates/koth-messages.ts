import { type BaseMessageOptions, EmbedBuilder } from 'discord.js';
import type { DateTime } from 'luxon';
import { toDiscordTimestamp } from '../../../shared/utils/discord-timestamp.js';
import {
  formatHourMinute,
  formatMinutes,
  formatRemainingTime,
} from '../../../shared/utils/time.js';
import { KOTH_EMBED_COLORS } from '../domain/koth.constants.js';
import type {
  KothOccurrence,
  KothReminder,
  KothSlot,
  ReminderOffsetMinutes,
} from '../domain/koth.types.js';

/**
 * Templates de todos los mensajes del módulo KOTH.
 * Para cambiar textos, emojis o colores, este es el único archivo a modificar.
 */

export interface MessageContext {
  readonly serverIp: string;
  /** Añade "@everyone @here" al final de los avisos y permite que notifiquen. */
  readonly mentionEveryone: boolean;
  readonly timezone: string;
}

interface ReminderTemplate {
  readonly headline: (eventName: string) => string;
  readonly callToAction: string;
}

/**
 * Un template por cada antelación. El tipo `Record` obliga a crear el template
 * de cualquier nueva antelación que se añada a `ReminderOffsetMinutes`.
 */
const REMINDER_TEMPLATES: Record<ReminderOffsetMinutes, ReminderTemplate> = {
  60: {
    headline: (eventName) => `⚔️ **¡${eventName} en Boutcraft dentro de 1 hora!**`,
    callToAction: 'Prepara tu kit y reúne a tu equipo: la colina se disputa muy pronto.',
  },
  30: {
    headline: (eventName) => `🛡️ **¡${eventName} en Boutcraft dentro de 30 minutos!**`,
    callToAction: 'Equípate y ve acercándote a la zona. ¡Que no te quiten la colina!',
  },
  10: {
    headline: (eventName) => `🔥 **¡${eventName} en Boutcraft empieza en 10 minutos!**`,
    callToAction: '¡Última llamada! Entra ya al servidor y toma posiciones.',
  },
};

/** Aviso automático publicado en el canal de anuncios. */
export function buildReminderMessage(
  reminder: KothReminder,
  context: MessageContext,
): BaseMessageOptions {
  const body = buildReminderBody(reminder, context);

  if (!context.mentionEveryone) {
    return { content: body };
  }

  return {
    content: `${body}\n\n${EVERYONE_MENTIONS}`,
    // Solo se permite notificar a @everyone/@here; cualquier otra mención sigue bloqueada.
    allowedMentions: { parse: ['everyone'] },
  };
}

/**
 * Igual que un aviso real, pero con un encabezado que lo identifica como prueba.
 * Las menciones se muestran como texto (en código) y NO notifican a nadie.
 */
export function buildTestReminderMessage(
  reminder: KothReminder,
  context: MessageContext,
): BaseMessageOptions {
  const lines = [
    '🧪 **MENSAJE DE PRUEBA** — así se verá un aviso real (no es un evento)',
    '',
    buildReminderBody(reminder, context),
  ];

  if (context.mentionEveryone) {
    lines.push('', `${TEST_MENTIONS_NOTE}: \`${EVERYONE_MENTIONS}\``);
  }

  return { content: lines.join('\n') };
}

const EVERYONE_MENTIONS = '@everyone @here';
const TEST_MENTIONS_NOTE = '🔔 En un aviso real, aquí se mencionaría a todos';

function buildReminderBody(reminder: KothReminder, context: MessageContext): string {
  const template = REMINDER_TEMPLATES[reminder.offsetMinutes];
  const { startsAt, slot } = reminder.occurrence;

  return [
    template.headline(slot.name),
    template.callToAction,
    '',
    `📅 **Fecha:** ${toDiscordTimestamp(startsAt, 'F')}`,
    `⏳ **Comienza:** ${toDiscordTimestamp(startsAt, 'R')}`,
    `🕐 **Hora oficial (España):** ${formatLocalTime(startsAt)}`,
    `🌐 **IP:** \`${context.serverIp}\``,
  ].join('\n');
}

/** Respuesta de `/koth siguiente`. */
export function buildNextKothEmbed(
  occurrence: KothOccurrence,
  now: DateTime,
  context: MessageContext,
): EmbedBuilder {
  const { startsAt, slot } = occurrence;

  return new EmbedBuilder()
    .setColor(KOTH_EMBED_COLORS.info)
    .setTitle(`⚔️ Próximo KOTH: ${slot.name}`)
    .setDescription(
      `El próximo KOTH de **Boutcraft** comienza ${toDiscordTimestamp(startsAt, 'R')}.`,
    )
    .addFields(
      {
        name: '🕐 Hora de inicio',
        value: `**${formatLocalTime(startsAt)}** (España)\n${toDiscordTimestamp(startsAt, 't')} en tu hora local`,
        inline: true,
      },
      {
        name: '📅 Fecha',
        value: toDiscordTimestamp(startsAt, 'D'),
        inline: true,
      },
      {
        name: '⏳ Tiempo restante',
        value: `${formatRemainingTime(now, startsAt)}\n(${toDiscordTimestamp(startsAt, 'R')})`,
        inline: true,
      },
      {
        name: '🗓️ Fecha y hora completa',
        value: toDiscordTimestamp(startsAt, 'F'),
      },
      {
        name: '🌐 IP del servidor',
        value: `\`${context.serverIp}\``,
      },
    )
    .setFooter({ text: `Horario oficial: ${context.timezone}` })
    .setTimestamp(startsAt.toJSDate());
}

/** Respuesta de `/koth horarios`. */
export function buildScheduleEmbed(
  nextOccurrencePerSlot: readonly KothOccurrence[],
  reminderOffsetsMinutes: readonly ReminderOffsetMinutes[],
  context: MessageContext,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(KOTH_EMBED_COLORS.info)
    .setTitle('📅 Horarios oficiales de KOTH · Boutcraft')
    .setDescription(
      [
        'Los KOTH se celebran **todos los días** en estos horarios (hora oficial de España).',
        `🔔 Avisos automáticos ${formatReminderOffsets(reminderOffsetsMinutes)} antes de cada evento.`,
      ].join('\n'),
    )
    .addFields(
      ...nextOccurrencePerSlot.map((occurrence) => ({
        name: `⚔️ ${occurrence.slot.name}`,
        value: [
          `🕐 **${formatSlotTime(occurrence.slot)}** (España)`,
          `🌍 Tu hora: ${toDiscordTimestamp(occurrence.startsAt, 't')}`,
          `⏳ Próximo: ${toDiscordTimestamp(occurrence.startsAt, 'R')}`,
        ].join('\n'),
        inline: true,
      })),
      { name: '🌐 IP del servidor', value: `\`${context.serverIp}\`` },
    )
    .setFooter({ text: `Zona horaria oficial: ${context.timezone}` });
}

function formatLocalTime(date: DateTime): string {
  return date.toFormat('HH:mm');
}

function formatSlotTime(slot: KothSlot): string {
  return formatHourMinute(slot.hour, slot.minute);
}

/** [60, 30, 10] → "1 h, 30 min y 10 min" */
function formatReminderOffsets(offsets: readonly ReminderOffsetMinutes[]): string {
  const labels = [...offsets].sort((a, b) => b - a).map(formatMinutes);
  const last = labels.pop();
  if (last === undefined) return '';
  return labels.length === 0 ? last : `${labels.join(', ')} y ${last}`;
}
