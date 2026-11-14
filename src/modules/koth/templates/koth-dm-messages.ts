import {
  ActionRowBuilder,
  type BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { DateTime } from 'luxon';
import { toComponentEmoji } from '../../../shared/icons/component-emoji.js';
import type { IconResolver } from '../../../shared/icons/icon-registry.js';
import { toDiscordTimestamp } from '../../../shared/utils/discord-timestamp.js';
import {
  KOTH_EMBED_COLORS,
  KOTH_SUBSCRIBE_BUTTON_ID,
  KOTH_UNSUBSCRIBE_BUTTON_ID,
} from '../domain/koth.constants.js';
import type { UndeliveredOutcome } from '../domain/koth.ports.js';
import type { KothReminder } from '../domain/koth.types.js';
import type { KothSubscriberRecord } from '../repositories/koth-subscriber.repository.js';
import type { PublishPanelResult } from '../services/koth-subscription-panel.service.js';
import type { SubscribeResult } from '../services/koth-subscription.service.js';
import type { MessageContext } from './koth-messages.js';

/**
 * Templates de los mensajes privados (MD), del panel de suscripción y de las respuestas de
 * los comandos y botones de suscripción. Como en `koth-messages.ts`, los iconos se piden
 * siempre a `icons`.
 */

/** Cómo darse de baja desde un MD: el comando solo funciona en el canal de suscripción. */
function describeHowToCancel(context: MessageContext): string {
  return context.subscriptionChannelId === null
    ? 'usa `/koth cancelar` en el servidor'
    : `usa \`/koth cancelar\` o el botón de <#${context.subscriptionChannelId}>`;
}

function buildUnsubscribeHint(context: MessageContext): string {
  return `Recibes este mensaje porque te suscribiste. Para dejar de recibirlo, ${describeHowToCancel(context)}.`;
}

/** Máximo de caracteres de la descripción de un embed (el límite de Discord es 4096). */
const EMBED_DESCRIPTION_BUDGET = 3_800;

// --- Mensajes privados ------------------------------------------------------

/** MD que se envía a los suscriptores cuando el KOTH está a punto de empezar. */
export function buildDirectReminderMessage(
  reminder: KothReminder,
  context: MessageContext,
): BaseMessageOptions {
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
    `-# ${icons.get('bell')} ${buildUnsubscribeHint(context)}`,
  ].join('\n');

  return { content };
}

/** Igual que el MD real, con un encabezado que lo identifica como prueba. */
export function buildDirectReminderPreviewMessage(
  reminder: KothReminder,
  context: MessageContext,
): BaseMessageOptions {
  const { content } = buildDirectReminderMessage(reminder, context);
  return {
    content: `${context.icons.get('flask-conical')} **MENSAJE DE PRUEBA** — así verán el MD los suscriptores\n\n${content ?? ''}`,
  };
}

/** MD de confirmación al suscribirse. Sirve además para comprobar que los MD están abiertos. */
export function buildSubscriptionConfirmationDm(context: MessageContext): BaseMessageOptions {
  const { icons } = context;
  return {
    content: [
      `${icons.get('circle-check')} **¡Listo, estás suscrito a los avisos de KOTH!**`,
      `Te escribiré por aquí unos minutos antes de que empiece cada KOTH de Boutcraft.`,
      '',
      `-# ${icons.get('bell')} Para dejar de recibirlos, ${describeHowToCancel(context)}.`,
    ].join('\n'),
  };
}

function describeVoiceChannel(context: MessageContext): string {
  return context.voiceChannelId === null
    ? 'el canal de voz del servidor'
    : `<#${context.voiceChannelId}>`;
}

// --- Panel de suscripción (mensaje con botones) -------------------------------

/**
 * Mensaje fijo del canal de suscripción: explica el servicio y ofrece los botones para
 * suscribirse y darse de baja.
 */
export function buildSubscriptionPanelMessage(context: MessageContext): BaseMessageOptions {
  const { icons } = context;

  const embed = new EmbedBuilder()
    .setColor(KOTH_EMBED_COLORS.info)
    .setTitle(`${icons.get('bell')} Avisos de KOTH por mensaje privado`)
    .setDescription(
      [
        'Suscríbete y el bot te escribirá por **MD** poco antes de que empiece cada KOTH, para que no se te pase.',
        '',
        `${icons.get('headset')} Te dirá qué KOTH va a empezar, cuánto falta y a qué call conectarte.`,
        `${icons.get('circle-check')} Solo recibirás MD si te suscribes aquí. Puedes darte de baja cuando quieras.`,
        '',
        `${icons.get('circle-x')} Necesitas tener abiertos los **mensajes directos** de este servidor. Si no, el bot no podrá escribirte.`,
      ].join('\n'),
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(KOTH_SUBSCRIBE_BUTTON_ID)
      .setLabel('Suscribirme')
      .setStyle(ButtonStyle.Success)
      .setEmoji(toComponentEmoji(icons.get('bell'))),
    new ButtonBuilder()
      .setCustomId(KOTH_UNSUBSCRIBE_BUTTON_ID)
      .setLabel('Cancelar suscripción')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(toComponentEmoji(icons.get('circle-x'))),
  );

  return { embeds: [embed], components: [buttons] };
}

// --- Respuestas de /koth suscribirme, /koth cancelar y sus botones ----------

