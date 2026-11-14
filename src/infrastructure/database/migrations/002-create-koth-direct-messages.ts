import type { Migration } from './migration.types.js';

export const createKothDirectMessagesMigration: Migration = {
  version: 2,
  name: 'create-koth-direct-messages',
  up: `
    -- Miembros que han pedido recibir un MD antes de cada KOTH.
    CREATE TABLE koth_dm_subscribers (
      user_id              TEXT    PRIMARY KEY,
      subscribed_at        TEXT    NOT NULL,
      consecutive_failures INTEGER NOT NULL DEFAULT 0
    );

    -- Un registro por (aviso, usuario): garantiza que nadie recibe el mismo MD dos veces.
    CREATE TABLE koth_dm_deliveries (
      reminder_key    TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      event_starts_at TEXT NOT NULL,
      status          TEXT NOT NULL
        CHECK (status IN ('processing', 'sent', 'unreachable', 'left', 'failed')),
      message_id      TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      PRIMARY KEY (reminder_key, user_id)
    );

    CREATE INDEX idx_koth_dm_deliveries_event_starts_at
      ON koth_dm_deliveries (event_starts_at);
  `,
};
