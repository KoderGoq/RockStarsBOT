import { describe, expect, it } from 'vitest';
import type { KothOccurrence } from '../../src/modules/koth/domain/koth.types.js';
import { KothTimeService } from '../../src/modules/koth/services/koth-time.service.js';
import { createTimeService, MADRID, madrid, utc } from '../helpers/time.js';

const timeService = createTimeService();

function utcIso(occurrence: KothOccurrence): string | null {
  return occurrence.startsAt.toUTC().toISO();
}

function reminderTimesUtc(occurrence: KothOccurrence) {
  return timeService.getReminders(occurrence).map((reminder) => ({
    offset: reminder.offsetMinutes,
    firesAt: reminder.firesAt.toUTC().toISO(),
  }));
}

describe('KothTimeService', () => {
  describe('cálculo del siguiente KOTH', () => {
    it.each([
      { now: '2026-11-09T12:00', expectedSlot: 'koth-1', expectedLocal: '2026-11-09T17:00' },
      { now: '2026-11-09T16:59:59', expectedSlot: 'koth-1', expectedLocal: '2026-11-09T17:00' },
      { now: '2026-11-09T17:00', expectedSlot: 'koth-2', expectedLocal: '2026-11-09T22:00' },
      { now: '2026-11-09T18:30', expectedSlot: 'koth-2', expectedLocal: '2026-11-09T22:00' },
      { now: '2026-11-09T22:00', expectedSlot: 'koth-3', expectedLocal: '2026-11-10T02:00' },
      { now: '2026-11-10T00:15', expectedSlot: 'koth-3', expectedLocal: '2026-11-10T02:00' },
      { now: '2026-11-10T02:00', expectedSlot: 'koth-1', expectedLocal: '2026-11-10T17:00' },
      { now: '2026-11-10T09:00', expectedSlot: 'koth-1', expectedLocal: '2026-11-10T17:00' },
    ])('a las $now el siguiente es $expectedSlot ($expectedLocal)', (testCase) => {
      const next = timeService.getNextOccurrence(madrid(testCase.now));

      expect(next.slot.id).toBe(testCase.expectedSlot);
      expect(next.startsAt.toMillis()).toBe(madrid(testCase.expectedLocal).toMillis());
    });

    it('un KOTH que comienza exactamente ahora ya no es el siguiente', () => {
      const next = timeService.getNextOccurrence(madrid('2026-11-09T17:00:00'));
      expect(next.slot.id).toBe('koth-2');
    });

    it('el resultado no depende de la zona en la que se exprese "ahora"', () => {
      const fromMadrid = timeService.getNextOccurrence(madrid('2026-11-09T12:00'));
      const fromUtc = timeService.getNextOccurrence(utc('2026-11-09T11:00:00Z'));
      expect(fromUtc.id).toBe(fromMadrid.id);
    });

    it('devuelve la ocurrencia expresada en la zona oficial', () => {
      const next = timeService.getNextOccurrence(utc('2026-11-09T11:00:00Z'));
      expect(next.startsAt.zoneName).toBe('Europe/Madrid');
      expect(next.startsAt.toFormat('HH:mm')).toBe('17:00');
    });

    it('devuelve la próxima ocurrencia de cada slot en el orden configurado', () => {
      const perSlot = timeService.getNextOccurrencePerSlot(madrid('2026-11-09T18:00'));

      expect(perSlot.map((occurrence) => occurrence.startsAt.toISO())).toEqual([
        '2026-11-10T17:00:00.000+01:00',
        '2026-11-09T22:00:00.000+01:00',
        '2026-11-10T02:00:00.000+01:00',
      ]);
    });
  });

  describe('cálculo de avisos de 60, 30 y 10 minutos', () => {
    it.each([
      { start: '2026-11-09T17:00', expected: ['16:00', '16:30', '16:50'] },
      { start: '2026-11-09T22:00', expected: ['21:00', '21:30', '21:50'] },
      { start: '2026-11-10T02:00', expected: ['01:00', '01:30', '01:50'] },
    ])('KOTH de las $start → avisos $expected', ({ start, expected }) => {
      const occurrence = timeService.getNextOccurrence(madrid(start).minus({ minutes: 1 }));
      const reminders = timeService.getReminders(occurrence);

      expect(reminders.map((reminder) => reminder.offsetMinutes)).toEqual([60, 30, 10]);
      expect(reminders.map((reminder) => reminder.firesAt.toFormat('HH:mm'))).toEqual(expected);
    });

    it('genera claves de idempotencia únicas y estables', () => {
      const occurrence = timeService.getNextOccurrence(madrid('2026-11-09T12:00'));
      const keys = timeService.getReminders(occurrence).map((reminder) => reminder.key);
      const keysAgain = timeService
        .getReminders(timeService.getNextOccurrence(madrid('2026-11-09T13:00')))
        .map((reminder) => reminder.key);

      expect(new Set(keys).size).toBe(3);
      expect(keysAgain).toEqual(keys);
      expect(keys[0]).toBe('koth-1@2026-11-09T16:00:00.000Z#60m');
    });
  });

  describe('eventos que cruzan la medianoche', () => {
    it('el KOTH de las 02:00 tras el de las 22:00 pertenece al día siguiente', () => {
      const next = timeService.getNextOccurrence(madrid('2026-11-09T22:00'));

      expect(next.slot.id).toBe('koth-3');
      expect(next.startsAt.toISODate()).toBe('2026-11-10');
    });

    it('lista las ocurrencias de un rango que cruza la medianoche en orden cronológico', () => {
      const occurrences = timeService.getOccurrencesInRange({
        after: madrid('2026-11-09T20:00'),
        until: madrid('2026-11-10T20:00'),
      });

      expect(occurrences.map((occurrence) => occurrence.startsAt.toISO())).toEqual([
        '2026-11-09T22:00:00.000+01:00',
        '2026-11-10T02:00:00.000+01:00',
        '2026-11-10T17:00:00.000+01:00',
      ]);
    });

    it('cruza correctamente el cambio de año', () => {
      const next = timeService.getNextOccurrence(madrid('2026-12-31T23:30'));
      expect(next.startsAt.toISO()).toBe('2027-01-01T02:00:00.000+01:00');
    });
  });

  describe('calendario semanal: los sábados solo hay el KOTH de las 02:00', () => {
    // Semana completa: lunes 9 a domingo 15 de noviembre de 2026 (hora de Madrid).
    const week = {
      after: madrid('2026-11-08T23:59:59'),
      until: madrid('2026-11-15T23:59:59'),
    };

    function onWeekday(weekday: number): KothOccurrence[] {
      return timeService
        .getOccurrencesInRange(week)
        .filter((occurrence) => occurrence.startsAt.weekday === weekday);
    }

    it('de lunes a viernes hay 3 KOTH, el sábado 1 y el domingo 3', () => {
      const countsByWeekday = [1, 2, 3, 4, 5, 6, 7].map((weekday) => onWeekday(weekday).length);

      expect(countsByWeekday).toEqual([3, 3, 3, 3, 3, 1, 3]);
    });

    it('el único KOTH del sábado es el de las 02:00', () => {
      const [only, ...others] = onWeekday(6);

      expect(others).toEqual([]);
      expect(only?.slot.id).toBe('koth-3');
      expect(only?.startsAt.toISO()).toBe('2026-11-14T02:00:00.000+01:00');
    });

    it('el domingo vuelve a haber los tres, empezando por el de las 02:00', () => {
      expect(onWeekday(7).map((occurrence) => occurrence.startsAt.toFormat('HH:mm'))).toEqual([
        '02:00',
        '17:00',
        '22:00',
      ]);
    });

    it('del viernes al lunes no se genera ningún KOTH de las 17:00 ni de las 22:00 el sábado', () => {
      const occurrences = timeService.getOccurrencesInRange({
        after: madrid('2026-11-13T12:00'),
        until: madrid('2026-11-16T12:00'),
      });

      expect(occurrences.map((occurrence) => occurrence.startsAt.toISO())).toEqual([
        '2026-11-13T17:00:00.000+01:00',
        '2026-11-13T22:00:00.000+01:00',
        '2026-11-14T02:00:00.000+01:00',
        '2026-11-15T02:00:00.000+01:00',
        '2026-11-15T17:00:00.000+01:00',
        '2026-11-15T22:00:00.000+01:00',
        '2026-11-16T02:00:00.000+01:00',
      ]);
    });

    it.each([
      {
        now: '2026-11-13T22:30',
        expected: '2026-11-14T02:00',
        description: 'tras el KOTH 2 del viernes',
      },
      {
        now: '2026-11-14T02:00',
        expected: '2026-11-15T02:00',
        description: 'tras el de las 02:00 del sábado',
      },
      {
        now: '2026-11-14T12:00',
        expected: '2026-11-15T02:00',
        description: 'el sábado a mediodía',
      },
      {
        now: '2026-11-14T19:13',
        expected: '2026-11-15T02:00',
        description: 'el sábado por la tarde',
      },
    ])('el siguiente KOTH $description es $expected', ({ now, expected }) => {
      const next = timeService.getNextOccurrence(madrid(now));

      expect(next.slot.id).toBe('koth-3');
      expect(next.startsAt.toMillis()).toBe(madrid(expected).toMillis());
    });

    it('el sábado, el próximo KOTH 1 y KOTH 2 son los del domingo', () => {
      const perSlot = timeService.getNextOccurrencePerSlot(madrid('2026-11-14T12:00'));

      expect(perSlot.map((occurrence) => occurrence.startsAt.toISO())).toEqual([
        '2026-11-15T17:00:00.000+01:00',
        '2026-11-15T22:00:00.000+01:00',
        '2026-11-15T02:00:00.000+01:00',
      ]);
    });

    it('en la noche del cambio de hora de primavera el sábado sigue teniendo solo el de las 02:00', () => {
      const saturday = timeService
        .getOccurrencesInRange({
          after: madrid('2026-03-28T00:00'),
          until: madrid('2026-03-28T23:59'),
        })
        .map((occurrence) => occurrence.slot.id);

      expect(saturday).toEqual(['koth-3']);
    });

    it('un KOTH que se celebra pocos días a la semana se encuentra aunque esté a varios días', () => {
      const mondayAndThursday = new KothTimeService({
        timezone: MADRID,
        reminderOffsetsMinutes: [60, 30, 10],
        slots: [{ id: 'solo-lunes-jueves', name: 'KOTH L-J', hour: 20, minute: 0, days: [1, 4] }],
      });

      // Jueves 12/11 a las 21:00: el siguiente es el lunes 16/11 (4 días después).
      const next = mondayAndThursday.getNextOccurrence(madrid('2026-11-12T21:00'));

      expect(next.startsAt.toISO()).toBe('2026-11-16T20:00:00.000+01:00');
    });
  });

  describe('cambio de horario de verano a invierno (25/10/2026, 03:00 → 02:00)', () => {
    const fallBackNight = { after: madrid('2026-10-24T12:00'), until: madrid('2026-10-26T12:00') };

    it('genera un único KOTH de las 02:00 aunque esa hora se repita', () => {
      const occurrences = timeService.getOccurrencesInRange(fallBackNight);
      const koth3 = occurrences.filter((occurrence) => occurrence.slot.id === 'koth-3');

      // Sábado 24 (solo KOTH 3, ya fuera del rango por la hora) + domingo 25 (3) + lunes 26 a las 02:00.
      expect(occurrences).toHaveLength(4);
      expect(new Set(occurrences.map((occurrence) => occurrence.id)).size).toBe(4);
      expect(koth3.map(utcIso)).toEqual(['2026-10-25T00:00:00.000Z', '2026-10-26T01:00:00.000Z']);
    });

    it('elige la primera ocurrencia de las 02:00 (todavía en CEST)', () => {
      const koth3 = timeService.getNextOccurrence(madrid('2026-10-24T22:30'));

      expect(koth3.startsAt.toISO()).toBe('2026-10-25T02:00:00.000+02:00');
    });

    it('los avisos son exactamente 60, 30 y 10 minutos antes y siguen el orden del reloj local', () => {
      const koth3 = timeService.getNextOccurrence(madrid('2026-10-24T22:30'));
      const reminders = timeService.getReminders(koth3);

      expect(reminderTimesUtc(koth3)).toEqual([
        { offset: 60, firesAt: '2026-10-24T23:00:00.000Z' },
        { offset: 30, firesAt: '2026-10-24T23:30:00.000Z' },
        { offset: 10, firesAt: '2026-10-24T23:50:00.000Z' },
      ]);
      expect(reminders.map((reminder) => reminder.firesAt.toFormat('HH:mm'))).toEqual([
        '01:00',
        '01:30',
        '01:50',
      ]);
    });

    it('los KOTH del día siguiente ya usan el horario de invierno (UTC+1)', () => {
      const koth1 = timeService.getNextOccurrence(madrid('2026-10-25T12:00'));

      expect(koth1.startsAt.toISO()).toBe('2026-10-25T17:00:00.000+01:00');
      expect(utcIso(koth1)).toBe('2026-10-25T16:00:00.000Z');
    });
  });

  describe('cambio de horario de invierno a verano (29/03/2026, 02:00 → 03:00)', () => {
    it('las 02:00 no existen: el KOTH se resuelve al primer instante válido (03:00 CEST)', () => {
      const koth3 = timeService.getNextOccurrence(madrid('2026-03-28T22:30'));

      expect(koth3.slot.id).toBe('koth-3');
      expect(koth3.startsAt.toISO()).toBe('2026-03-29T03:00:00.000+02:00');
      expect(utcIso(koth3)).toBe('2026-03-29T01:00:00.000Z');
    });

    it('los avisos son exactamente 60, 30 y 10 minutos antes del inicio real', () => {
      const koth3 = timeService.getNextOccurrence(madrid('2026-03-28T22:30'));
      const reminders = timeService.getReminders(koth3);

      expect(reminderTimesUtc(koth3)).toEqual([
        { offset: 60, firesAt: '2026-03-29T00:00:00.000Z' },
        { offset: 30, firesAt: '2026-03-29T00:30:00.000Z' },
        { offset: 10, firesAt: '2026-03-29T00:50:00.000Z' },
      ]);
      expect(reminders.map((reminder) => reminder.firesAt.toFormat('HH:mm'))).toEqual([
        '01:00',
        '01:30',
        '01:50',
      ]);
    });

    it('los KOTH de ese día ya usan el horario de verano (UTC+2)', () => {
      const koth1 = timeService.getNextOccurrence(madrid('2026-03-29T12:00'));

      expect(koth1.startsAt.toISO()).toBe('2026-03-29T17:00:00.000+02:00');
      expect(utcIso(koth1)).toBe('2026-03-29T15:00:00.000Z');
    });

    it('sigue generando tres KOTH en un día de 23 horas', () => {
      const occurrences = timeService.getOccurrencesInRange({
        after: madrid('2026-03-29T00:00'),
        until: madrid('2026-03-29T23:59'),
      });
      expect(occurrences.map((occurrence) => occurrence.slot.id)).toEqual([
        'koth-3',
        'koth-1',
        'koth-2',
      ]);
    });
  });
});
