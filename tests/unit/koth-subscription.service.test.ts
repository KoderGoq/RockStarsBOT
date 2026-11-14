import { describe, expect, it } from 'vitest';
import { createDmHarness, FakeDirectMessenger } from '../helpers/direct-messages.js';

describe('KothSubscriptionService', () => {
  it('suscribe a quien lo pide y le envía el MD de confirmación', async () => {
    const harness = createDmHarness();

    const result = await harness.subscriptions.subscribe('u1');

    expect(result).toEqual({ kind: 'subscribed' });
    expect(harness.messenger.confirmations).toEqual(['u1']);
    expect(harness.subscribers.has('u1')).toBe(true);
  });

  it('si ya estaba suscrito no vuelve a escribirle', async () => {
    const harness = createDmHarness();
    await harness.subscriptions.subscribe('u1');

    const result = await harness.subscriptions.subscribe('u1');

    expect(result).toEqual({ kind: 'already-subscribed' });
    expect(harness.messenger.confirmations).toEqual(['u1']);
  });

  it('no suscribe a quien tiene los MD cerrados', async () => {
    const messenger = new FakeDirectMessenger();
    messenger.setConfirmationOutcome({ kind: 'dms-closed' });
    const harness = createDmHarness({ messenger });

    const result = await harness.subscriptions.subscribe('u1');

    expect(result).toEqual({ kind: 'dms-closed' });
    expect(harness.subscribers.has('u1')).toBe(false);
  });

  it.each([
    { kind: 'rate-limited' as const },
    { kind: 'failed' as const, error: new Error('boom') },
    { kind: 'not-member' as const },
  ])('con el resultado "$kind" no suscribe y pide reintentar', async (outcome) => {
    const messenger = new FakeDirectMessenger();
    messenger.setConfirmationOutcome(outcome);
    const harness = createDmHarness({ messenger });

    const result = await harness.subscriptions.subscribe('u1');

    expect(result).toEqual({ kind: 'unavailable' });
    expect(harness.subscribers.has('u1')).toBe(false);
  });

  it('dos peticiones simultáneas dan de alta una sola vez', async () => {
    const messenger = new FakeDirectMessenger();
    const harness = createDmHarness({ messenger });

    await Promise.all([
      harness.subscriptions.subscribe('u1'),
      harness.subscriptions.subscribe('u1'),
    ]);

    expect(harness.subscriptions.list()).toHaveLength(1);
  });

  it('permite darse de baja y avisa si no estaba suscrito', async () => {
    const harness = createDmHarness();
    await harness.subscriptions.subscribe('u1');

    expect(harness.subscriptions.unsubscribe('u1')).toBe(true);
    expect(harness.subscriptions.unsubscribe('u1')).toBe(false);
    expect(harness.subscriptions.list()).toEqual([]);
  });

  it('lista a los suscriptores del más antiguo al más reciente', async () => {
    const harness = createDmHarness();

    await harness.subscriptions.subscribe('u2');
    harness.clock.advance({ minutes: 1 });
    await harness.subscriptions.subscribe('u1');

    expect(harness.subscriptions.list().map(({ userId }) => userId)).toEqual(['u2', 'u1']);
  });
});
