import type { KothReminder } from './koth.types.js';

export interface AnnouncementResult {
  readonly messageId: string;
}

/**
 * Puerto de salida para publicar avisos.
 * El scheduler depende de esta interfaz, no de Discord.
 */
export interface KothAnnouncer {
  announce(reminder: KothReminder): Promise<AnnouncementResult>;
}

/** Resultado de intentar escribir un MD. Los fallos esperables no son excepciones. */
export type DirectMessageOutcome =
  | { readonly kind: 'sent'; readonly messageId: string }
  /** El usuario ya no está en el servidor (o su cuenta no existe). */
  | { readonly kind: 'not-member' }
  /** Tiene los MD cerrados o bloqueó al bot. Discord no permite saltarse esto. */
  | { readonly kind: 'dms-closed' }
  /** Discord pide frenar el envío de MD; conviene reintentar más tarde. */
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'failed'; readonly error: unknown };

export type UndeliveredOutcome = Exclude<DirectMessageOutcome, { readonly kind: 'sent' }>;

/**
 * Puerto de salida para escribir MD a los suscriptores.
 * Ninguno de sus métodos lanza: siempre devuelven un `DirectMessageOutcome`.
 */
export interface KothDirectMessenger {
  /** MD del aviso real. Comprueba antes que el usuario sigue en el servidor. */
  sendReminder(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome>;
  /** Mismo MD marcado como prueba (para `/koth prueba destino:md`). */
  sendPreview(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome>;
  /** MD de confirmación al suscribirse; además comprueba que los MD están abiertos. */
  sendSubscriptionConfirmation(userId: string): Promise<DirectMessageOutcome>;
}
