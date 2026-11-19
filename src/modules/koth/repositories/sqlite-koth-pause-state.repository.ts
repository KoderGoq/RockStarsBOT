import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DateTime } from 'luxon';
import { readNumber, readString } from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import type { KothPauseState, KothPauseStateRepository } from './koth-pause-state.repository.js';

export class SqliteKothPauseStateRepository implements KothPauseStateRepository {
  private readonly statements: {
    readonly find: StatementSync;
    readonly save: StatementSync;
  };

  constructor(database: DatabaseSync) {
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

  find(): KothPauseState | undefined {
    const row = this.statements.find.get();
    if (row === undefined) return undefined;

    return {
      paused: readNumber(row, 'paused') === 1,
      changedBy: readString(row, 'changed_by'),
      changedAt: readString(row, 'changed_at'),
    };
  }

  save(paused: boolean, changedBy: string, now: DateTime): void {
    this.statements.save.run({
      paused: paused ? 1 : 0,
      changedBy,
      now: toUtcIsoString(now),
    });
  }
}
