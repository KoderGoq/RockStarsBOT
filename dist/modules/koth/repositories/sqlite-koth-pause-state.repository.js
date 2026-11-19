import { readNumber, readString } from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
export class SqliteKothPauseStateRepository {
    statements;
    constructor(database) {
        this.statements = {
            find: database.prepare('SELECT * FROM koth_pause_state WHERE id = 1'),
            save: database.prepare(`
        INSERT INTO koth_pause_state (id, paused, changed_by, changed_at)
        VALUES (1, :paused, :changedBy, :now)
        ON CONFLICT (id) DO UPDATE SET
          paused = excluded.paused,
          changed_by = excluded.changed_by,
          changed_at = excluded.changed_at
      `),
        };
    }
    find() {
        const row = this.statements.find.get();
        if (row === undefined)
            return undefined;
        return {
            paused: readNumber(row, 'paused') === 1,
            changedBy: readString(row, 'changed_by'),
            changedAt: readString(row, 'changed_at'),
        };
    }
    save(paused, changedBy, now) {
        this.statements.save.run({
            paused: paused ? 1 : 0,
            changedBy,
            now: toUtcIsoString(now),
        });
    }
}
//# sourceMappingURL=sqlite-koth-pause-state.repository.js.map