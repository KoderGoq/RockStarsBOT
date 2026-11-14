import { createKothNotificationsMigration } from './001-create-koth-notifications.js';
import { createKothDirectMessagesMigration } from './002-create-koth-direct-messages.js';
/** Migraciones registradas, en orden. Añade las nuevas al final. */
export const MIGRATIONS = [
    createKothNotificationsMigration,
    createKothDirectMessagesMigration,
];
//# sourceMappingURL=index.js.map