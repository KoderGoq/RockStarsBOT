export const createKothPauseStateMigration = {
    version: 4,
    name: 'create-koth-pause-state',
    up: `
    -- Estado de "apagado/encendido" de los avisos. Una sola fila (id = 1), para que la
    -- pausa sobreviva a los reinicios del bot.
    CREATE TABLE koth_pause_state (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      paused     INTEGER NOT NULL CHECK (paused IN (0, 1)),
      changed_by TEXT    NOT NULL,
      changed_at TEXT    NOT NULL
    );
  `,
};
//# sourceMappingURL=004-create-koth-pause-state.js.map