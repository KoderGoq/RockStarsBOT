import type { DateTime } from 'luxon';
import type { NotificationStatus, SkipReason } from '../domain/koth.constants.js';
import type { KothReminder } from '../domain/koth.types.js';

export interface KothNotificationRecord {
  readonly key: string;
  readonly slotId: string;
  /** Inicio del KOTH en UTC ISO. */
  readonly eventStartsAt: string;
  readonly offsetMinutes: number;
  readonly status: NotificationStatus;
  readonly skipReason: string | null;
  readonly messageId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Registro persistente de avisos. Es la fuente de verdad para evitar duplicados,
 * incluso entre reinicios o con varias instancias compartiendo la base de datos.
 */
export interface KothNotificationRepository {
  /**
   * Reserva atómicamente un aviso antes de enviarlo.
   * Devuelve `false` si ya estaba registrado (enviado, omitido o en curso).
   */
  tryClaim(reminder: KothReminder, now: DateTime): boolean;

  /** Confirma el envío de un aviso reservado. */
  markSent(key: string, messageId: string, now: DateTime): void;

  /** Libera una reserva cuyo envío falló, para poder reintentarlo. */
  release(key: string): void;

  /** Registra un aviso como omitido. Devuelve `false` si ya estaba registrado. */
  recordSkipped(reminder: KothReminder, reason: SkipReason, now: DateTime): boolean;

  findByKey(key: string): KothNotificationRecord | undefined;

  /** Elimina el historial de eventos anteriores a `cutoff`. Devuelve las filas borradas. */
  deleteEventsBefore(cutoff: DateTime): number;
}
