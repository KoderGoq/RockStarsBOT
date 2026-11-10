import type { DateTime } from 'luxon';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import type { ReminderOffsetMinutes } from './koth.types.js';

/**
 * Los identificadores se basan en el instante UTC, que es único e inmune a los
 * cambios de horario (a diferencia de la hora local, que puede repetirse).
 */
export function buildOccurrenceId(slotId: string, startsAt: DateTime): string {
  return `${slotId}@${toUtcIsoString(startsAt)}`;
}

export function buildReminderKey(
  occurrenceId: string,
  offsetMinutes: ReminderOffsetMinutes,
): string {
  return `${occurrenceId}#${offsetMinutes}m`;
}
