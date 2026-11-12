export const createKothNotificationsMigration = {
    version: 1,
    name: 'create-koth-notifications',
    up: `
    CREATE TABLE koth_notifications (
      notification_key TEXT PRIMARY KEY,
      slot_id          TEXT    NOT NULL,
      event_starts_at  TEXT    NOT NULL,
      offset_minutes   INTEGER NOT NULL,
      status           TEXT    NOT NULL CHECK (status IN ('processing', 'sent', 'skipped')),
      skip_reason      TEXT,
      message_id       TEXT,
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL
    );

    CREATE INDEX idx_koth_notifications_event_starts_at
      ON koth_notifications (event_starts_at);
  `,
};
//# sourceMappingURL=001-create-koth-notifications.js.map