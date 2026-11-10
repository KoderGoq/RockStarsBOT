import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IN_MEMORY_DATABASE, openDatabase } from '../../src/infrastructure/database/database.js';
import { MIGRATIONS } from '../../src/infrastructure/database/migrations/index.js';
import { runMigrations } from '../../src/infrastructure/database/migrations/migration-runner.js';
import { NotificationStatus, SkipReason } from '../../src/modules/koth/domain/koth.constants.js';
import type { KothReminder } from '../../src/modules/koth/domain/koth.types.js';
import { SqliteKothNotificationRepository } from '../../src/modules/koth/repositories/sqlite-koth-notification.repository.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();
const now = madrid('2026-11-09T16:00');

function firstReminderOfNextKoth(from = now): KothReminder {
  const [reminder] = timeService.getReminders(timeService.getNextOccurrence(from));
  if (reminder === undefined) throw new Error('Sin avisos');
  return reminder;
}

describe('SqliteKothNotificationRepository', () => {
  let database: DatabaseSync;
  let repository: SqliteKothNotificationRepository;

  beforeEach(() => {
    database = openDatabase(IN_MEMORY_DATABASE);
    repository = new SqliteKothNotificationRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it('la reserva es exclusiva: solo el primer intento la obtiene', () => {
    const reminder = firstReminderOfNextKoth();

    expect(repository.tryClaim(reminder, now)).toBe(true);
    expect(repository.tryClaim(reminder, now)).toBe(false);
    expect(repository.findByKey(reminder.key)).toMatchObject({
      status: NotificationStatus.Processing,
      slotId: 'koth-1',
      eventStartsAt: '2026-11-09T16:00:00.000Z',
      offsetMinutes: 60,
    });
  });

  it('confirma el envío guardando el id del mensaje', () => {
    const reminder = firstReminderOfNextKoth();
    repository.tryClaim(reminder, now);

    repository.markSent(reminder.key, '123456', now);

    expect(repository.findByKey(reminder.key)).toMatchObject({
      status: NotificationStatus.Sent,
      messageId: '123456',
    });
  });

  it('no permite confirmar un aviso que no estaba reservado', () => {
    expect(() => {
      repository.markSent('inexistente', '1', now);
    }).toThrow(/reserva/);
  });

  it('liberar una reserva permite reclamarla de nuevo', () => {
    const reminder = firstReminderOfNextKoth();
    repository.tryClaim(reminder, now);

    repository.release(reminder.key);

    expect(repository.tryClaim(reminder, now)).toBe(true);
  });

  it('liberar no borra un aviso ya enviado', () => {
    const reminder = firstReminderOfNextKoth();
    repository.tryClaim(reminder, now);
    repository.markSent(reminder.key, '1', now);

    repository.release(reminder.key);

    expect(repository.findByKey(reminder.key)?.status).toBe(NotificationStatus.Sent);
  });

  it('registrar como omitido no sobrescribe un aviso enviado', () => {
    const reminder = firstReminderOfNextKoth();
    repository.tryClaim(reminder, now);
    repository.markSent(reminder.key, '1', now);

    expect(repository.recordSkipped(reminder, SkipReason.Superseded, now)).toBe(false);
    expect(repository.findByKey(reminder.key)?.status).toBe(NotificationStatus.Sent);
  });

  it('depura el historial de eventos antiguos', () => {
    const oldReminder = firstReminderOfNextKoth(madrid('2026-09-01T12:00'));
    const recentReminder = firstReminderOfNextKoth();
    repository.recordSkipped(oldReminder, SkipReason.TooLate, now);
    repository.recordSkipped(recentReminder, SkipReason.TooLate, now);

    const deleted = repository.deleteEventsBefore(now.minus({ days: 30 }));

    expect(deleted).toBe(1);
    expect(repository.findByKey(oldReminder.key)).toBeUndefined();
    expect(repository.findByKey(recentReminder.key)).toBeDefined();
  });
});

describe('Migraciones', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'boutcraft-migrations-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('se aplican una sola vez aunque la base de datos se abra varias veces', () => {
    const path = join(directory, 'db.sqlite');
    openDatabase(path).close();

    const database = openDatabase(path);
    try {
      expect(runMigrations(database, MIGRATIONS)).toEqual([]);
    } finally {
      database.close();
    }
  });
});
