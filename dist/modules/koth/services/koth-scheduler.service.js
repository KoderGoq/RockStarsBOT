import { toUtcIsoString } from '../../../shared/utils/time.js';
import { SkipReason } from '../domain/koth.constants.js';
/**
 * Decide qué avisos de KOTH deben publicarse en un instante dado.
 *
 * No mantiene estado en memoria entre ticks: en cada ejecución recalcula los
 * avisos exigibles a partir de `now` y consulta la persistencia. Por eso se
 * recupera de reinicios sin pasos adicionales.
 *
 * Reglas por cada KOTH que aún no ha comenzado:
 * 1. Solo es candidato el aviso exigible más reciente; los anteriores no
 *    publicados se marcan como omitidos (`superseded`).
 * 2. Si el candidato lleva más de `maxLatenessMs` de retraso, se omite (`too-late`).
 * 3. El envío sigue el patrón reservar → enviar → confirmar. La reserva es
 *    atómica en la base de datos, lo que impide duplicados entre ticks
 *    concurrentes, reinicios o varias instancias. Si el envío falla, la reserva
 *    se libera y se reintenta en el siguiente tick (dentro del margen tolerado).
 */
export class KothSchedulerService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async tick(now) {
        const summary = { sent: [], skipped: [], failed: [] };
        for (const occurrence of this.getOccurrencesWithPossibleReminders(now)) {
            await this.processOccurrence(occurrence, now, summary);
        }
        return summary;
    }
    /** KOTH que aún no han comenzado y cuyo primer aviso ya puede haber vencido. */
    getOccurrencesWithPossibleReminders(now) {
        const { timeService } = this.deps;
        return timeService.getOccurrencesInRange({
            after: now,
            until: now.plus({ minutes: timeService.maxReminderOffsetMinutes }),
        });
    }
    async processOccurrence(occurrence, now, summary) {
        const dueReminders = this.deps.timeService
            .getReminders(occurrence)
            .filter((reminder) => reminder.firesAt.toMillis() <= now.toMillis());
        const latest = dueReminders.at(-1);
        if (latest === undefined)
            return;
        for (const superseded of dueReminders.slice(0, -1)) {
            this.skip(superseded, SkipReason.Superseded, now, summary);
        }
        if (this.isTooLate(latest, now)) {
            this.skip(latest, SkipReason.TooLate, now, summary);
            return;
        }
        await this.dispatch(latest, now, summary);
    }
    isTooLate(reminder, now) {
        const latenessMs = now.toMillis() - reminder.firesAt.toMillis();
        return latenessMs > this.deps.options.maxLatenessMs;
    }
    skip(reminder, reason, now, summary) {
        const recorded = this.deps.repository.recordSkipped(reminder, reason, now);
        if (!recorded)
            return;
        summary.skipped.push({ key: reminder.key, reason });
        this.deps.logger.info({ ...describeReminder(reminder), reason }, 'Aviso de KOTH omitido');
    }
    async dispatch(reminder, now, summary) {
        const { repository, announcer, logger } = this.deps;
        if (!repository.tryClaim(reminder, now))
            return;
        let messageId;
        try {
            ({ messageId } = await announcer.announce(reminder));
        }
        catch (error) {
            repository.release(reminder.key);
            summary.failed.push(reminder.key);
            logger.error({ err: error, ...describeReminder(reminder) }, 'No se pudo publicar el aviso de KOTH; se reintentará');
            return;
        }
        // Fuera del try: si la confirmación fallase, la reserva permanece y el aviso
        // no se reenvía (se prioriza no duplicar mensajes).
        repository.markSent(reminder.key, messageId, now);
        summary.sent.push(reminder.key);
        logger.info({ ...describeReminder(reminder), messageId }, 'Aviso de KOTH publicado');
    }
}
function describeReminder(reminder) {
    return {
        key: reminder.key,
        koth: reminder.occurrence.slot.name,
        offsetMinutes: reminder.offsetMinutes,
        startsAt: toUtcIsoString(reminder.occurrence.startsAt),
    };
}
//# sourceMappingURL=koth-scheduler.service.js.map