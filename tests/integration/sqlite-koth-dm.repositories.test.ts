import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeliveryStatus } from '../../src/modules/koth/domain/koth.constants.js';
import { createDmHarness, type DmHarness } from '../helpers/direct-messages.js';
import { madrid } from '../helpers/time.js';

const now = madrid('2026-11-09T16:50:00');
const eventStartsAt = madrid('2026-11-09T17:00:00');
const KEY = 'koth-1@2026-11-09T16:00:00.000Z#10m';

describe('SqliteKothSubscriberRepository', () => {
  let harness: DmHarness;

  beforeEach(() => {
    harness = createDmHarness();
  });

  afterEach(() => {
    harness.database.close();
  });

  it('da de alta una sola vez a cada usuario', () => {
    expect(harness.subscribers.add('u1', now)).toBe(true);
    expect(harness.subscribers.add('u1', now)).toBe(false);
    expect(harness.subscribers.has('u1')).toBe(true);
  });

  it('da de baja y distingue si estaba suscrito', () => {
    harness.subscribers.add('u1', now);

    expect(harness.subscribers.remove('u1')).toBe(true);
    expect(harness.subscribers.remove('u1')).toBe(false);
    expect(harness.subscribers.has('u1')).toBe(false);
  });

  it('lista por antigüedad y guarda la fecha de alta en UTC', () => {
    harness.subscribers.add('u2', now);
    harness.subscribers.add('u1', now.plus({ minutes: 5 }));

    expect(harness.subscribers.list()).toEqual([
      { userId: 'u2', subscribedAt: '2026-11-09T15:50:00.000Z', consecutiveFailures: 0 },
      { userId: 'u1', subscribedAt: '2026-11-09T15:55:00.000Z', consecutiveFailures: 0 },
    ]);
  });

  it('cuenta los fallos seguidos y permite reiniciarlos', () => {
    harness.subscribers.add('u1', now);

    expect(harness.subscribers.recordFailure('u1')).toBe(1);
    expect(harness.subscribers.recordFailure('u1')).toBe(2);
    harness.subscribers.resetFailures('u1');
    expect(harness.subscribers.recordFailure('u1')).toBe(1);
  });

  it('registrar un fallo de alguien no suscrito devuelve 0', () => {
    expect(harness.subscribers.recordFailure('desconocido')).toBe(0);
  });
});

describe('SqliteKothDmDeliveryRepository', () => {
  let harness: DmHarness;

  beforeEach(() => {
    harness = createDmHarness();
  });

  afterEach(() => {
    harness.database.close();
  });

  it('la reserva es exclusiva por (aviso, usuario)', () => {
    expect(harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now)).toBe(true);
    expect(harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now)).toBe(false);
    expect(harness.deliveries.tryClaim(KEY, 'u2', eventStartsAt, now)).toBe(true);
    expect(harness.deliveries.tryClaim('otro-aviso', 'u1', eventStartsAt, now)).toBe(true);
  });

  it('confirma el envío y no permite confirmar sin reserva', () => {
    harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now);

    harness.deliveries.markSent(KEY, 'u1', 'm1', now);

    expect(harness.deliveries.findStatus(KEY, 'u1')).toBe(DeliveryStatus.Sent);
    expect(() => {
      harness.deliveries.markSent(KEY, 'u9', 'm9', now);
    }).toThrow(/reserva/);
  });

  it('registra los envíos sin entrega con su estado', () => {
    harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now);

    harness.deliveries.markUndelivered(KEY, 'u1', DeliveryStatus.Unreachable, now);

    expect(harness.deliveries.findStatus(KEY, 'u1')).toBe(DeliveryStatus.Unreachable);
  });

  it('liberar una reserva permite reclamarla otra vez, pero no borra un envío ya hecho', () => {
    harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now);
    harness.deliveries.release(KEY, 'u1');
    expect(harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now)).toBe(true);

    harness.deliveries.markSent(KEY, 'u1', 'm1', now);
    harness.deliveries.release(KEY, 'u1');

    expect(harness.deliveries.findStatus(KEY, 'u1')).toBe(DeliveryStatus.Sent);
  });

  it('los pendientes son los suscriptores sin registro para ese aviso', () => {
    for (const userId of ['u1', 'u2', 'u3']) harness.subscribers.add(userId, now);
    harness.deliveries.tryClaim(KEY, 'u2', eventStartsAt, now);

    expect(harness.deliveries.listPendingUserIds(KEY)).toEqual(['u1', 'u3']);
    expect(harness.deliveries.listPendingUserIds('otro-aviso')).toEqual(['u1', 'u2', 'u3']);
  });

  it('no incluye entre los pendientes a quien se dio de baja', () => {
    harness.subscribers.add('u1', now);
    harness.subscribers.add('u2', now);
    harness.subscribers.remove('u1');

    expect(harness.deliveries.listPendingUserIds(KEY)).toEqual(['u2']);
  });

  it('depura el historial de eventos antiguos', () => {
    const oldStart = madrid('2026-09-01T17:00:00');
    harness.deliveries.tryClaim('aviso-antiguo', 'u1', oldStart, now);
    harness.deliveries.tryClaim(KEY, 'u1', eventStartsAt, now);

    const deleted = harness.deliveries.deleteEventsBefore(now.minus({ days: 30 }));

    expect(deleted).toBe(1);
    expect(harness.deliveries.findStatus('aviso-antiguo', 'u1')).toBeUndefined();
    expect(harness.deliveries.findStatus(KEY, 'u1')).toBeDefined();
  });
});

describe('Recuperación tras reiniciar el bot (MD)', () => {
  let directory: string;
  let databasePath: string;
  const open: DmHarness[] = [];

  function startProcess(startAt: string): DmHarness {
    const harness = createDmHarness({ databasePath, startAt });
    open.push(harness);
    return harness;
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'boutcraft-dm-'));
    databasePath = join(directory, 'boutcraft.sqlite');
  });

  afterEach(() => {
    for (const harness of open.splice(0)) harness.database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('los suscriptores sobreviven a un reinicio', () => {
    const first = startProcess('2026-11-09T16:00:00');
    first.subscribers.add('u1', first.clock.now());
    first.database.close();
    open.splice(open.indexOf(first), 1);

    const second = startProcess('2026-11-09T16:30:00');

    expect(second.subscribers.has('u1')).toBe(true);
  });

  it('un reinicio a mitad del reparto no repite los MD ya enviados y termina el resto', async () => {
    const first = startProcess('2026-11-09T16:50:00');
    for (const userId of ['u1', 'u2', 'u3']) first.subscribers.add(userId, first.clock.now());
    // El proceso cae tras haber enviado solo el MD de u1.
    first.messenger.script('u2', { kind: 'rate-limited' });
    await first.dispatcher.run();
    expect(first.messenger.deliveredTo).toEqual(['u1']);
    first.database.close();
    open.splice(open.indexOf(first), 1);

    const second = startProcess('2026-11-09T16:51:00');
    await second.dispatcher.run();

    expect(second.messenger.deliveredTo).toEqual(['u2', 'u3']);
  });
});
