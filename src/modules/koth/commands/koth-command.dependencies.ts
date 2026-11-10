import type { Clock } from '../../../shared/types/clock.js';
import type { KothTimeService } from '../services/koth-time.service.js';
import type { MessageContext } from '../templates/koth-messages.js';

export interface KothCommandDependencies {
  readonly timeService: KothTimeService;
  readonly clock: Clock;
  readonly messageContext: MessageContext;
  /** Canal donde se publican los avisos (y los mensajes de prueba). */
  readonly announcementChannelId: string;
}
