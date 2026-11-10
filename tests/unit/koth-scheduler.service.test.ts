import { describe, expect, it } from 'vitest';
import { NotificationStatus, SkipReason } from '../../src/modules/koth/domain/koth.constants.js';
import { createSchedulerHarness, FakeAnnouncer, runTicksBetween } from '../helpers/scheduler.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();

/** Clave del aviso de `offset` minutos para el KOTH que empieza en `localStart` (Madrid). */
function reminderKey(localStart: string, offset: 60 | 30 | 10): string {
  const occurrence = timeService.getNextOccurrence(madrid(localStart).minus({ seconds: 1 }));
  const reminder = timeService
    .getReminders(occurrence)
    .find((candidate) => candidate.offsetMinutes === offset);
  if (reminder === undefined) throw new Error('Aviso no encontrado');
  return reminder.key;
}

describe('KothSchedulerService', () => {
  describe('publicación de avisos', () => {
    it('no publica nada antes de la hora del aviso', async () => {
      const { scheduler, announcer } = createSchedulerHarness();

      const summary = await scheduler.tick(madrid('2026-11-09T15:59:59'));

      expect(summary.sent).toEqual([]);
      expect(announcer.announced).toHaveLength(0);
    });

    it('publica el aviso de 60 minutos a su hora exacta', async () => {
      const { scheduler, announcer, repository } = createSchedulerHarness();

      const summary = await scheduler.tick(madrid('2026-11-09T16:00:00'));

      const key = reminderKey('2026-11-09T17:00', 60);
      expect(summary.sent).toEqual([key]);
      expect(announcer.announced[0]?.offsetMinutes).toBe(60);
      expect(repository.findByKey(key)).toMatchObject({
        status: NotificationStatus.Sent,
        messageId: 'message-1',
      });
    });

    it('simula un día completo: 9 avisos, en orden y a su hora', async () => {
      const { scheduler } = createSchedulerHarness();

      const sent = await runTicksBetween(
        scheduler,
        madrid('2026-11-09T15:00'),
        madrid('2026-11-10T03:00'),
        30,
      );

      expect(sent.map(({ key }) => key)).toEqual([
        reminderKey('2026-11-09T17:00', 60),
        reminderKey('2026-11-09T17:00', 30),
        reminderKey('2026-11-09T17:00', 10),
        reminderKey('2026-11-09T22:00', 60),
        reminderKey('2026-11-09T22:00', 30),
        reminderKey('2026-11-09T22:00', 10),
        reminderKey('2026-11-10T02:00', 60),
        reminderKey('2026-11-10T02:00', 30),
        reminderKey('2026-11-10T02:00', 10),
      ]);
      expect(sent.map(({ sentAt }) => sentAt.toFormat('HH:mm:ss'))).toEqual([
        '16:00:00',
        '16:30:00',
        '16:50:00',
        '21:00:00',
        '21:30:00',
        '21:50:00',
        '01:00:00',
        '01:30:00',
        '01:50:00',
      ]);
    });
  });

  describe('cambios de horario', () => {
    it('verano → invierno: el KOTH de las 02:00 se anuncia una sola vez', async () => {
      const { scheduler } = createSchedulerHarness();

      const sent = await runTicksBetween(
        scheduler,
        madrid('2026-10-24T21:30'),
        madrid('2026-10-25T03:30'),
        30,
      );

      const koth3 = sent.filter(({ key }) => key.startsWith('koth-3'));
      expect(koth3).toHaveLength(3);
      expect(koth3.map(({ sentAt }) => sentAt.toUTC().toISO())).toEqual([
        '2026-10-24T23:00:00.000Z',
        '2026-10-24T23:30:00.000Z',
        '2026-10-24T23:50:00.000Z',
      ]);
    });

    it('invierno → verano: el KOTH de la noche del cambio se anuncia completo', async () => {
      const { scheduler } = createSchedulerHarness();

      const sent = await runTicksBetween(
        scheduler,
        madrid('2026-03-28T21:30'),
        madrid('2026-03-29T04:00'),
        30,
      );

      const koth3 = sent.filter(({ key }) => key.startsWith('koth-3'));
      expect(koth3.map(({ sentAt }) => sentAt.toUTC().toISO())).toEqual([
        '2026-03-29T00:00:00.000Z',
        '2026-03-29T00:30:00.000Z',
        '2026-03-29T00:50:00.000Z',
      ]);
    });
  });

  describe('prevención de duplicados', () => {
    it('ticks repetidos dentro de la ventana del aviso solo publican una vez', async () => {
      const { scheduler, announcer } = createSchedulerHarness();

      await runTicksBetween(scheduler, madrid('2026-11-09T16:00'), madrid('2026-11-09T16:04'), 10);

      expect(announcer.announcedKeys).toEqual([reminderKey('2026-11-09T17:00', 60)]);
    });

    it('ticks concurrentes no publican el mismo aviso dos veces', async () => {
      const announcer = new FakeAnnouncer();
      announcer.delayBy(20);
      const { scheduler } = createSchedulerHarness({ announcer });
      const now = madrid('2026-11-09T16:00:05');

      const summaries = await Promise.all([scheduler.tick(now), scheduler.tick(now)]);

      expect(announcer.announced).toHaveLength(1);
      expect(summaries.flatMap((summary) => summary.sent)).toHaveLength(1);
    });

    it('no reenvía un aviso reservado cuyo proceso cayó antes de confirmar', async () => {
      const { scheduler, announcer, repository } = createSchedulerHarness();
      const now = madrid('2026-11-09T16:00:00');
      const [reminder] = timeService.getReminders(timeService.getNextOccurrence(now));
      repository.tryClaim(reminder!, now);

      await scheduler.tick(now.plus({ seconds: 10 }));

      expect(announcer.announced).toHaveLength(0);
      expect(repository.findByKey(reminder!.key)?.status).toBe(NotificationStatus.Processing);
    });
  });

  describe('fallos de envío', () => {
    it('libera la reserva y reintenta en el siguiente tick', async () => {
      const announcer = new FakeAnnouncer();
      announcer.failNext(1);
      const { scheduler, repository } = createSchedulerHarness({ announcer });
      const key = reminderKey('2026-11-09T17:00', 60);

      const first = await scheduler.tick(madrid('2026-11-09T16:00:00'));
      expect(first.failed).toEqual([key]);
      expect(repository.findByKey(key)).toBeUndefined();

      const second = await scheduler.tick(madrid('2026-11-09T16:00:10'));
      expect(second.sent).toEqual([key]);
      expect(announcer.announced).toHaveLength(1);
    });

    it('deja de reintentar cuando se supera el retraso máximo', async () => {
      const announcer = new FakeAnnouncer();
      announcer.failNext(Number.POSITIVE_INFINITY);
      const { scheduler, repository } = createSchedulerHarness({ announcer });
      const key = reminderKey('2026-11-09T17:00', 60);

      await runTicksBetween(scheduler, madrid('2026-11-09T16:00'), madrid('2026-11-09T16:06'), 30);

      expect(repository.findByKey(key)).toMatchObject({
        status: NotificationStatus.Skipped,
        skipReason: SkipReason.TooLate,
      });
    });
  });

  describe('arranque después de la hora de un aviso', () => {
    it('envía solo el aviso más reciente si está dentro del margen y omite los anteriores', async () => {
      const { scheduler, announcer, repository } = createSchedulerHarness();

      const summary = await scheduler.tick(madrid('2026-11-09T16:33'));

      expect(announcer.announcedKeys).toEqual([reminderKey('2026-11-09T17:00', 30)]);
      expect(summary.skipped).toEqual([
        { key: reminderKey('2026-11-09T17:00', 60), reason: SkipReason.Superseded },
      ]);
      expect(repository.findByKey(reminderKey('2026-11-09T17:00', 60))?.status).toBe(
        NotificationStatus.Skipped,
      );
    });

    it('omite un aviso con demasiado retraso y publica el siguiente a su hora', async () => {
      const { scheduler, announcer } = createSchedulerHarness();

      const lateStart = await scheduler.tick(madrid('2026-11-09T16:40'));
      expect(lateStart.sent).toEqual([]);
      expect(lateStart.skipped.map(({ reason }) => reason).sort()).toEqual([
        SkipReason.Superseded,
        SkipReason.TooLate,
      ]);

      await scheduler.tick(madrid('2026-11-09T16:50'));
      expect(announcer.announcedKeys).toEqual([reminderKey('2026-11-09T17:00', 10)]);
    });

    it('no publica avisos de un KOTH que ya ha comenzado', async () => {
      const { scheduler, announcer } = createSchedulerHarness({ maxLatenessMs: 60 * 60_000 });

      const summary = await scheduler.tick(madrid('2026-11-09T17:00:00'));
      await scheduler.tick(madrid('2026-11-09T17:02:00'));

      expect(summary.sent).toEqual([]);
      expect(announcer.announced).toHaveLength(0);
    });

    it('tras arrancar con un KOTH ya iniciado, anuncia el siguiente con normalidad', async () => {
      const { scheduler, announcer } = createSchedulerHarness();

      await scheduler.tick(madrid('2026-11-09T17:05'));
      await scheduler.tick(madrid('2026-11-09T21:00'));

      expect(announcer.announcedKeys).toEqual([reminderKey('2026-11-09T22:00', 60)]);
    });

    it('no vuelve a registrar avisos ya procesados en ticks posteriores', async () => {
      const { scheduler } = createSchedulerHarness();

      await scheduler.tick(madrid('2026-11-09T16:40'));
      const later = await scheduler.tick(madrid('2026-11-09T16:41'));

      expect(later.skipped).toEqual([]);
      expect(later.sent).toEqual([]);
    });
  });
});
