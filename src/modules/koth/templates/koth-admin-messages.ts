import { DateTime } from 'luxon';
import type { IconResolver } from '../../../shared/icons/icon-registry.js';
import { toDiscordTimestamp } from '../../../shared/utils/discord-timestamp.js';
import type { KothPauseState } from '../repositories/koth-pause-state.repository.js';

/**
 * Respuestas de los comandos de administración que apagan y encienden los avisos
 * (`/koth apagar` y `/koth encender`). Como en el resto de templates, los iconos se piden a `icons`.
 */

export function buildPausedReply(icons: IconResolver): string {
  return (
    `${icons.get('ban')} **Avisos apagados.** El bot sigue conectado y los comandos funcionan, ` +
    'pero no enviará avisos al canal ni MD a los suscriptores hasta que uses `/koth encender`.'
  );
}

export function buildAlreadyPausedReply(
  state: KothPauseState | undefined,
  icons: IconResolver,
): string {
  return (
    `${icons.get('ban')} Los avisos ya estaban apagados${describeSince(state)}. ` +
    'Usa `/koth encender` para reactivarlos.'
  );
}

export function buildResumedReply(icons: IconResolver): string {
  return (
    `${icons.get('circle-check')} **Avisos encendidos.** El bot vuelve a anunciar los KOTH. ` +
    'Los avisos que vencieron mientras estuvo apagado no se envían, salvo el de los últimos ' +
    'minutos si todavía está a tiempo.'
  );
}

export function buildAlreadyRunningReply(icons: IconResolver): string {
  return `${icons.get('circle-check')} Los avisos ya estaban encendidos.`;
}

/** " desde <t:…:R>" o cadena vacía si no se conoce la fecha. */
function describeSince(state: KothPauseState | undefined): string {
  if (state === undefined) return '';

  const changedAt = DateTime.fromISO(state.changedAt);
  return changedAt.isValid ? ` desde ${toDiscordTimestamp(changedAt, 'R')}` : '';
}
