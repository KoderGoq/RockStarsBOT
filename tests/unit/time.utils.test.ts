import { describe, expect, it } from 'vitest';
import { toDiscordTimestamp } from '../../src/shared/utils/discord-timestamp.js';
import {
  formatMinutes,
  formatRemainingTime,
  resolveWallClockTime,
} from '../../src/shared/utils/time.js';
import { MADRID, madrid, utc } from '../helpers/time.js';

describe('utilidades de tiempo', () => {
  it.each([
    [10, '10 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [135, '2 h 15 min'],
  ])('formatMinutes(%i) → %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('redondea hacia arriba el tiempo restante para no mostrar "0 min"', () => {
    expect(formatRemainingTime(madrid('2026-11-09T16:59:30'), madrid('2026-11-09T17:00'))).toBe(
      '1 min',
    );
    expect(formatRemainingTime(madrid('2026-11-09T17:01'), madrid('2026-11-09T17:00'))).toBe(
      'ya ha comenzado',
    );
  });

  it('genera timestamps de Discord en segundos Unix', () => {
    expect(toDiscordTimestamp(utc('2026-11-09T16:00:00Z'), 'R')).toBe('<t:1794240000:R>');
  });

  it('resuelve una hora ambigua a su primera ocurrencia', () => {
    const resolved = resolveWallClockTime(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
      MADRID,
    );
    expect(resolved.toISO()).toBe('2026-10-25T02:30:00.000+02:00');
  });

  it('resuelve una hora inexistente al primer instante válido posterior', () => {
    const resolved = resolveWallClockTime(
      { year: 2026, month: 3, day: 29, hour: 2, minute: 30 },
      MADRID,
    );
    expect(resolved.toISO()).toBe('2026-03-29T03:30:00.000+02:00');
  });
});
