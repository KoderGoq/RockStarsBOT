import type { Migration } from './migration.types.js';

export const createKothPanelMessagesMigration: Migration = {
  version: 3,
  name: 'create-koth-panel-messages',
  up: `
    -- Mensajes fijos que publica el bot (p. ej. el panel con los botones de suscripción),
    -- para actualizarlos en lugar de publicar uno nuevo cada vez.
    CREATE TABLE koth_panel_messages (
      panel_key  TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};
