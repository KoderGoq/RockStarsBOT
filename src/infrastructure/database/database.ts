import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './migrations/index.js';
import { runMigrations } from './migrations/migration-runner.js';

export const IN_MEMORY_DATABASE = ':memory:';

/**
 * Abre (o crea) la base de datos SQLite y aplica las migraciones pendientes.
 * Usa el módulo nativo `node:sqlite`, sin dependencias nativas que compilar.
 */
export function openDatabase(path: string): DatabaseSync {
  if (path !== IN_MEMORY_DATABASE) {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }

  const database = new DatabaseSync(path);
  configureConnection(database);
  runMigrations(database, MIGRATIONS);
  return database;
}

function configureConnection(database: DatabaseSync): void {
  // WAL: escrituras más seguras ante cortes; busy_timeout: espera en lugar de
  // fallar si otro proceso tiene el fichero bloqueado momentáneamente.
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);
}
