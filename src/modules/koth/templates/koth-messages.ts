import { type BaseMessageOptions, EmbedBuilder } from 'discord.js';
import type { DateTime } from 'luxon';
import type { IconName } from '../../../shared/icons/icon-catalog.js';
import type { IconResolver } from '../../../shared/icons/icon-registry.js';
import { toDiscordTimestamp } from '../../../shared/utils/discord-timestamp.js';
import { joinWithAnd } from '../../../shared/utils/text.js';
import {
  formatHourMinute,
  formatMinutes,
  formatRemainingTime,
} from '../../../shared/utils/time.js';
import { ALL_WEEKDAYS, KOTH_EMBED_COLORS } from '../domain/koth.constants.js';
import type {
  KothOccurrence,
  KothReminder,
  KothSlot,
  ReminderOffsetMinutes,
  Weekday,
} from '../domain/koth.types.js';

/**
 * Templates de los avisos del canal y de los comandos informativos del módulo KOTH.
 * Los mensajes privados y los comandos de suscripción están en `koth-dm-messages.ts`.
 * Para cambiar textos, iconos o colores, edita estos dos archivos.
 *
 * Los iconos son iconos de Lucide (ver `shared/icons/icon-catalog.ts`) y se
 * obtienen siempre a través de `context.icons`, nunca como emojis literales.
 */

export interface MessageContext {
  readonly serverIp: string;
  /** Añade "@everyone @here" al final de los avisos y permite que notifiquen. */
  readonly mentionEveryone: boolean;
  readonly timezone: string;
  readonly icons: IconResolver;
  /** Canal de voz ("el call") al que se invita a conectarse en los MD; `null` si no se ha configurado. */
  readonly voiceChannelId: string | null;
  /** Canal exclusivo de suscripción; `null` si no se ha configurado (entonces no hay restricción). */
  readonly subscriptionChannelId: string | null;
}

interface ReminderTemplate {
  readonly icon: IconName;
  readonly headline: (eventName: string) => string;
  readonly callToAction: string;
}

/**
 * Un template por cada antelación. El tipo `Record` obliga a crear el template
 * de cualquier nueva antelación que se añada a `ReminderOffsetMinutes`.
 */
const REMINDER_TEMPLATES: Record<ReminderOffsetMinutes, ReminderTemplate> = {
  60: {
    icon: 'swords',
    headline: (eventName) => `**¡${eventName} en Boutcraft dentro de 1 hora!**`,
    callToAction: 'Vayanse Conectado malditos lambe wesos.',
  },
  30: {
    icon: 'shield',
    headline: (eventName) => `**¡${eventName} en Boutcraft dentro de 30 minutos!**`,
    callToAction: 'Vengan a darle yupi a la negra de Staylux',
  },
  10: {
    icon: 'flame',
    headline: (eventName) => `**¡${eventName} en Boutcraft empieza en 10 minutos!**`,
    callToAction: '¡Última llamada! Conectense malditos vecenos y marroquies de kagada.',
  },
};

const EVERYONE_MENTIONS = '@everyone @here';

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
  const { icons } = context;
  const lines = [
    `${icons.get('flask-conical')} **MENSAJE DE PRUEBA** — así se verá un aviso real (no es un evento)`,
    '',
    buildReminderBody(reminder, context),
  ];

  if (context.mentionEveryone) {
    lines.push(
      '',
      `${icons.get('bell')} En un aviso real, aquí se mencionaría a todos: \`${EVERYONE_MENTIONS}\``,
    );
  }

  return { content: lines.join('\n') };
}

function buildReminderBody(reminder: KothReminder, context: MessageContext): string {
  const { icons } = context;
  const template = REMINDER_TEMPLATES[reminder.offsetMinutes];
  const { startsAt, slot } = reminder.occurrence;

  return [
    `${icons.get(template.icon)} ${template.headline(slot.name)}`,
    template.callToAction,
    '',
    `${icons.get('calendar')} **Fecha:** ${toDiscordTimestamp(startsAt, 'F')}`,
    `${icons.get('hourglass')} **Comienza:** ${toDiscordTimestamp(startsAt, 'R')}`,
    `${icons.get('clock')} **Hora oficial (España):** ${formatLocalTime(startsAt)}`,
    `${icons.get('globe')} **IP:** \`${context.serverIp}\``,
  ].join('\n');
}

