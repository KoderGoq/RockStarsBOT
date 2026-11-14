import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DateTime } from 'luxon';
import { readString } from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import { DeliveryStatus, type UndeliveredStatus } from '../domain/koth.constants.js';
import type { KothDmDeliveryRepository } from './koth-dm-delivery.repository.js';

const DELIVERY_STATUSES: readonly string[] = Object.values(DeliveryStatus);

export class SqliteKothDmDeliveryRepository implements KothDmDeliveryRepository {
  private readonly statements: {
    readonly claim: StatementSync;
    readonly markSent: StatementSync;
    readonly markUndelivered: StatementSync;
    readonly release: StatementSync;
    readonly findStatus: StatementSync;
    readonly listPending: StatementSync;
    readonly deleteBefore: StatementSync;
  };

  constructor(database: DatabaseSync) {
    this.statements = {
      // ON CONFLICT DO NOTHING convierte la inserción en una reserva atómica.
      claim: database.prepare(`
        INSERT INTO koth_dm_deliveries (
          reminder_key, user_id, event_starts_at, status, created_at, updated_at
        ) VALUES (:reminderKey, :userId, :eventStartsAt, 'processing', :now, :now)
        ON CONFLICT (reminder_key, user_id) DO NOTHING
      `),
      markSent: database.prepare(`
        UPDATE koth_dm_deliveries
        SET status = 'sent', message_id = :messageId, updated_at = :now
        WHERE reminder_key = :reminderKey AND user_id = :userId AND status = 'processing'
      `),
      markUndelivered: database.prepare(`
        UPDATE koth_dm_deliveries
        SET status = :status, updated_at = :now
        WHERE reminder_key = :reminderKey AND user_id = :userId AND status = 'processing'
      `),
      release: database.prepare(`
        DELETE FROM koth_dm_deliveries
        WHERE reminder_key = :reminderKey AND user_id = :userId AND status = 'processing'
      `),
      findStatus: database.prepare(`
        SELECT status FROM koth_dm_deliveries
        WHERE reminder_key = :reminderKey AND user_id = :userId
      `),
      listPending: database.prepare(`
        SELECT s.user_id FROM koth_dm_subscribers s
        WHERE NOT EXISTS (
          SELECT 1 FROM koth_dm_deliveries d
          WHERE d.reminder_key = :reminderKey AND d.user_id = s.user_id
        )
        ORDER BY s.subscribed_at ASC, s.user_id ASC
      `),
      deleteBefore: database.prepare(
        'DELETE FROM koth_dm_deliveries WHERE event_starts_at < :cutoff',
      ),
    };
  }

  tryClaim(reminderKey: string, userId: string, eventStartsAt: DateTime, now: DateTime): boolean {
    const result = this.statements.claim.run({
      reminderKey,
      userId,
      eventStartsAt: toUtcIsoString(eventStartsAt),
      now: toUtcIsoString(now),
    });
    return Number(result.changes) === 1;
  }

  markSent(reminderKey: string, userId: string, messageId: string, now: DateTime): void {
    const result = this.statements.markSent.run({
      reminderKey,
      userId,
      messageId,
      now: toUtcIsoString(now),
    });
    if (Number(result.changes) === 0) {
      throw new Error(`No existe una reserva en curso del MD ${reminderKey} para ${userId}`);
    }
  }

  markUndelivered(
    reminderKey: string,
    userId: string,
    status: UndeliveredStatus,
    now: DateTime,
  ): void {
    this.statements.markUndelivered.run({ reminderKey, userId, status, now: toUtcIsoString(now) });
  }

  release(reminderKey: string, userId: string): void {
    this.statements.release.run({ reminderKey, userId });
  }

  findStatus(reminderKey: string, userId: string): DeliveryStatus | undefined {
    const row = this.statements.findStatus.get({ reminderKey, userId });
    if (row === undefined) return undefined;

    const status = readString(row, 'status');
    if (!isDeliveryStatus(status)) {
      throw new TypeError(`Estado de entrega desconocido: ${status}`);
    }
    return status;
  }

  listPendingUserIds(reminderKey: string): string[] {
    return this.statements.listPending
      .all({ reminderKey })
      .map((row) => readString(row, 'user_id'));
  }

  deleteEventsBefore(cutoff: DateTime): number {
    return Number(this.statements.deleteBefore.run({ cutoff: toUtcIsoString(cutoff) }).changes);
  }
}

function isDeliveryStatus(value: string): value is DeliveryStatus {
  return DELIVERY_STATUSES.includes(value);
}
