import type { Clock } from '../../../shared/types/clock.js';
import type { KothDirectMessenger } from '../domain/koth.ports.js';
import type {
  KothSubscriberRecord,
  KothSubscriberRepository,
} from '../repositories/koth-subscriber.repository.js';

export type SubscribeResult =
  | { readonly kind: 'subscribed' }
  | { readonly kind: 'already-subscribed' }
  /** No se pudo escribir al usuario: tiene los MD cerrados. No se suscribe. */
  | { readonly kind: 'dms-closed' }
  /** Discord no dejó enviar el MD ahora; se puede reintentar más tarde. */
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
