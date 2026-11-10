import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PollingTask } from '../../src/shared/utils/polling-task.js';
import { silentLogger } from '../helpers/scheduler.js';

const INTERVAL_MS = 1_000;

describe('PollingTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ejecuta la tarea al iniciar y en cada intervalo', async () => {
    const task = vi.fn(() => Promise.resolve());
    const polling = new PollingTask({
      name: 'test',
      intervalMs: INTERVAL_MS,
      task,
      logger: silentLogger,
    });

    polling.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    await polling.stop();

    expect(task).toHaveBeenCalledTimes(4);
  });

  it('nunca ejecuta la tarea de forma simultánea', async () => {
    let active = 0;
    let maxActive = 0;
    const task = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3.5));
      active -= 1;
    });
    const polling = new PollingTask({
      name: 'test',
      intervalMs: INTERVAL_MS,
      task,
      logger: silentLogger,
    });

    polling.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 10);
    // stop() espera a la ejecución en curso, que necesita que avance el reloj simulado.
    const stopping = polling.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 4);
    await stopping;

    expect(maxActive).toBe(1);
    expect(task.mock.calls.length).toBeLessThan(10);
  });

  it('un error en una ejecución no detiene el polling', async () => {
    const task = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('fallo puntual'))
      .mockResolvedValue(undefined);
    const polling = new PollingTask({
      name: 'test',
      intervalMs: INTERVAL_MS,
      task,
      logger: silentLogger,
    });

    polling.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);
    await polling.stop();

    expect(task).toHaveBeenCalledTimes(3);
  });

  it('start() es idempotente y stop() detiene las ejecuciones', async () => {
    const task = vi.fn(() => Promise.resolve());
    const polling = new PollingTask({
      name: 'test',
      intervalMs: INTERVAL_MS,
      task,
      logger: silentLogger,
    });

    polling.start();
    polling.start();
    await polling.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 5);

    expect(task).toHaveBeenCalledTimes(1);
    expect(polling.isRunning).toBe(false);
  });
});
