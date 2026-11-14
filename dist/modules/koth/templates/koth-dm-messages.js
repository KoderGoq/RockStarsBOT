import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { toDiscordTimestamp } from '../../../shared/utils/discord-timestamp.js';
import { KOTH_EMBED_COLORS } from '../domain/koth.constants.js';
/**
 * Templates de los mensajes privados (MD) y de las respuestas de los comandos de
 * suscripción. Como en `koth-messages.ts`, los iconos se piden siempre a `icons`.
 */
const UNSUBSCRIBE_HINT = 'Recibes este mensaje porque te suscribiste. Para dejar de recibirlo, usa `/koth cancelar` en el servidor.';
/** Máximo de caracteres de la descripción de un embed (el límite de Discord es 4096). */
const EMBED_DESCRIPTION_BUDGET = 3_800;
// --- Mensajes privados ------------------------------------------------------
/** MD que se envía a los suscriptores cuando el KOTH está a punto de empezar. */
export function buildDirectReminderMessage(reminder, context) {
    const { icons } = context;
    const { startsAt, slot } = reminder.occurrence;
    // El titular no dice "en 10 minutos" a propósito: si el MD se envía con algo de
    // retraso, la cuenta atrás de Discord sigue siendo exacta.
    const content = [
        `${icons.get('swords')} **¡${slot.name} está a punto de empezar!**`,
        `${icons.get('headset')} **Conéctate ya al call:** ${describeVoiceChannel(context)}`,
        '',
        `${icons.get('hourglass')} **Comienza:** ${toDiscordTimestamp(startsAt, 'R')}`,
        `${icons.get('calendar')} **Hora:** ${toDiscordTimestamp(startsAt, 'F')}`,
        `${icons.get('globe')} **IP:** \`${context.serverIp}\``,
        '',
        `-# ${icons.get('bell')} ${UNSUBSCRIBE_HINT}`,
    ].join('\n');
    return { content };
}
/** Igual que el MD real, con un encabezado que lo identifica como prueba. */
export function buildDirectReminderPreviewMessage(reminder, context) {
    const { content } = buildDirectReminderMessage(reminder, context);
    return {
        content: `${context.icons.get('flask-conical')} **MENSAJE DE PRUEBA** — así verán el MD los suscriptores\n\n${content ?? ''}`,
    };
}
/** MD de confirmación al suscribirse. Sirve además para comprobar que los MD están abiertos. */
export function buildSubscriptionConfirmationDm(context) {
    const { icons } = context;
    return {
        content: [
            `${icons.get('circle-check')} **¡Listo, estás suscrito a los avisos de KOTH!**`,
            `Te escribiré por aquí unos minutos antes de que empiece cada KOTH de Boutcraft.`,
            '',
            `-# ${icons.get('bell')} Para dejar de recibirlos, usa \`/koth cancelar\` en el servidor.`,
        ].join('\n'),
    };
}
function describeVoiceChannel(context) {
    return context.voiceChannelId === null
        ? 'el canal de voz del servidor'
        : `<#${context.voiceChannelId}>`;
}
// --- Respuestas de /koth suscribirme y /koth cancelar -----------------------
export function buildSubscribedReply(icons) {
    return `${icons.get('circle-check')} Te has suscrito. Te escribiré por MD unos minutos antes de cada KOTH. Te acabo de enviar un mensaje de confirmación.`;
}
export function buildAlreadySubscribedReply(icons) {
    return `${icons.get('bell')} Ya estabas suscrito. Si quieres dejar de recibir los MD, usa \`/koth cancelar\`.`;
}
export function buildDmsClosedReply(icons) {
    return (`${icons.get('circle-x')} No he podido escribirte por MD, así que no te he suscrito.\n` +
        'Activa **Mensajes directos** en la configuración de privacidad de este servidor ' +
        '(clic derecho en el servidor → Ajustes de privacidad) y vuelve a intentarlo.');
}
export function buildSubscriptionUnavailableReply(icons) {
    return `${icons.get('circle-x')} Discord no me ha dejado enviarte el mensaje ahora mismo. Inténtalo de nuevo en unos minutos.`;
}
export function buildUnsubscribedReply(icons) {
    return `${icons.get('circle-check')} Te has dado de baja. Ya no recibirás los MD de KOTH.`;
}
export function buildNotSubscribedReply(icons) {
    return `${icons.get('bell')} No estabas suscrito, así que no hay nada que cancelar.`;
}
// --- Respuestas de /koth suscriptores y /koth quitar (administradores) ------
/**
 * Lista de suscriptores como embeds, cada uno dentro del límite de caracteres de
 * Discord. Se envía un embed por mensaje.
 */
export function buildSubscribersEmbeds(subscribers, context) {
    const { icons } = context;
    const lines = subscribers.map((subscriber, index) => `${index + 1}. <@${subscriber.userId}> · desde ${formatSubscriptionDate(subscriber.subscribedAt)}`);
    const pages = splitIntoPages(lines, EMBED_DESCRIPTION_BUDGET);
    return pages.map((page, index) => {
        const embed = new EmbedBuilder()
            .setColor(KOTH_EMBED_COLORS.info)
            .setDescription(page.join('\n'))
            .setFooter({
            text: `${subscribers.length} suscriptor${subscribers.length === 1 ? '' : 'es'} · página ${index + 1} de ${pages.length}`,
        });
        if (index === 0) {
            embed.setTitle(`${icons.get('users')} Suscriptores de los MD de KOTH`);
        }
        return embed;
    });
}
export function buildNoSubscribersReply(icons) {
    return `${icons.get('users')} Todavía no hay nadie suscrito a los MD de KOTH.`;
}
export function buildSubscriberRemovedReply(userId, icons) {
    return `${icons.get('circle-check')} He quitado a <@${userId}> de los MD de KOTH.`;
}
export function buildSubscriberNotFoundReply(userId, icons) {
    return `${icons.get('circle-x')} <@${userId}> no estaba suscrito.`;
}
// --- Respuestas de /koth prueba destino:md ----------------------------------
export function buildPreviewSentReply(icons) {
    return `${icons.get('circle-check')} Te he enviado el MD de prueba. Así lo verán los suscriptores.`;
}
export function buildPreviewFailedReply(outcome, icons) {
    const reason = outcome.kind === 'dms-closed'
        ? 'Tienes los MD cerrados para este servidor.'
        : 'Discord no me ha dejado enviarlo ahora mismo.';
    return `${icons.get('circle-x')} No he podido enviarte el MD de prueba. ${reason}`;
}
// --- Utilidades --------------------------------------------------------------
function formatSubscriptionDate(subscribedAtIso) {
    const date = DateTime.fromISO(subscribedAtIso);
    return date.isValid ? toDiscordTimestamp(date, 'd') : subscribedAtIso;
}
/** Reparte las líneas en páginas que no superen `budget` caracteres. */
function splitIntoPages(lines, budget) {
    const pages = [];
    let current = [];
    let currentLength = 0;
    for (const line of lines) {
        const lineLength = line.length + 1;
        if (current.length > 0 && currentLength + lineLength > budget) {
            pages.push(current);
            current = [];
            currentLength = 0;
        }
        current.push(line);
        currentLength += lineLength;
    }
    if (current.length > 0)
        pages.push(current);
    return pages;
}
//# sourceMappingURL=koth-dm-messages.js.map