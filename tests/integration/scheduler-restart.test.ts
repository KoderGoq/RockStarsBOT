import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSchedulerHarness, type SchedulerHarness } from '../helpers/scheduler.js';
import { madrid } from '../helpers/time.js';

/**
 * Simula reinicios reales del bot: cada "proceso" abre su propia conexión al
 * mismo fichero SQLite y crea un scheduler nuevo, sin estado en memoria.
 */
describe('Recuperación tras reiniciar el bot', () => {
  let directory: string;
  let databasePath: string;
  const openHarnesses: SchedulerHarness[] = [];

  function startProcess(): SchedulerHarness {
    const harness = createSchedulerHarness({ databasePath });
    openHarnesses.push(harness);
    return harness;
  }

  function stopProcess(harness: SchedulerHarness): void {
    harness.database.close();
    openHarnesses.splice(openHarnesses.indexOf(harness), 1);
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'boutcraft-koth-'));
    databasePath = join(directory, 'nested', 'boutcraft.sqlite');
  });

  afterEach(() => {
    for (const harness of openHarnesses.splice(0)) harness.database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('no reenvía un aviso ya publicado antes del reinicio', async () => {
    const firstProcess = startProcess();
    await firstProcess.scheduler.tick(madrid('2026-11-09T16:00:05'));
    expect(firstProcess.announcer.announced).toHaveLength(1);
    stopProcess(firstProcess);

    const secondProcess = startProcess();
    await secondProcess.scheduler.tick(madrid('2026-11-09T16:01:00'));

    expect(secondProcess.announcer.announced).toHaveLength(0);
  });

  it('continúa con los siguientes avisos después del reinicio', async () => {
    const firstProcess = startProcess();
    await firstProcess.scheduler.tick(madrid('2026-11-09T16:00:00'));
    stopProcess(firstProcess);

    const secondProcess = startProcess();
    await secondProcess.scheduler.tick(madrid('2026-11-09T16:15:00'));
    await secondProcess.scheduler.tick(madrid('2026-11-09T16:30:00'));

    expect(secondProcess.announcer.announced.map((reminder) => reminder.offsetMinutes)).toEqual([
      30,
    ]);
  });

  it('un reinicio breve dentro del margen recupera el aviso perdido', async () => {
    const firstProcess = startProcess();
    await firstProcess.scheduler.tick(madrid('2026-11-09T16:29:50'));
    stopProcess(firstProcess);

    // El bot estuvo caído justo a las 16:30 y vuelve a las 16:32.
    const secondProcess = startProcess();
    await secondProcess.scheduler.tick(madrid('2026-11-09T16:32:00'));

    expect(secondProcess.announcer.announced.map((reminder) => reminder.offsetMinutes)).toEqual([
      30,
    ]);
  });

  it('dos instancias simultáneas sobre la misma base de datos no duplican avisos', async () => {
    const instanceA = startProcess();
    const instanceB = startProcess();
    const now = madrid('2026-11-09T21:00:00');

    await Promise.all([instanceA.scheduler.tick(now), instanceB.scheduler.tick(now)]);

    const total = instanceA.announcer.announced.length + instanceB.announcer.announced.length;
    expect(total).toBe(1);
  });
});
