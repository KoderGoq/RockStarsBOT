import { DateTime } from 'luxon';
import { kothConfig } from '../../src/config/koth.config.js';
import { KothTimeService } from '../../src/modules/koth/services/koth-time.service.js';
import type { Clock } from '../../src/shared/types/clock.js';

export const MADRID = 'Europe/Madrid';

/** Fecha en hora local de Madrid, p. ej. `madrid('2026-11-09T16:00')`. */
export function madrid(isoLocal: string): DateTime {
  const date = DateTime.fromISO(isoLocal, { zone: MADRID });
  if (!date.isValid) throw new Error(`Fecha de prueba inválida: ${isoLocal}`);
  return date;
}

export function utc(iso: string): DateTime {
  const date = DateTime.fromISO(iso, { zone: 'utc' });
  if (!date.isValid) throw new Error(`Fecha de prueba inválida: ${iso}`);
  return date;
}

export function createTimeService(): KothTimeService {
  return new KothTimeService({
    timezone: MADRID,
    slots: kothConfig.slots,
    reminderOffsetsMinutes: kothConfig.reminderOffsetsMinutes,
  });
}

/** Reloj controlable manualmente para las pruebas. */
export class FakeClock implements Clock {
  constructor(private current: DateTime) {}

  now(): DateTime {
    return this.current;
  }

  set(date: DateTime): void {
    this.current = date;
  }

  advance(duration: { minutes?: number; seconds?: number }): void {
    this.current = this.current.plus(duration);
  }
}
