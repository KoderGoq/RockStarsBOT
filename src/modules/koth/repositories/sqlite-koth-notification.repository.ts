import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DateTime } from 'luxon';
import {
  type DatabaseRow,
  readNullableString,
  readNumber,
  readString,
} from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import { NotificationStatus, type SkipReason } from '../domain/koth.constants.js';
import type { KothReminder } from '../domain/koth.types.js';
import type {
  KothNotificationRecord,
  KothNotificationRepository,
} from './koth-notification.repository.js';

const NOTIFICATION_STATUSES: readonly string[] = Object.values(NotificationStatus);

export class SqliteKothNotificationRepository implements KothNotificationRepository {
  private readonly statements: {
    readonly insert: StatementSync;
    readonly markSent: StatementSync;
    readonly release: StatementSync;
    readonly findByKey: StatementSync;
    readonly deleteBefore: StatementSync;
  };

  constructor(database: DatabaseSync) {
    this.statements = {
      // ON CONFLICT DO NOTHING convierte la inserción en una reserva atómica:
      // solo un llamador obtiene `changes = 1` para una misma clave.
      insert: database.prepare(`
        INSERT INTO koth_notifications (
          notification_key, slot_id, event_starts_at, offset_minutes,
          status, skip_reason, created_at, updated_at
        ) VALUES (
          :key, :slotId, :eventStartsAt, :offsetMinutes,
          :status, :skipReason, :now, :now
        )
        ON CONFLICT (notification_key) DO NOTHING
      `),
      markSent: database.prepare(`
        UPDATE koth_notifications
        SET status = 'sent', message_id = :messageId, updated_at = :now
        WHERE notification_key = :key AND status = 'processing'
      `),
      release: database.prepare(`
        DELETE FROM koth_notifications
        WHERE notification_key = :key AND status = 'processing'
      `),
      findByKey: database.prepare(`
        SELECT * FROM koth_notifications WHERE notification_key = :key
      `),
      deleteBefore: database.prepare(`
        DELETE FROM koth_notifications WHERE event_starts_at < :cutoff
      `),
    };
  }

  tryClaim(reminder: KothReminder, now: DateTime): boolean {
    return this.insert(reminder, NotificationStatus.Processing, null, now);
  }

  markSent(key: string, messageId: string, now: DateTime): void {
    const result = this.statements.markSent.run({ key, messageId, now: toUtcIsoString(now) });
    if (Number(result.changes) === 0) {
      throw new Error(`No existe una reserva en curso para el aviso ${key}`);
    }
  }

  release(key: string): void {
    this.statements.release.run({ key });
  }

  recordSkipped(reminder: KothReminder, reason: SkipReason, now: DateTime): boolean {
    return this.insert(reminder, NotificationStatus.Skipped, reason, now);
  }

  findByKey(key: string): KothNotificationRecord | undefined {
    const row = this.statements.findByKey.get({ key });
    return row === undefined ? undefined : toRecord(row);
  }

  deleteEventsBefore(cutoff: DateTime): number {
    const result = this.statements.deleteBefore.run({ cutoff: toUtcIsoString(cutoff) });
    return Number(result.changes);
  }

  private insert(
    reminder: KothReminder,
    status: NotificationStatus,
    skipReason: SkipReason | null,
    now: DateTime,
  ): boolean {
    const result = this.statements.insert.run({
      key: reminder.key,
      slotId: reminder.occurrence.slot.id,
      eventStartsAt: toUtcIsoString(reminder.occurrence.startsAt),
      offsetMinutes: reminder.offsetMinutes,
      status,
      skipReason,
      now: toUtcIsoString(now),
    });
    return Number(result.changes) === 1;
  }
}

function toRecord(row: DatabaseRow): KothNotificationRecord {
  return {
    key: readString(row, 'notification_key'),
    slotId: readString(row, 'slot_id'),
    eventStartsAt: readString(row, 'event_starts_at'),
    offsetMinutes: readNumber(row, 'offset_minutes'),
    status: readStatus(row),
    skipReason: readNullableString(row, 'skip_reason'),
    messageId: readNullableString(row, 'message_id'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  };
}

function readStatus(row: DatabaseRow): NotificationStatus {
  const status = readString(row, 'status');
  if (!isNotificationStatus(status)) {
    throw new TypeError(`Estado de aviso desconocido: ${status}`);
  }
  return status;
}

function isNotificationStatus(value: string): value is NotificationStatus {
  return NOTIFICATION_STATUSES.includes(value);
}
