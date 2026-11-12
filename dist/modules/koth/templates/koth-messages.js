import { EmbedBuilder } from 'discord.js';
import { toDiscordTimestamp } from '../../../shared/utils/discord-timestamp.js';
import { formatHourMinute, formatMinutes, formatRemainingTime, } from '../../../shared/utils/time.js';
import { KOTH_EMBED_COLORS } from '../domain/koth.constants.js';
/**
 * Un template por cada antelación. El tipo `Record` obliga a crear el template
 * de cualquier nueva antelación que se añada a `ReminderOffsetMinutes`.
 */
const REMINDER_TEMPLATES = {
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
export function buildReminderMessage(reminder, context) {
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
export function buildTestReminderMessage(reminder, context) {
    const { icons } = context;
    const lines = [
        `${icons.get('flask-conical')} **MENSAJE DE PRUEBA** — así se verá un aviso real (no es un evento)`,
        '',
        buildReminderBody(reminder, context),
    ];
    if (context.mentionEveryone) {
        lines.push('', `${icons.get('bell')} En un aviso real, aquí se mencionaría a todos: \`${EVERYONE_MENTIONS}\``);
    }
    return { content: lines.join('\n') };
}
function buildReminderBody(reminder, context) {
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
export function buildNextKothEmbed(occurrence, now, context) {
    const { startsAt, slot } = occurrence;
    const { icons } = context;
    return new EmbedBuilder()
        .setColor(KOTH_EMBED_COLORS.info)
        .setTitle(`${icons.get('swords')} Próximo KOTH: ${slot.name}`)
        .setDescription(`El próximo KOTH de **Boutcraft** comienza ${toDiscordTimestamp(startsAt, 'R')}.`)
        .addFields({
        name: `${icons.get('clock')} Hora de inicio`,
        value: `**${formatLocalTime(startsAt)}** (España)\n${toDiscordTimestamp(startsAt, 't')} en tu hora local`,
        inline: true,
    }, {
        name: `${icons.get('calendar')} Fecha`,
        value: toDiscordTimestamp(startsAt, 'D'),
        inline: true,
    }, {
        name: `${icons.get('hourglass')} Tiempo restante`,
        value: `${formatRemainingTime(now, startsAt)}\n(${toDiscordTimestamp(startsAt, 'R')})`,
        inline: true,
    }, {
        name: `${icons.get('calendar-days')} Fecha y hora completa`,
        value: toDiscordTimestamp(startsAt, 'F'),
    }, {
        name: `${icons.get('globe')} IP del servidor`,
        value: `\`${context.serverIp}\``,
    })
        .setFooter({ text: `Horario oficial: ${context.timezone}` })
        .setTimestamp(startsAt.toJSDate());
}
/** Respuesta de `/koth horarios`. */
export function buildScheduleEmbed(nextOccurrencePerSlot, reminderOffsetsMinutes, context) {
    const { icons } = context;
    return new EmbedBuilder()
        .setColor(KOTH_EMBED_COLORS.info)
        .setTitle(`${icons.get('calendar')} Horarios oficiales de KOTH · Boutcraft`)
        .setDescription([
        'Los KOTH se celebran **todos los días** en estos horarios (hora oficial de España).',
        `${icons.get('bell')} Avisos automáticos ${formatReminderOffsets(reminderOffsetsMinutes)} antes de cada evento.`,
    ].join('\n'))
        .addFields(...nextOccurrencePerSlot.map((occurrence) => ({
        name: `${icons.get('swords')} ${occurrence.slot.name}`,
        value: [
            `${icons.get('clock')} **${formatSlotTime(occurrence.slot)}** (España)`,
            `${icons.get('earth')} Tu hora: ${toDiscordTimestamp(occurrence.startsAt, 't')}`,
            `${icons.get('hourglass')} Próximo: ${toDiscordTimestamp(occurrence.startsAt, 'R')}`,
        ].join('\n'),
        inline: true,
    })), { name: `${icons.get('globe')} IP del servidor`, value: `\`${context.serverIp}\`` })
        .setFooter({ text: `Zona horaria oficial: ${context.timezone}` });
}
/** Respuestas de `/koth prueba`. */
export function buildNoPermissionMessage(icons) {
    return `${icons.get('ban')} Solo quien tenga el permiso **Gestionar servidor** puede usar este comando.`;
}
export function buildReminderNotConfiguredMessage(offsetMinutes, icons) {
    return `${icons.get('circle-x')} No hay un aviso configurado de ${offsetMinutes} minutos.`;
}
export function buildTestFailedMessage(channelId, reason, icons) {
    return (`${icons.get('circle-x')} No pude publicar en <#${channelId}>: ${reason}\n` +
        'Revisa que el bot tenga **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ese canal.');
}
export function buildTestPublishedMessage(offsetMinutes, channelId, icons) {
    return `${icons.get('circle-check')} Mensaje de prueba (aviso de ${offsetMinutes} min) publicado en <#${channelId}>.`;
}
function formatLocalTime(date) {
    return date.toFormat('HH:mm');
}
function formatSlotTime(slot) {
    return formatHourMinute(slot.hour, slot.minute);
}
/** [60, 30, 10] → "1 h, 30 min y 10 min" */
function formatReminderOffsets(offsets) {
    const labels = [...offsets].sort((a, b) => b - a).map(formatMinutes);
    const last = labels.pop();
    if (last === undefined)
        return '';
    return labels.length === 0 ? last : `${labels.join(', ')} y ${last}`;
}
//# sourceMappingURL=koth-messages.js.map