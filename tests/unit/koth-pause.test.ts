import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteKothPauseStateRepository } from '../../src/modules/koth/repositories/sqlite-koth-pause-state.repository.js';
import { KothPauseService } from '../../src/modules/koth/services/koth-pause.service.js';
import { createDmHarness, type DmHarness, subscribeAll } from '../helpers/direct-messages.js';
import { createSchedulerHarness, runTicksBetween } from '../helpers/scheduler.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();

function reminderKey(localStart: string, offset: 60 | 30 | 10): string {
  const occurrence = timeService.getNextOccurrence(madrid(localStart).minus({ seconds: 1 }));
  const reminder = timeService
    .getReminders(occurrence)
    .find((candidate) => candidate.offsetMinutes === offset);
  if (reminder === undefined) throw new Error('Aviso no encontrado');
  return reminder.key;
}

describe('KothPauseService', () => {
  let harness: DmHarness;
  let logger: { warn: ReturnType<typeof vi.fn> };
  let service: KothPauseService;

  function createService(): KothPauseService {
    logger = { warn: vi.fn() };
    return new KothPauseService({
      repository: new SqliteKothPauseStateRepository(harness.database),
      clock: harness.clock,
      logger: logger as unknown as Logger,
    });
  }

  beforeEach(() => {
    harness = createDmHarness();
    service = createService();
  });

  afterEach(() => {
    harness.database.close();
  });

  it('arranca encendido y sin registro', () => {
    expect(service.isPaused()).toBe(false);
    expect(service.status()).toBeUndefined();
  });

  it('apagar cambia el estado y recuerda quién y cuándo', () => {
    const change = service.pause('admin-1');

    expect(change.kind).toBe('changed');
    expect(service.isPaused()).toBe(true);
    expect(service.status()).toEqual({
      paused: true,
      changedBy: 'admin-1',
      changedAt: harness.clock.now().toUTC().toISO(),
    });
  });

  it('apagar dos veces no cambia nada y conserva quién lo apagó primero', () => {
    service.pause('admin-1');
    harness.clock.advance({ minutes: 10 });

    const second = service.pause('admin-2');

    expect(second.kind).toBe('unchanged');
    expect(second.state?.changedBy).toBe('admin-1');
  });

  it('encender vuelve a activar los avisos', () => {
    service.pause('admin-1');

    const change = service.resume('admin-2');

    expect(change.kind).toBe('changed');
    expect(service.isPaused()).toBe(false);
    expect(service.status()?.changedBy).toBe('admin-2');
  });

  it('encender un bot que ya estaba encendido no cambia nada ni crea registro', () => {
    const change = service.resume('admin-1');

    expect(change).toEqual({ kind: 'unchanged', state: undefined });
    expect(service.status()).toBeUndefined();
  });

  it('deja constancia en el log solo cuando el estado cambia de verdad', () => {
    service.pause('admin-1');
    service.pause('admin-1');
    service.resume('admin-1');
    service.resume('admin-1');

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenNthCalledWith(
      1,
      { paused: true, userId: 'admin-1' },
      expect.stringContaining('APAGADOS'),
    );
    expect(logger.warn).toHaveBeenNthCalledWith(
      2,
      { paused: false, userId: 'admin-1' },
      expect.stringContaining('ENCENDIDOS'),
    );
  });
});

describe('el apagado sobrevive a un reinicio del bot', () => {
  let directory: string;
  const open: DmHarness[] = [];

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'boutcraft-pause-'));
  });

  afterEach(() => {
    for (const harness of open.splice(0)) harness.database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('un bot apagado sigue apagado tras reiniciarse', () => {
    const databasePath = join(directory, 'boutcraft.sqlite');
    const first = createDmHarness({ databasePath });
    open.push(first);
    new KothPauseService({
      repository: new SqliteKothPauseStateRepository(first.database),
      clock: first.clock,
      logger: { warn: vi.fn() } as unknown as Logger,
    }).pause('admin-1');
    first.database.close();
    open.splice(open.indexOf(first), 1);

    const second = createDmHarness({ databasePath });
    open.push(second);
    const afterRestart = new SqliteKothPauseStateRepository(second.database);

    expect(afterRestart.find()?.paused).toBe(true);
  });
});

