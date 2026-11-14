import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteKothPanelMessageRepository } from '../../src/modules/koth/repositories/sqlite-koth-panel-message.repository.js';
import { createDmHarness, type DmHarness } from '../helpers/direct-messages.js';
import { madrid } from '../helpers/time.js';

const now = madrid('2026-11-14T20:00:00');

describe('SqliteKothPanelMessageRepository', () => {
  let harness: DmHarness;
  let repository: SqliteKothPanelMessageRepository;

  beforeEach(() => {
    harness = createDmHarness();
    repository = new SqliteKothPanelMessageRepository(harness.database);
  });

  afterEach(() => {
    harness.database.close();
  });

  it('no devuelve nada si no hay ningún panel guardado', () => {
    expect(repository.find('koth-subscription-panel')).toBeUndefined();
  });

  it('guarda y recupera el mensaje de un panel', () => {
    repository.save('koth-subscription-panel', 'canal-1', 'mensaje-1', now);

    expect(repository.find('koth-subscription-panel')).toEqual({
      key: 'koth-subscription-panel',
      channelId: 'canal-1',
      messageId: 'mensaje-1',
    });
  });

  it('guardar de nuevo sustituye el registro anterior', () => {
    repository.save('koth-subscription-panel', 'canal-1', 'mensaje-1', now);

    repository.save('koth-subscription-panel', 'canal-2', 'mensaje-2', now.plus({ minutes: 1 }));

    expect(repository.find('koth-subscription-panel')).toMatchObject({
      channelId: 'canal-2',
      messageId: 'mensaje-2',
    });
  });

  it('cada clave tiene su propio panel', () => {
    repository.save('panel-a', 'canal-1', 'mensaje-a', now);
    repository.save('panel-b', 'canal-1', 'mensaje-b', now);

    expect(repository.find('panel-a')?.messageId).toBe('mensaje-a');
    expect(repository.find('panel-b')?.messageId).toBe('mensaje-b');
  });
});
