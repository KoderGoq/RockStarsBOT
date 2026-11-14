import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DateTime } from 'luxon';
import {
  type DatabaseRow,
  readNumber,
  readString,
} from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import type {
  KothSubscriberRecord,
  KothSubscriberRepository,
} from './koth-subscriber.repository.js';

export class SqliteKothSubscriberRepository implements KothSubscriberRepository {
  private readonly statements: {
    readonly insert: StatementSync;
    readonly remove: StatementSync;
    readonly find: StatementSync;
    readonly list: StatementSync;
    readonly recordFailure: StatementSync;
    readonly resetFailures: StatementSync;
  };

  constructor(database: DatabaseSync) {
    this.statements = {
      insert: database.prepare(`
        INSERT INTO koth_dm_subscribers (user_id, subscribed_at, consecutive_failures)
        VALUES (:userId, :now, 0)
        ON CONFLICT (user_id) DO NOTHING
      `),
      remove: database.prepare('DELETE FROM koth_dm_subscribers WHERE user_id = :userId'),
      find: database.prepare('SELECT user_id FROM koth_dm_subscribers WHERE user_id = :userId'),
      list: database.prepare(
        'SELECT * FROM koth_dm_subscribers ORDER BY subscribed_at ASC, user_id ASC',
      ),
      recordFailure: database.prepare(`
        UPDATE koth_dm_subscribers
        SET consecutive_failures = consecutive_failures + 1
        WHERE user_id = :userId
        RETURNING consecutive_failures
      `),
      resetFailures: database.prepare(`
        UPDATE koth_dm_subscribers
        SET consecutive_failures = 0
        WHERE user_id = :userId AND consecutive_failures <> 0
      `),
    };
  }

  add(userId: string, now: DateTime): boolean {
    const result = this.statements.insert.run({ userId, now: toUtcIsoString(now) });
    return Number(result.changes) === 1;
  }

  remove(userId: string): boolean {
    return Number(this.statements.remove.run({ userId }).changes) === 1;
  }

  has(userId: string): boolean {
    return this.statements.find.get({ userId }) !== undefined;
  }

  list(): KothSubscriberRecord[] {
    return this.statements.list.all().map(toRecord);
  }

  recordFailure(userId: string): number {
    const row = this.statements.recordFailure.get({ userId });
    return row === undefined ? 0 : readNumber(row, 'consecutive_failures');
  }

  resetFailures(userId: string): void {
    this.statements.resetFailures.run({ userId });
  }
}

function toRecord(row: DatabaseRow): KothSubscriberRecord {
  return {
    userId: readString(row, 'user_id'),
    subscribedAt: readString(row, 'subscribed_at'),
    consecutiveFailures: readNumber(row, 'consecutive_failures'),
  };
}
