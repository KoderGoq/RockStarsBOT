import type { Clock } from '../../../shared/types/clock.js';
import type { KothDirectMessenger } from '../domain/koth.ports.js';
import type { KothSubscriptionPanelService } from '../services/koth-subscription-panel.service.js';
import type { KothSubscriptionService } from '../services/koth-subscription.service.js';
import type { KothTimeService } from '../services/koth-time.service.js';
import type { MessageContext } from '../templates/koth-messages.js';

export interface KothCommandDependencies {
  readonly timeService: KothTimeService;
  readonly clock: Clock;
  readonly messageContext: MessageContext;
  /** Canal donde se publican los avisos (y los mensajes de prueba). */
  readonly announcementChannelId: string;
  readonly subscriptions: KothSubscriptionService;
  readonly messenger: KothDirectMessenger;
  /** `null` si no hay canal de suscripción configurado: entonces no hay panel. */
  readonly panel: KothSubscriptionPanelService | null;
}
