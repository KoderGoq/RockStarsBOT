import type { DateTime } from 'luxon';
import type { DeliveryStatus, UndeliveredStatus } from '../domain/koth.constants.js';

/**
 * Registro de los MD enviados: un registro por (aviso, usuario). Es la fuente de
 * verdad para no enviar nunca el mismo MD dos veces, ni siquiera tras un reinicio.
 */
export interface KothDmDeliveryRepository {
  /**
   * Reserva atómicamente el MD de un usuario antes de enviarlo.
   * Devuelve `false` si ya estaba registrado (enviado, fallido o en curso).
   */
  tryClaim(reminderKey: string, userId: string, eventStartsAt: DateTime, now: DateTime): boolean;

  markSent(reminderKey: string, userId: string, messageId: string, now: DateTime): void;

  /** Cierra una reserva sin entrega (MD cerrados, usuario fuera del servidor, error). */
  markUndelivered(
    reminderKey: string,
    userId: string,
    status: UndeliveredStatus,
    now: DateTime,
  ): void;

  /** Libera una reserva para poder reintentarla (p. ej. si Discord pidió frenar). */
  release(reminderKey: string, userId: string): void;

  findStatus(reminderKey: string, userId: string): DeliveryStatus | undefined;

  /** Suscriptores a los que todavía no se ha intentado enviar este aviso. */
  listPendingUserIds(reminderKey: string): string[];

  /** Elimina el historial de eventos anteriores a `cutoff`. Devuelve las filas borradas. */
  deleteEventsBefore(cutoff: DateTime): number;
}