describe('avisos del canal con el bot apagado', () => {
  it('apagado no publica nada ni deja registro', async () => {
    const { scheduler, announcer, repository } = createSchedulerHarness({ isPaused: () => true });

    const summary = await scheduler.tick(madrid('2026-11-09T16:00:05'));

    expect(summary.sent).toEqual([]);
    expect(announcer.announced).toHaveLength(0);
    expect(repository.findByKey(reminderKey('2026-11-09T17:00', 60))).toBeUndefined();
  });

  it('encendido de nuevo, publica el aviso vencido hace pocos minutos', async () => {
    let paused = true;
    const { scheduler, announcer } = createSchedulerHarness({ isPaused: () => paused });
    await scheduler.tick(madrid('2026-11-09T16:00:05'));

    paused = false;
    await scheduler.tick(madrid('2026-11-09T16:02:00'));

    expect(announcer.announcedKeys).toEqual([reminderKey('2026-11-09T17:00', 60)]);
  });

  it('encendido de nuevo, no envía avisos atrasados de cuando estuvo apagado', async () => {
    let paused = true;
    const { scheduler, announcer } = createSchedulerHarness({ isPaused: () => paused });
    await runTicksBetween(scheduler, madrid('2026-11-09T16:00'), madrid('2026-11-09T16:40'), 30);

    paused = false;
    await runTicksBetween(scheduler, madrid('2026-11-09T16:40'), madrid('2026-11-09T17:05'), 30);

    // Los de 1 hora y 30 minutos ya no tienen sentido; solo sale el de 10 minutos, a su hora.
    expect(announcer.announcedKeys).toEqual([reminderKey('2026-11-09T17:00', 10)]);
  });

  it('un KOTH entero que ocurre con el bot apagado no se anuncia nunca después', async () => {
    let paused = true;
    const { scheduler, announcer } = createSchedulerHarness({ isPaused: () => paused });
    await runTicksBetween(scheduler, madrid('2026-11-09T20:00'), madrid('2026-11-09T22:30'), 30);

    paused = false;
    await runTicksBetween(scheduler, madrid('2026-11-09T22:30'), madrid('2026-11-09T23:30'), 30);

    expect(announcer.announced).toHaveLength(0);
  });
});

describe('MD a suscriptores con el bot apagado', () => {
  it('apagado no envía ningún MD', async () => {
    const harness = createDmHarness({ isPaused: () => true });
    subscribeAll(harness, 'u1', 'u2');

    const summary = await harness.dispatcher.run();

    expect(summary.sent).toEqual([]);
    expect(harness.messenger.attempts).toHaveLength(0);
  });

  it('si se apaga a mitad de un reparto, se detiene al instante', async () => {
    let paused = false;
    const harness = createDmHarness({
      isPaused: () => paused,
      onPause: () => {
        paused = true;
      },
    });
    subscribeAll(harness, 'u1', 'u2', 'u3');

    await harness.dispatcher.run();

    expect(harness.messenger.deliveredTo).toEqual(['u1']);
  });

  it('al encender de nuevo continúa con los pendientes sin repetir a los ya enviados', async () => {
    let paused = false;
    // Alguien apaga los avisos una sola vez, justo después del primer envío.
    let apagarUnaVez = true;
    const harness = createDmHarness({
      isPaused: () => paused,
      onPause: () => {
        if (!apagarUnaVez) return;
        apagarUnaVez = false;
        paused = true;
      },
    });
    subscribeAll(harness, 'u1', 'u2', 'u3');
    await harness.dispatcher.run();
    expect(harness.messenger.deliveredTo).toEqual(['u1']);

    paused = false;
    harness.clock.advance({ seconds: 30 });
    await harness.dispatcher.run();

    // u1 no se repite; el reparto continúa con u2 y u3.
    expect(harness.messenger.deliveredTo).toEqual(['u1', 'u2', 'u3']);
  });
});