/** Respuesta de `/koth siguiente`. */
export function buildNextKothEmbed(
  occurrence: KothOccurrence,
  now: DateTime,
  context: MessageContext,
): EmbedBuilder {
  const { startsAt, slot } = occurrence;
  const { icons } = context;

  return new EmbedBuilder()
    .setColor(KOTH_EMBED_COLORS.info)
    .setTitle(`${icons.get('swords')} Próximo KOTH: ${slot.name}`)
    .setDescription(
      `El próximo KOTH de **Boutcraft** comienza ${toDiscordTimestamp(startsAt, 'R')}.`,
    )
    .addFields(
      {
        name: `${icons.get('clock')} Hora de inicio`,
        value: `**${formatLocalTime(startsAt)}** (España)\n${toDiscordTimestamp(startsAt, 't')} en tu hora local`,
        inline: true,
      },
      {
        name: `${icons.get('calendar')} Fecha`,
        value: toDiscordTimestamp(startsAt, 'D'),
        inline: true,
      },
      {
        name: `${icons.get('hourglass')} Tiempo restante`,
        value: `${formatRemainingTime(now, startsAt)}\n(${toDiscordTimestamp(startsAt, 'R')})`,
        inline: true,
      },
      {
        name: `${icons.get('calendar-days')} Fecha y hora completa`,
        value: toDiscordTimestamp(startsAt, 'F'),
      },
      {
        name: `${icons.get('globe')} IP del servidor`,
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
  const { icons } = context;

  return new EmbedBuilder()
    .setColor(KOTH_EMBED_COLORS.info)
    .setTitle(`${icons.get('calendar')} Horarios oficiales de KOTH · Boutcraft`)
    .setDescription(
      [
        'Horarios oficiales de los KOTH (hora de España). Cada KOTH indica los días en que se celebra.',
        `${icons.get('bell')} Avisos automáticos ${formatReminderOffsets(reminderOffsetsMinutes)} antes de cada evento.`,
      ].join('\n'),
    )
    .addFields(
      ...nextOccurrencePerSlot.map((occurrence) => ({
        name: `${icons.get('swords')} ${occurrence.slot.name}`,
        value: [
          `${icons.get('clock')} **${formatSlotTime(occurrence.slot)}** (España)`,
          `${icons.get('calendar')} ${describeDays(occurrence.slot.days)}`,
          `${icons.get('earth')} Tu hora: ${toDiscordTimestamp(occurrence.startsAt, 't')}`,
          `${icons.get('hourglass')} Próximo: ${toDiscordTimestamp(occurrence.startsAt, 'R')}`,
        ].join('\n'),
        inline: true,
      })),
      { name: `${icons.get('globe')} IP del servidor`, value: `\`${context.serverIp}\`` },
    )
    .setFooter({ text: `Zona horaria oficial: ${context.timezone}` });
}

/** Respuestas de `/koth prueba`. */

export function buildNoPermissionMessage(icons: IconResolver): string {
  return `${icons.get('ban')} Solo quien tenga el permiso **Gestionar servidor** puede usar este comando.`;
}

export function buildReminderNotConfiguredMessage(
  offsetMinutes: number,
  icons: IconResolver,
): string {
  return `${icons.get('circle-x')} No hay un aviso configurado de ${offsetMinutes} minutos.`;
}

export function buildTestFailedMessage(
  channelId: string,
  reason: string,
  icons: IconResolver,
): string {
  return (
    `${icons.get('circle-x')} No pude publicar en <#${channelId}>: ${reason}\n` +
    'Revisa que el bot tenga **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ese canal.'
  );
}

export function buildTestPublishedMessage(
  offsetMinutes: number,
  channelId: string,
  icons: IconResolver,
): string {
  return `${icons.get('circle-check')} Mensaje de prueba (aviso de ${offsetMinutes} min) publicado en <#${channelId}>.`;
}

function formatLocalTime(date: DateTime): string {
  return date.toFormat('HH:mm');
}

function formatSlotTime(slot: KothSlot): string {
  return formatHourMinute(slot.hour, slot.minute);
}

/** [60, 30, 10] → "1 h, 30 min y 10 min" */
function formatReminderOffsets(offsets: readonly ReminderOffsetMinutes[]): string {
  return joinWithAnd([...offsets].sort((a, b) => b - a).map(formatMinutes));
}

const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
};

/** Todos → "Todos los días" · casi todos → "Todos los días excepto sábado" · pocos → "lunes y jueves". */
function describeDays(days: readonly Weekday[]): string {
  const missing = ALL_WEEKDAYS.filter((day) => !days.includes(day));
  if (missing.length === 0) return 'Todos los días';
  if (missing.length <= 3) {
    return `Todos los días excepto ${joinWithAnd(missing.map((day) => WEEKDAY_NAMES[day]))}`;
  }
  return joinWithAnd(
    ALL_WEEKDAYS.filter((day) => days.includes(day)).map((day) => WEEKDAY_NAMES[day]),
  );
}
