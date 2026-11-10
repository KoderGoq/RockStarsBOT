import type { DatabaseSync } from 'node:sqlite';
import type { DateTime } from 'luxon';
import { pino } from 'pino';
import { IN_MEMORY_DATABASE, openDatabase } from '../../src/infrastructure/database/database.js';
import type {
  AnnouncementResult,
  KothAnnouncer,
} from '../../src/modules/koth/domain/koth.ports.js';
import type { KothReminder } from '../../src/modules/koth/domain/koth.types.js';
import { SqliteKothNotificationRepository } from '../../src/modules/koth/repositories/sqlite-koth-notification.repository.js';
import {
  KothSchedulerService,
  type SchedulerTickSummary,
} from '../../src/modules/koth/services/koth-scheduler.service.js';
import { createTimeService } from './time.js';

export const silentLogger = pino({ level: 'silent' });

export const DEFAULT_MAX_LATENESS_MS = 5 * 60_000;

/** Announcer simulado que registra los avisos publicados. */
export class FakeAnnouncer implements KothAnnouncer {
  readonly announced: KothReminder[] = [];
  private failuresRemaining = 0;
  private delayMs = 0;

  failNext(times = 1): void {
    this.failuresRemaining = times;
  }

  delayBy(ms: number): void {
    this.delayMs = ms;
  }

  async announce(reminder: KothReminder): Promise<AnnouncementResult> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('Discord no disponible (simulado)');
    }
    this.announced.push(reminder);
    return { messageId: `message-${this.announced.length}` };
  }

  get announcedKeys(): string[] {
    return this.announced.map((reminder) => reminder.key);
  }
}

export interface SchedulerHarness {
  readonly database: DatabaseSync;
  readonly repository: SqliteKothNotificationRepository;
  readonly announcer: FakeAnnouncer;
  readonly scheduler: KothSchedulerService;
}

export function createSchedulerHarness(
  options: { databasePath?: string; announcer?: FakeAnnouncer; maxLatenessMs?: number } = {},
): SchedulerHarness {
  const database = openDatabase(options.databasePath ?? IN_MEMORY_DATABASE);
  const repository = new SqliteKothNotificationRepository(database);
  const announcer = options.announcer ?? new FakeAnnouncer();
  const scheduler = new KothSchedulerService({
    timeService: createTimeService(),
    repository,
    announcer,
    logger: silentLogger,
    options: { maxLatenessMs: options.maxLatenessMs ?? DEFAULT_MAX_LATENESS_MS },
  });
  return { database, repository, announcer, scheduler };
}

export interface SentNotification {
  readonly key: string;
  readonly sentAt: DateTime;
}

/**
 * Simula el polling: ejecuta un tick cada `stepSeconds` entre `from` y `to`
 * (incluidos) y devuelve los avisos enviados con el instante del tick.
 */
export async function runTicksBetween(
  scheduler: KothSchedulerService,
  from: DateTime,
  to: DateTime,
  stepSeconds: number,
): Promise<SentNotification[]> {
  const sent: SentNotification[] = [];
  for (let now = from; now.toMillis() <= to.toMillis(); now = now.plus({ seconds: stepSeconds })) {
    const summary: SchedulerTickSummary = await scheduler.tick(now);
    sent.push(...summary.sent.map((key) => ({ key, sentAt: now })));
  }
  return sent;
}
