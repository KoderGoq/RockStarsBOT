import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '../../src/shared/utils/sleep.js';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('espera el tiempo indicado', async () => {
    let done = false;
    void sleep(1_000).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('termina antes de tiempo si se cancela la señal', async () => {
    const controller = new AbortController();
    let done = false;
    void sleep(60_000, controller.signal).then(() => {
      done = true;
    });

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(done).toBe(true);
  });

  it('con la señal ya cancelada no espera nada', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(60_000, controller.signal)).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
