import { resolveWallClockTime } from '../../../shared/utils/time.js';
import { buildOccurrenceId, buildReminderKey } from '../domain/koth.identifiers.js';
/** Margen de búsqueda suficiente para encontrar siempre el siguiente KOTH diario. */
const NEXT_OCCURRENCE_SEARCH_DAYS = 2;
/**
 * Cálculos de calendario de los KOTH. Es un servicio puro: no conoce Discord,
 * la base de datos ni el reloj del sistema; todas las fechas se reciben como
 * parámetro.
 *
 * Las ocurrencias se generan día a día en la zona oficial, por lo que un KOTH a
 * las 02:00 pertenece al día natural siguiente al KOTH de las 22:00, y los
 * cambios de horario se resuelven con la base de datos de zonas IANA.
 */
export class KothTimeService {
    schedule;
    constructor(schedule) {
        this.schedule = schedule;
    }
    get timezone() {
        return this.schedule.timezone;
    }
    get slots() {
        return this.schedule.slots;
    }
    get reminderOffsetsMinutes() {
        return this.schedule.reminderOffsetsMinutes;
    }
    /** Mayor antelación configurada, en minutos (p. ej. 60). */
    get maxReminderOffsetMinutes() {
        return Math.max(...this.schedule.reminderOffsetsMinutes);
    }
    /** Ocurrencias cuyo inicio cumple `after < startsAt <= until`, ordenadas cronológicamente. */
    getOccurrencesInRange(range) {
        const afterMs = range.after.toMillis();
        const untilMs = range.until.toMillis();
        return this.getCandidateDays(range)
            .flatMap((day) => this.schedule.slots.map((slot) => this.buildOccurrence(day, slot)))
            .filter((occurrence) => {
            const startsAtMs = occurrence.startsAt.toMillis();
            return startsAtMs > afterMs && startsAtMs <= untilMs;
        })
            .sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());
    }
    /** Siguiente KOTH que todavía no ha comenzado. */
    getNextOccurrence(now) {
        const [next] = this.getUpcomingOccurrences(now);
        if (next === undefined) {
            throw new Error('No hay KOTH configurados');
        }
        return next;
    }
    /** Próxima ocurrencia de cada slot, en el orden definido en la configuración. */
    getNextOccurrencePerSlot(now) {
        const upcoming = this.getUpcomingOccurrences(now);
        return this.schedule.slots.map((slot) => {
            const next = upcoming.find((occurrence) => occurrence.slot.id === slot.id);
            if (next === undefined) {
                throw new Error(`No se encontró la próxima ocurrencia de ${slot.id}`);
            }
            return next;
        });
    }
    /**
     * Avisos de una ocurrencia, del más temprano al más tardío.
     * Se restan duraciones absolutas: "60 minutos antes" son siempre 60 minutos
     * reales, también en las noches de cambio de horario.
     */
    getReminders(occurrence) {
        return this.schedule.reminderOffsetsMinutes
            .map((offsetMinutes) => ({
            key: buildReminderKey(occurrence.id, offsetMinutes),
            occurrence,
            offsetMinutes,
            firesAt: occurrence.startsAt.minus({ minutes: offsetMinutes }),
        }))
            .sort((a, b) => a.firesAt.toMillis() - b.firesAt.toMillis());
    }
    getUpcomingOccurrences(now) {
        return this.getOccurrencesInRange({
            after: now,
            until: now.plus({ days: NEXT_OCCURRENCE_SEARCH_DAYS }),
        });
    }
    /** Días naturales (en la zona oficial) que pueden contener ocurrencias del rango. */
    getCandidateDays(range) {
        const firstDay = range.after.setZone(this.schedule.timezone).startOf('day').minus({ days: 1 });
        const lastDayMs = range.until.setZone(this.schedule.timezone).startOf('day').toMillis();
        const days = [];
        for (let day = firstDay; day.toMillis() <= lastDayMs; day = day.plus({ days: 1 })) {
            days.push(day);
        }
        return days;
    }
    buildOccurrence(day, slot) {
        const startsAt = resolveWallClockTime({ year: day.year, month: day.month, day: day.day, hour: slot.hour, minute: slot.minute }, this.schedule.timezone);
        return { id: buildOccurrenceId(slot.id, startsAt), slot, startsAt };
    }
}
//# sourceMappingURL=koth-time.service.js.map