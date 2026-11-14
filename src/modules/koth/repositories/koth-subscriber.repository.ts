import type { DateTime } from 'luxon';

export interface KothSubscriberRecord {
  readonly userId: string;
  /** Fecha de alta en UTC ISO. */
  readonly subscribedAt: string;
  readonly consecutiveFailures: number;
}

/** Miembros que han pedido recibir un MD antes de cada KOTH. */
export interface KothSubscriberRepository {
  /** Devuelve `false` si ya estaba suscrito. */
  add(userId: string, now: DateTime): boolean;

  /** Devuelve `false` si no estaba suscrito. */
  remove(userId: string): boolean;

  has(userId: string): boolean;

  /** Del más antiguo al más reciente. */
  list(): KothSubscriberRecord[];

  /** Suma un fallo seguido y devuelve el total (0 si el usuario no está suscrito). */
  recordFailure(userId: string): number;

  /** Reinicia la cuenta de fallos seguidos tras un envío correcto. */
  resetFailures(userId: string): void;
}
