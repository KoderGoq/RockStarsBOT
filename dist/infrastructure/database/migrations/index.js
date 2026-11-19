import { createKothNotificationsMigration } from './001-create-koth-notifications.js';
import { createKothDirectMessagesMigration } from './002-create-koth-direct-messages.js';
import { createKothPanelMessagesMigration } from './003-create-koth-panel-messages.js';
import { createKothPauseStateMigration } from './004-create-koth-pause-state.js';
/** Migraciones registradas, en orden. Añade las nuevas al final. */
export const MIGRATIONS = [
    createKothNotificationsMigration,
    createKothDirectMessagesMigration,
    createKothPanelMessagesMigration,
    createKothPauseStateMigration,
];
//# sourceMappingURL=index.js.map