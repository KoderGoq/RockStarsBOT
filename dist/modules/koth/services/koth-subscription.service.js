/**
 * Altas y bajas de los suscriptores de MD. Solo se suscribe a quien lo pide y a quien
 * se le puede escribir: la propia confirmación por MD comprueba que están abiertos.
 */
export class KothSubscriptionService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async subscribe(userId) {
        const { subscribers, messenger, clock } = this.deps;
        if (subscribers.has(userId))
            return { kind: 'already-subscribed' };
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
    unsubscribe(userId) {
        return this.deps.subscribers.remove(userId);
    }
    list() {
        return this.deps.subscribers.list();
    }
}
//# sourceMappingURL=koth-subscription.service.js.map