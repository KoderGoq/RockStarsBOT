import { readNumber, readString, } from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
export class SqliteKothSubscriberRepository {
    statements;
    constructor(database) {
        this.statements = {
            insert: database.prepare(`
        INSERT INTO koth_dm_subscribers (user_id, subscribed_at, consecutive_failures)
        VALUES (:userId, :now, 0)
        ON CONFLICT (user_id) DO NOTHING
      `),
            remove: database.prepare('DELETE FROM koth_dm_subscribers WHERE user_id = :userId'),
            find: database.prepare('SELECT user_id FROM koth_dm_subscribers WHERE user_id = :userId'),
            list: database.prepare('SELECT * FROM koth_dm_subscribers ORDER BY subscribed_at ASC, user_id ASC'),
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
    add(userId, now) {
        const result = this.statements.insert.run({ userId, now: toUtcIsoString(now) });
        return Number(result.changes) === 1;
    }
    remove(userId) {
        return Number(this.statements.remove.run({ userId }).changes) === 1;
    }
    has(userId) {
        return this.statements.find.get({ userId }) !== undefined;
    }
    list() {
        return this.statements.list.all().map(toRecord);
    }
    recordFailure(userId) {
        const row = this.statements.recordFailure.get({ userId });
        return row === undefined ? 0 : readNumber(row, 'consecutive_failures');
    }
    resetFailures(userId) {
        this.statements.resetFailures.run({ userId });
    }
}
function toRecord(row) {
    return {
        userId: readString(row, 'user_id'),
        subscribedAt: readString(row, 'subscribed_at'),
        consecutiveFailures: readNumber(row, 'consecutive_failures'),
    };
}
//# sourceMappingURL=sqlite-koth-subscriber.repository.js.map