import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import type { UndeliveredOutcome } from '../domain/koth.ports.js';

/**
 * Traduce un error de Discord a un resultado de dominio. Así el resto del módulo
 * trata los fallos esperables (MD cerrados, usuario que se fue) como datos, no
 * como excepciones.
 *
 * Los límites de peticiones (HTTP 429) los gestiona discord.js esperando; el código
 * 40003 es el aviso específico de Discord por abrir demasiados MD seguidos.
 */
export function classifyDirectMessageError(error: unknown): UndeliveredOutcome {
  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      // 50007 (MD cerrados o bot bloqueado) y 50278 ("sin servidores en común"): Discord devuelve
      // este último cuando la privacidad del usuario no permite MD desde el servidor, aunque ambos
      // estén en él. Para el bot es lo mismo: no se puede escribir a esa persona.
      case RESTJSONErrorCodes.CannotSendMessagesToThisUser:
      case RESTJSONErrorCodes.CannotSendMessagesToThisUserDueToHavingNoMutualGuilds:
        return { kind: 'dms-closed' };
      case RESTJSONErrorCodes.OpeningDirectMessagesTooFast:
        return { kind: 'rate-limited' };
      case RESTJSONErrorCodes.UnknownMember:
      case RESTJSONErrorCodes.UnknownUser:
        return { kind: 'not-member' };
      default:
        break;
    }
  }
  return { kind: 'failed', error };
}