/** Respuesta a suscribirse, la misma para el comando y para el botón. */
export function buildSubscribeResultReply(result: SubscribeResult, icons: IconResolver): string {
  switch (result.kind) {
    case 'subscribed':
      return buildSubscribedReply(icons);
    case 'already-subscribed':
      return buildAlreadySubscribedReply(icons);
    case 'dms-closed':
      return buildDmsClosedReply(icons);
    case 'unavailable':
      return buildSubscriptionUnavailableReply(icons);
  }
}

/** Respuesta a usar `/koth suscribirme` o `/koth cancelar` fuera del canal de suscripción. */
export function buildWrongChannelReply(channelId: string, icons: IconResolver): string {
  return `${icons.get('ban')} Este comando solo funciona en <#${channelId}>. Ve allí para suscribirte o darte de baja.`;
}

export function buildUnknownButtonReply(icons: IconResolver): string {
  return `${icons.get('circle-x')} Este botón ya no está disponible.`;
}

export function buildSubscribedReply(icons: IconResolver): string {
  return `${icons.get('circle-check')} Te has suscrito. Te escribiré por MD unos minutos antes de cada KOTH. Te acabo de enviar un mensaje de confirmación.`;
}

export function buildAlreadySubscribedReply(icons: IconResolver): string {
  return `${icons.get('bell')} Ya estabas suscrito. Si quieres dejar de recibir los MD, usa \`/koth cancelar\`.`;
}

export function buildDmsClosedReply(icons: IconResolver): string {
  return (
    `${icons.get('circle-x')} No he podido escribirte por MD, así que no te he suscrito.\n` +
    'Activa **Mensajes directos** en la configuración de privacidad de este servidor ' +
    '(clic derecho en el servidor → Ajustes de privacidad) y vuelve a intentarlo.'
  );
}

export function buildSubscriptionUnavailableReply(icons: IconResolver): string {
  return `${icons.get('circle-x')} Discord no me ha dejado enviarte el mensaje ahora mismo. Inténtalo de nuevo en unos minutos.`;
}

export function buildUnsubscribedReply(icons: IconResolver): string {
  return `${icons.get('circle-check')} Te has dado de baja. Ya no recibirás los MD de KOTH.`;
}

export function buildNotSubscribedReply(icons: IconResolver): string {
  return `${icons.get('bell')} No estabas suscrito, así que no hay nada que cancelar.`;
}

// --- Respuestas de /koth suscriptores y /koth quitar (administradores) ------

/**
 * Lista de suscriptores como embeds, cada uno dentro del límite de caracteres de
 * Discord. Se envía un embed por mensaje.
 */
export function buildSubscribersEmbeds(
  subscribers: readonly KothSubscriberRecord[],
  context: Pick<MessageContext, 'icons'>,
): EmbedBuilder[] {
  const { icons } = context;
  const lines = subscribers.map(
    (subscriber, index) =>
      `${index + 1}. <@${subscriber.userId}> · desde ${formatSubscriptionDate(subscriber.subscribedAt)}`,
  );
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

export function buildNoSubscribersReply(icons: IconResolver): string {
  return `${icons.get('users')} Todavía no hay nadie suscrito a los MD de KOTH.`;
}

export function buildSubscriberRemovedReply(userId: string, icons: IconResolver): string {
  return `${icons.get('circle-check')} He quitado a <@${userId}> de los MD de KOTH.`;
}

export function buildSubscriberNotFoundReply(userId: string, icons: IconResolver): string {
  return `${icons.get('circle-x')} <@${userId}> no estaba suscrito.`;
}

// --- Respuestas de /koth panel ----------------------------------------------

export function buildPanelNotConfiguredReply(icons: IconResolver): string {
  return (
    `${icons.get('circle-x')} No hay un canal de suscripción configurado. ` +
    'Define `DISCORD_SUBSCRIPTION_CHANNEL_ID` y reinicia el bot.'
  );
}

export function buildPanelPublishedReply(
  kind: PublishPanelResult['kind'],
  channelId: string,
  icons: IconResolver,
): string {
  const action = kind === 'created' ? 'publicado' : 'actualizado';
  return `${icons.get('circle-check')} Panel de suscripción ${action} en <#${channelId}>.`;
}

export function buildPanelFailedReply(
  channelId: string,
  reason: string,
  icons: IconResolver,
): string {
  return (
    `${icons.get('circle-x')} No pude publicar el panel en <#${channelId}>: ${reason}\n` +
    'Revisa que el bot tenga **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ese canal.'
  );
}

// --- Respuestas de /koth prueba destino:md ----------------------------------

export function buildPreviewSentReply(icons: IconResolver): string {
  return `${icons.get('circle-check')} Te he enviado el MD de prueba. Así lo verán los suscriptores.`;
}

export function buildPreviewFailedReply(outcome: UndeliveredOutcome, icons: IconResolver): string {
  const reason =
    outcome.kind === 'dms-closed'
      ? 'Tienes los MD cerrados para este servidor.'
      : 'Discord no me ha dejado enviarlo ahora mismo.';
  return `${icons.get('circle-x')} No he podido enviarte el MD de prueba. ${reason}`;
}

// --- Utilidades --------------------------------------------------------------

function formatSubscriptionDate(subscribedAtIso: string): string {
  const date = DateTime.fromISO(subscribedAtIso);
  return date.isValid ? toDiscordTimestamp(date, 'd') : subscribedAtIso;
}

/** Reparte las líneas en páginas que no superen `budget` caracteres. */
function splitIntoPages(lines: readonly string[], budget: number): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
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
  if (current.length > 0) pages.push(current);

  return pages;
}
