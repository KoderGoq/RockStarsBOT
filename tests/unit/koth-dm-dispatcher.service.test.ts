import { describe, expect, it } from 'vitest';
import { DeliveryStatus } from '../../src/modules/koth/domain/koth.constants.js';
import { createDmHarness, FakeDirectMessenger, subscribeAll } from '../helpers/direct-messages.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();

/** Clave del aviso de 10 minutos del KOTH que empieza en `localStart` (hora de Madrid). */
function tenMinuteKey(localStart: string): string {
  const occurrence = timeService.getNextOccurrence(madrid(localStart).minus({ seconds: 1 }));
  const reminder = timeService
    .getReminders(occurrence)
    .find((candidate) => candidate.offsetMinutes === 10);
  if (reminder === undefined) throw new Error('Aviso de 10 minutos no encontrado');
  return reminder.key;
}

const KOTH_1_KEY = tenMinuteKey('2026-11-09T17:00');

describe('KothDmDispatcherService', () => {
  describe('cuándo se envía', () => {
    it('no envía nada antes de que falten 10 minutos', async () => {
      const harness = createDmHarness({ startAt: '2026-11-09T16:49:59' });
      subscribeAll(harness, 'u1');

      const summary = await harness.dispatcher.run();

      expect(summary.sent).toEqual([]);
      expect(harness.messenger.attempts).toHaveLength(0);
    });

    it('envía el MD cuando faltan exactamente 10 minutos', async () => {
      const harness = createDmHarness({ startAt: '2026-11-09T16:50:00' });
      subscribeAll(harness, 'u1');

      const summary = await harness.dispatcher.run();

      expect(summary.sent).toEqual(['u1']);
      expect(harness.messenger.attempts[0]?.reminderKey).toBe(KOTH_1_KEY);
      expect(harness.deliveries.findStatus(KOTH_1_KEY, 'u1')).toBe(DeliveryStatus.Sent);
    });

    it('envía a todos los suscriptores, uno tras otro y con pausa entre cada envío', async () => {
      const harness = createDmHarness();
      subscribeAll(harness, 'u1', 'u2', 'u3');

      await harness.dispatcher.run();

      expect(harness.messenger.deliveredTo).toEqual(['u1', 'u2', 'u3']);
      expect(harness.pauses).toEqual([1_500, 1_500, 1_500]);
    });

    it('no envía a nadie cuando no hay suscriptores', async () => {
      const harness = createDmHarness();

      const summary = await harness.dispatcher.run();

      expect(summary.sent).toEqual([]);
    });

    it('no envía una vez iniciado el KOTH', async () => {
      const harness = createDmHarness({ startAt: '2026-11-09T17:00:00' });
      subscribeAll(harness, 'u1');

      await harness.dispatcher.run();

      expect(harness.messenger.attempts).toHaveLength(0);
    });

    it('no envía un aviso con más retraso del tolerado (8 minutos)', async () => {
      const late = createDmHarness({ startAt: '2026-11-09T16:58:30' });
      subscribeAll(late, 'u1');
      await late.dispatcher.run();
      expect(late.messenger.attempts).toHaveLength(0);

      const onTime = createDmHarness({ startAt: '2026-11-09T16:57:00' });
      subscribeAll(onTime, 'u1');
      await onTime.dispatcher.run();
      expect(onTime.messenger.deliveredTo).toEqual(['u1']);
    });

    it('se detiene en cuanto empieza el KOTH aunque queden suscriptores', async () => {
      const harness = createDmHarness({
        startAt: '2026-11-09T16:58:30',
        pauseAdvancesClock: true,
        options: { pauseBetweenSendsMs: 60_000, maxLatenessMs: 15 * 60_000 },
      });
      subscribeAll(harness, 'u1', 'u2', 'u3');

      await harness.dispatcher.run();

      // u1 a las 16:58:30 y u2 a las 16:59:30; a las 17:00:30 el KOTH ya ha empezado.
      expect(harness.messenger.deliveredTo).toEqual(['u1', 'u2']);
    });

    it('avisa 10 minutos antes del inicio real también en la noche del cambio de hora', async () => {
      // 29/03/2026: las 02:00 no existen y el KOTH 3 empieza a las 03:00 CEST (01:00 UTC).
      const harness = createDmHarness({ startAt: '2026-03-29T01:50:00' });
      subscribeAll(harness, 'u1');

      await harness.dispatcher.run();

      const attempt = harness.messenger.attempts[0];
      expect(attempt?.reminderKey).toBe('koth-3@2026-03-29T01:00:00.000Z#10m');
      expect(harness.clock.now().toUTC().toISO()).toBe('2026-03-29T00:50:00.000Z');
    });

    it('cubre los tres KOTH del día, cada uno con su propio aviso', async () => {
      const harness = createDmHarness({ startAt: '2026-11-09T16:50:00' });
      subscribeAll(harness, 'u1');

      for (const time of ['2026-11-09T16:50:00', '2026-11-09T21:50:00', '2026-11-10T01:50:00']) {
        harness.clock.set(madrid(time));
        await harness.dispatcher.run();
      }

      expect(harness.messenger.attempts.map(({ reminderKey }) => reminderKey)).toEqual([
        tenMinuteKey('2026-11-09T17:00'),
        tenMinuteKey('2026-11-09T22:00'),
        tenMinuteKey('2026-11-10T02:00'),
      ]);
    });
  });

  describe('prevención de duplicados', () => {
    it('ejecuciones repetidas no vuelven a enviar el mismo MD', async () => {
      const harness = createDmHarness();
      subscribeAll(harness, 'u1', 'u2');

      for (let second = 0; second < 5; second++) {
        await harness.dispatcher.run();
        harness.clock.advance({ seconds: 10 });
      }

      expect(harness.messenger.deliveredTo).toEqual(['u1', 'u2']);
    });

    it('ejecuciones simultáneas no envían dos veces el mismo MD', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.delayBy(10);
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1', 'u2');

      await Promise.all([harness.dispatcher.run(), harness.dispatcher.run()]);

      expect(messenger.deliveredTo.toSorted()).toEqual(['u1', 'u2']);
    });

    it('quien se suscribe con el aviso ya vencido, dentro del margen, también lo recibe', async () => {
      const harness = createDmHarness();
      subscribeAll(harness, 'u1');
      await harness.dispatcher.run();

      harness.clock.advance({ minutes: 3 });
      subscribeAll(harness, 'u2');
      await harness.dispatcher.run();

      expect(harness.messenger.deliveredTo).toEqual(['u1', 'u2']);
    });
  });

  describe('suscriptores que ya no pueden recibirlo', () => {
    it('da de baja a quien se ha ido del servidor y sigue con los demás', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.script('u2', { kind: 'not-member' });
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1', 'u2', 'u3');

      const summary = await harness.dispatcher.run();

      expect(messenger.deliveredTo).toEqual(['u1', 'u3']);
      expect(summary.unsubscribed).toEqual(['u2']);
      expect(harness.subscribers.has('u2')).toBe(false);
      expect(harness.deliveries.findStatus(KOTH_1_KEY, 'u2')).toBe(DeliveryStatus.Left);
    });

    it('con los MD cerrados no lo da de baja hasta el tercer fallo seguido', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.script(
        'u1',
        { kind: 'dms-closed' },
        { kind: 'dms-closed' },
        { kind: 'dms-closed' },
      );
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1');

      const afterKoth: boolean[] = [];
      for (const time of ['2026-11-09T16:50:00', '2026-11-09T21:50:00', '2026-11-10T01:50:00']) {
        harness.clock.set(madrid(time));
        await harness.dispatcher.run();
        afterKoth.push(harness.subscribers.has('u1'));
      }

      expect(afterKoth).toEqual([true, true, false]);
      expect(harness.deliveries.findStatus(KOTH_1_KEY, 'u1')).toBe(DeliveryStatus.Unreachable);
    });

    it('un MD entregado reinicia la cuenta de fallos seguidos', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.script(
        'u1',
        { kind: 'dms-closed' },
        { kind: 'dms-closed' },
        { kind: 'sent', messageId: 'ok' },
        { kind: 'dms-closed' },
      );
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1');

      for (const time of [
        '2026-11-09T16:50:00',
        '2026-11-09T21:50:00',
        '2026-11-10T01:50:00',
        '2026-11-10T16:50:00',
      ]) {
        harness.clock.set(madrid(time));
        await harness.dispatcher.run();
      }

      expect(harness.subscribers.has('u1')).toBe(true);
      expect(harness.subscribers.list()[0]?.consecutiveFailures).toBe(1);
    });

    it('un fallo inesperado no se reintenta, no da de baja y no frena al resto', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.script('u1', { kind: 'failed', error: new Error('boom') });
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1', 'u2');

      const first = await harness.dispatcher.run();
      const second = await harness.dispatcher.run();

      expect(first.failed).toEqual(['u1']);
      expect(second.failed).toEqual([]);
      expect(messenger.deliveredTo).toEqual(['u2']);
      expect(harness.subscribers.has('u1')).toBe(true);
      expect(harness.deliveries.findStatus(KOTH_1_KEY, 'u1')).toBe(DeliveryStatus.Failed);
    });

    it('si el mensajero lanza una excepción, el lote continúa', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.throwFor('u1');
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1', 'u2');

      const summary = await harness.dispatcher.run();

      expect(summary.failed).toEqual(['u1']);
      expect(messenger.deliveredTo).toEqual(['u2']);
    });
  });

  describe('límites de Discord', () => {
    it('al recibir un límite de MD frena el lote y retoma solo lo pendiente después', async () => {
      const messenger = new FakeDirectMessenger();
      messenger.script('u2', { kind: 'rate-limited' });
      const harness = createDmHarness({ messenger });
      subscribeAll(harness, 'u1', 'u2', 'u3');

      const first = await harness.dispatcher.run();

      expect(first.rateLimited).toBe(true);
      expect(messenger.deliveredTo).toEqual(['u1']);
      expect(harness.deliveries.findStatus(KOTH_1_KEY, 'u2')).toBeUndefined();

      harness.clock.advance({ seconds: 10 });
      const second = await harness.dispatcher.run();

      expect(second.rateLimited).toBe(false);
      expect(messenger.deliveredTo).toEqual(['u1', 'u2', 'u3']);
    });

    it('al apagarse el bot deja de enviar sin reservar a los que quedan', async () => {
      const harness = createDmHarness();
      subscribeAll(harness, 'u1', 'u2');
      const controller = new AbortController();
      controller.abort();

      await harness.dispatcher.run(controller.signal);

      expect(harness.messenger.attempts).toHaveLength(0);
      expect(harness.deliveries.listPendingUserIds(KOTH_1_KEY)).toEqual(['u1', 'u2']);
    });
  });
});
