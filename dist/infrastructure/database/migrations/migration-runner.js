import { readNumber } from '../row-readers.js';
/**
 * Aplica, en orden y dentro de una transacción cada una, las migraciones
 * pendientes. Devuelve las versiones aplicadas en esta ejecución.
 */
export function runMigrations(database, migrations) {
    ensureMigrationsTable(database);
    const applied = getAppliedVersions(database);
    const pending = [...migrations]
        .sort((a, b) => a.version - b.version)
        .filter((migration) => !applied.has(migration.version));
    for (const migration of pending) {
        applyMigration(database, migration);
    }
    return pending.map((migration) => migration.version);
}
function ensureMigrationsTable(database) {
    database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}
function getAppliedVersions(database) {
    const rows = database.prepare('SELECT version FROM schema_migrations').all();
    return new Set(rows.map((row) => readNumber(row, 'version')));
}
function applyMigration(database, migration) {
    database.exec('BEGIN IMMEDIATE');
    try {
        database.exec(migration.up);
        database
            .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
            .run(migration.version, migration.name, new Date().toISOString());
        database.exec('COMMIT');
    }
    catch (error) {
        database.exec('ROLLBACK');
        throw new Error(`Falló la migración ${migration.version} (${migration.name})`, {
            cause: error,
        });
    }
}
//# sourceMappingURL=migration-runner.js.map