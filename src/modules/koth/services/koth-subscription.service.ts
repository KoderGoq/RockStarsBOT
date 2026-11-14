import type { Clock } from '../../../shared/types/clock.js';
import type { KothDirectMessenger } from '../domain/koth.ports.js';
import type {
  KothSubscriberRecord,
  KothSubscriberRepository,
} from '../repositories/koth-subscriber.repository.js';

export type SubscribeResult =
  | { readonly kind: 'subscribed' }
  /**
   * Suscrito, pero Discord limitó los MD seguidos y no se pudo enviar la confirmación. No es
   * señal de que tenga los MD cerrados, así que se le suscribe igualmente: el primer aviso real
   * comprobará si se le puede escribir.
   */
  | { readonly kind: 'subscribed-unconfirmed' }
  | { readonly kind: 'already-subscribed' }
  /** No se pudo escribir al usuario: tiene los MD cerrados. No se suscribe. */
  | { readonly kind: 'dms-closed' }
  /** Fallo inesperado de Discord; no se suscribe y se puede reintentar más tarde. */
  | { readonly kind: 'unavailable' };

export interface KothSubscriptionServiceDependencies {
  readonly subscribers: KothSubscriberRepository;
  readonly messenger: KothDirectMessenger;
  readonly clock: Clock;
}

/**
 * Altas y bajas de los suscriptores de MD. Solo se suscribe a quien lo pide y a quien
 * se le puede escribir: la propia confirmación por MD comprueba que están abiertos.
 */
export class KothSubscriptionService {
  constructor(private readonly deps: KothSubscriptionServiceDependencies) {}

  async subscribe(userId: string): Promise<SubscribeResult> {
    const { subscribers, messenger, clock } = this.deps;
    if (subscribers.has(userId)) return { kind: 'already-subscribed' };

    const outcome = await messenger.sendSubscriptionConfirmation(userId);
    switch (outcome.kind) {
      case 'sent':
        // Si dos peticiones se cruzan, solo la primera da el alta.
        return subscribers.add(userId, clock.now())
          ? { kind: 'subscribed' }
          : { kind: 'already-subscribed' };
      case 'rate-limited':
        return subscribers.add(userId, clock.now())
          ? { kind: 'subscribed-unconfirmed' }
          : { kind: 'already-subscribed' };
      case 'dms-closed':
        return { kind: 'dms-closed' };
      default:
        return { kind: 'unavailable' };
    }
  }

  /** Devuelve `false` si no estaba suscrito. */
  unsubscribe(userId: string): boolean {
    return this.deps.subscribers.remove(userId);
  }

  list(): KothSubscriberRecord[] {
    return this.deps.subscribers.list();
  }
}
