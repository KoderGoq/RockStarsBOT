import type { DatabaseSync } from 'node:sqlite';
import { kothConfig } from '../../src/config/koth.config.js';
import { IN_MEMORY_DATABASE, openDatabase } from '../../src/infrastructure/database/database.js';
import type {
  DirectMessageOutcome,
  KothDirectMessenger,
} from '../../src/modules/koth/domain/koth.ports.js';
import type { KothReminder } from '../../src/modules/koth/domain/koth.types.js';
import { SqliteKothDmDeliveryRepository } from '../../src/modules/koth/repositories/sqlite-koth-dm-delivery.repository.js';
import { SqliteKothSubscriberRepository } from '../../src/modules/koth/repositories/sqlite-koth-subscriber.repository.js';
import {
  KothDmDispatcherService,
  type KothDmDispatcherOptions,
} from '../../src/modules/koth/services/koth-dm-dispatcher.service.js';
import { KothSubscriptionService } from '../../src/modules/koth/services/koth-subscription.service.js';
import type { MessageContext } from '../../src/modules/koth/templates/koth-messages.js';
import { createLoadedIconRegistry } from './icons.js';
import { silentLogger } from './scheduler.js';
import { createTimeService, FakeClock, madrid } from './time.js';

export function createMessageContext(overrides: Partial<MessageContext> = {}): MessageContext {
  return {
    serverIp: 'boutcraft.xyz',
    timezone: 'Europe/Madrid',
    mentionEveryone: false,
    icons: createLoadedIconRegistry(),
    voiceChannelId: null,
    subscriptionChannelId: null,
    ...overrides,
  };
}

/** Mensajero simulado: por defecto todo se envía bien; se pueden programar fallos por usuario. */
export class FakeDirectMessenger implements KothDirectMessenger {
  /** Todos los intentos de enviar un aviso, con su resultado. */
  readonly attempts: { userId: string; reminderKey: string; outcome: DirectMessageOutcome }[] = [];
  readonly previews: string[] = [];
  readonly confirmations: string[] = [];

  private readonly scripted = new Map<string, DirectMessageOutcome[]>();
  private readonly throwing = new Set<string>();
  private confirmationOutcome: DirectMessageOutcome | undefined;
  private delayMs = 0;
  private counter = 0;

  /** Programa los próximos resultados de `sendReminder` para un usuario (en orden). */
  script(userId: string, ...outcomes: DirectMessageOutcome[]): void {
    this.scripted.set(userId, outcomes);
  }

  throwFor(userId: string): void {
    this.throwing.add(userId);
  }

  setConfirmationOutcome(outcome: DirectMessageOutcome): void {
    this.confirmationOutcome = outcome;
  }

  delayBy(ms: number): void {
    this.delayMs = ms;
  }

  /** Usuarios a los que se entregó el aviso, en orden. */
  get deliveredTo(): string[] {
    return this.attempts
      .filter(({ outcome }) => outcome.kind === 'sent')
      .map(({ userId }) => userId);
  }

  async sendReminder(userId: string, reminder: KothReminder): Promise<DirectMessageOutcome> {
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (this.throwing.has(userId)) throw new Error('Fallo inesperado (simulado)');

    const outcome = this.scripted.get(userId)?.shift() ?? this.nextSent();
    this.attempts.push({ userId, reminderKey: reminder.key, outcome });
    return outcome;
  }

  sendPreview(userId: string): Promise<DirectMessageOutcome> {
    this.previews.push(userId);
    return Promise.resolve(this.nextSent());
  }

  sendSubscriptionConfirmation(userId: string): Promise<DirectMessageOutcome> {
    this.confirmations.push(userId);
    return Promise.resolve(this.confirmationOutcome ?? this.nextSent());
  }

  private nextSent(): DirectMessageOutcome {
    this.counter += 1;
    return { kind: 'sent', messageId: `dm-${this.counter}` };
  }
}

export interface DmHarness {
  readonly database: DatabaseSync;
  readonly subscribers: SqliteKothSubscriberRepository;
  readonly deliveries: SqliteKothDmDeliveryRepository;
  readonly messenger: FakeDirectMessenger;
  readonly dispatcher: KothDmDispatcherService;
  readonly subscriptions: KothSubscriptionService;
  readonly clock: FakeClock;
  /** Pausas solicitadas por el dispatcher (en ms), en orden. */
  readonly pauses: number[];
}

export interface DmHarnessOptions {
  readonly databasePath?: string;
  readonly messenger?: FakeDirectMessenger;
  /** Instante inicial del reloj simulado, en hora de Madrid. */
  readonly startAt?: string;
  /** Si es `true`, cada pausa hace avanzar el reloj simulado el tiempo pedido. */
  readonly pauseAdvancesClock?: boolean;
  /** Se ejecuta en cada pausa entre envíos (permite simular algo que ocurre a mitad del reparto). */
  readonly onPause?: () => void;
  /** Simula el interruptor de apagado/encendido de los avisos. */
  readonly isPaused?: () => boolean;
  readonly options?: Partial<KothDmDispatcherOptions>;
}

export function createDmHarness(settings: DmHarnessOptions = {}): DmHarness {
  const database = openDatabase(settings.databasePath ?? IN_MEMORY_DATABASE);
  const subscribers = new SqliteKothSubscriberRepository(database);
  const deliveries = new SqliteKothDmDeliveryRepository(database);
  const messenger = settings.messenger ?? new FakeDirectMessenger();
  const clock = new FakeClock(madrid(settings.startAt ?? '2026-11-09T16:50:00'));
  const pauses: number[] = [];

  const dispatcher = new KothDmDispatcherService({
    timeService: createTimeService(),
    subscribers,
    deliveries,
    messenger,
    clock,
    pause: (ms) => {
      pauses.push(ms);
      settings.onPause?.();
      if (settings.pauseAdvancesClock === true) clock.advance({ seconds: ms / 1000 });
      return Promise.resolve();
    },
    logger: silentLogger,
    options: { ...kothConfig.directMessages, ...settings.options },
    ...(settings.isPaused === undefined ? {} : { isPaused: settings.isPaused }),
  });
  const subscriptions = new KothSubscriptionService({ subscribers, messenger, clock });

  return { database, subscribers, deliveries, messenger, dispatcher, subscriptions, clock, pauses };
}

/** Da de alta suscriptores directamente en la base de datos. */
export function subscribeAll(harness: DmHarness, ...userIds: string[]): void {
  for (const userId of userIds) harness.subscribers.add(userId, harness.clock.now());
}
