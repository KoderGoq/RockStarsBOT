import { readString } from '../../../infrastructure/database/row-readers.js';
import { toUtcIsoString } from '../../../shared/utils/time.js';
export class SqliteKothPanelMessageRepository {
    statements;
    constructor(database) {
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
    find(key) {
        const row = this.statements.find.get({ key });
        if (row === undefined)
            return undefined;
        return {
            key: readString(row, 'panel_key'),
            channelId: readString(row, 'channel_id'),
            messageId: readString(row, 'message_id'),
        };
    }
    save(key, channelId, messageId, now) {
        this.statements.save.run({ key, channelId, messageId, now: toUtcIsoString(now) });
    }
}
//# sourceMappingURL=sqlite-koth-panel-message.repository.js.map