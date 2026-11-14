import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DateTime } from 'luxon';
import { readString } from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import type {
  KothPanelMessageRecord,
  KothPanelMessageRepository,
} from './koth-panel-message.repository.js';

export class SqliteKothPanelMessageRepository implements KothPanelMessageRepository {
  private readonly statements: {
    readonly find: StatementSync;
    readonly save: StatementSync;
  };

  constructor(database: DatabaseSync) {
    this.statements = {
      find: database.prepare('SELECT * FROM koth_panel_messages WHERE panel_key = :key'),
      save: database.prepare(`
        INSERT INTO koth_panel_messages (panel_key, channel_id, message_id, updated_at)
        VALUES (:key, :channelId, :messageId, :now)
        ON CONFLICT (panel_key) DO UPDATE SET
          channel_id = excluded.channel_id,
          message_id = excluded.message_id,
          updated_at = excluded.updated_at
      `),
    };
  }

  find(key: string): KothPanelMessageRecord | undefined {
    const row = this.statements.find.get({ key });
    if (row === undefined) return undefined;

    return {
      key: readString(row, 'panel_key'),
      channelId: readString(row, 'channel_id'),
      messageId: readString(row, 'message_id'),
    };
  }

  save(key: string, channelId: string, messageId: string, now: DateTime): void {
    this.statements.save.run({ key, channelId, messageId, now: toUtcIsoString(now) });
  }
}
