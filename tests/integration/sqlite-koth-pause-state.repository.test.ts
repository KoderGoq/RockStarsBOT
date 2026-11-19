import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteKothPauseStateRepository } from '../../src/modules/koth/repositories/sqlite-koth-pause-state.repository.js';
import { createDmHarness, type DmHarness } from '../helpers/direct-messages.js';
import { madrid } from '../helpers/time.js';

const now = madrid('2026-11-19T20:00:00');

describe('SqliteKothPauseStateRepository', () => {
  let harness: DmHarness;
  let repository: SqliteKothPauseStateRepository;

  beforeEach(() => {
    harness = createDmHarness();
    repository = new SqliteKothPauseStateRepository(harness.database);
  });

  afterEach(() => {
    harness.database.close();
  });

  it('no devuelve nada mientras nadie haya apagado o encendido los avisos', () => {
    expect(repository.find()).toBeUndefined();
  });

  it('guarda el estado con quién lo cambió y cuándo (en UTC)', () => {
    repository.save(true, 'admin-1', now);

    expect(repository.find()).toEqual({
      paused: true,
      changedBy: 'admin-1',
      changedAt: '2026-11-19T19:00:00.000Z',
    });
  });

  it('guardar de nuevo sustituye el estado anterior y mantiene una sola fila', () => {
    repository.save(true, 'admin-1', now);
    repository.save(false, 'admin-2', now.plus({ hours: 1 }));

    expect(repository.find()).toMatchObject({ paused: false, changedBy: 'admin-2' });
    const rows = harness.database.prepare('SELECT COUNT(*) AS total FROM koth_pause_state').get();
    expect(rows?.total).toBe(1);
  });
});
