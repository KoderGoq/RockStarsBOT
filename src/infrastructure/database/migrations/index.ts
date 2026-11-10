import { createKothNotificationsMigration } from './001-create-koth-notifications.js';
import type { Migration } from './migration.types.js';

/** Migraciones registradas, en orden. Añade las nuevas al final. */
export const MIGRATIONS: readonly Migration[] = [createKothNotificationsMigration];
