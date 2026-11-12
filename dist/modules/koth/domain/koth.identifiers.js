import { toUtcIsoString } from '../../../shared/utils/time.js';
/**
 * Los identificadores se basan en el instante UTC, que es único e inmune a los
 * cambios de horario (a diferencia de la hora local, que puede repetirse).
 */
export function buildOccurrenceId(slotId, startsAt) {
    return `${slotId}@${toUtcIsoString(startsAt)}`;
}
export function buildReminderKey(occurrenceId, offsetMinutes) {
    return `${occurrenceId}#${offsetMinutes}m`;
}
//# sourceMappingURL=koth.identifiers.js.map