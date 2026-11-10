import { describe, expect, it } from 'vitest';
import type { KothOccurrence } from '../../src/modules/koth/domain/koth.types.js';
import { createTimeService, madrid, utc } from '../helpers/time.js';

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

  describe('cambio de horario de verano a invierno (25/10/2026, 03:00 → 02:00)', () => {
    const fallBackNight = { after: madrid('2026-10-24T12:00'), until: madrid('2026-10-26T12:00') };

    it('genera un único KOTH de las 02:00 aunque esa hora se repita', () => {
      const occurrences = timeService.getOccurrencesInRange(fallBackNight);
      const koth3 = occurrences.filter((occurrence) => occurrence.slot.id === 'koth-3');

      expect(occurrences).toHaveLength(6);
      expect(new Set(occurrences.map((occurrence) => occurrence.id)).size).toBe(6);
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
