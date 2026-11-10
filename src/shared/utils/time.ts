import { DateTime } from 'luxon';

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

export interface WallClockTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/**
 * Convierte una hora "de reloj de pared" en una zona IANA a un instante exacto.
 *
 * Reglas ante cambios de horario:
 * - Hora inexistente (salto de primavera, p. ej. 02:00 → 03:00): Luxon la desplaza
 *   hacia delante, al primer instante válido.
 * - Hora ambigua (retroceso de otoño, las 02:00 ocurren dos veces): se elige la
 *   primera ocurrencia, igual que hace `cron`, para que los avisos previos sigan
 *   un orden natural en el reloj local.
 */
export function resolveWallClockTime(time: WallClockTime, zone: string): DateTime {
  const candidate = DateTime.fromObject({ ...time, second: 0, millisecond: 0 }, { zone });

  if (!candidate.isValid) {
    throw new Error(
      `No se pudo resolver la hora ${formatWallClock(time)} en ${zone}: ${candidate.invalidExplanation ?? 'motivo desconocido'}`,
    );
  }

  return earliestOf(candidate.getPossibleOffsets()) ?? candidate;
}

export function toUtcIsoString(date: DateTime): string {
  const iso = date.toUTC().toISO();
  if (iso === null) {
    throw new Error(`Fecha inválida: ${date.invalidExplanation ?? 'motivo desconocido'}`);
  }
  return iso;
}

export function formatHourMinute(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Texto legible del tiempo restante, p. ej. "2 h 15 min", "45 min". */
export function formatRemainingTime(from: DateTime, to: DateTime): string {
  const remainingMs = to.toMillis() - from.toMillis();
  if (remainingMs <= 0) {
    return 'ya ha comenzado';
  }

  const totalMinutes = Math.ceil(remainingMs / MILLISECONDS_PER_MINUTE);
  return formatMinutes(totalMinutes);
}

/** Texto legible de una duración en minutos, p. ej. 60 → "1 h", 90 → "1 h 30 min". */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function earliestOf(dates: readonly DateTime[]): DateTime | undefined {
  return dates.reduce<DateTime | undefined>(
    (earliest, date) =>
      earliest === undefined || date.toMillis() < earliest.toMillis() ? date : earliest,
    undefined,
  );
}

function formatWallClock(time: WallClockTime): string {
  const date = `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
  return `${date} ${formatHourMinute(time.hour, time.minute)}`;
}
