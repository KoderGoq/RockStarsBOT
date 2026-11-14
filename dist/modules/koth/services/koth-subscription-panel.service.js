import { SUBSCRIPTION_PANEL_KEY } from '../domain/koth.constants.js';
/**
 * Publica el panel de suscripción (mensaje con los botones). Es idempotente: si el panel ya
 * existe lo actualiza en su sitio, y solo publica uno nuevo si no existía, si lo borraron o
 * si se cambió el canal. Así nunca se acumulan paneles repetidos.
 */
export class KothSubscriptionPanelService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async publish() {
        const { channelId, panels, gateway, clock } = this.deps;
        const stored = panels.find(SUBSCRIPTION_PANEL_KEY);
        if (stored?.channelId === channelId) {
            const stillExists = await gateway.update(channelId, stored.messageId);
            if (stillExists) {
                panels.save(SUBSCRIPTION_PANEL_KEY, channelId, stored.messageId, clock.now());
                return { kind: 'updated', messageId: stored.messageId };
            }
        }
        const { messageId } = await gateway.create(channelId);
        panels.save(SUBSCRIPTION_PANEL_KEY, channelId, messageId, clock.now());
        return { kind: 'created', messageId };
    }
}
//# sourceMappingURL=koth-subscription-panel.service.js.map