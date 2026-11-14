import { toUtcIsoString } from '../../../shared/utils/time.js';
import { DeliveryStatus } from '../domain/koth.constants.js';
/**
 * Envía el MD de "el KOTH está a punto de empezar" a los suscriptores.
 *
 * Igual que el scheduler del canal, no guarda estado en memoria: en cada ejecución
 * recalcula qué aviso toca a partir del reloj y consulta la base de datos, por lo
 * que se recupera de reinicios sin pasos adicionales.
 *
 * Garantías:
 * - Cada (aviso, usuario) se reserva atómicamente antes de enviar: nadie recibe el
 *   mismo MD dos veces, ni con ticks repetidos, reinicios o dos instancias.
 * - Se envía espaciado (`pauseBetweenSendsMs`) para no disparar los límites de Discord.
 * - Nunca se envía una vez iniciado el KOTH ni con más retraso del tolerado.
 * - Quien se suscribe con el aviso ya vencido, pero dentro del margen, también lo recibe.
 * - Se detiene al apagarse el bot (señal cancelada) sin perder envíos: los pendientes
 *   no se reservan y se retoman en el siguiente arranque si aún hay margen.
 */
export class KothDmDispatcherService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async run(signal) {
        const summary = {
            sent: [],
            unsubscribed: [],
            failed: [],
            rateLimited: false,
        };
        for (const reminder of this.findDueReminders(this.deps.clock.now())) {
            const completed = await this.dispatchReminder(reminder, summary, signal);
            if (!completed)
                break;
        }
        return summary;
    }
    /** Avisos de MD ya vencidos de los KOTH que aún no han comenzado. */
    findDueReminders(now) {
        const { timeService, options } = this.deps;
        return timeService
            .getOccurrencesInRange({ after: now, until: now.plus({ minutes: options.offsetMinutes }) })
            .flatMap((occurrence) => timeService
            .getReminders(occurrence)
            .filter((reminder) => reminder.offsetMinutes === options.offsetMinutes));
    }
    /** Devuelve `false` si hay que dejar de procesar (apagado o límite de Discord). */
    async dispatchReminder(reminder, summary, signal) {
        const { deliveries, clock, pause, options } = this.deps;
        for (const userId of deliveries.listPendingUserIds(reminder.key)) {
            if (signal?.aborted === true)
                return false;
            const now = clock.now();
            if (!this.canStillSend(reminder, now))
                return true;
            if (!deliveries.tryClaim(reminder.key, userId, reminder.occurrence.startsAt, now))
                continue;
            const outcome = await this.send(userId, reminder);
            const keepGoing = this.applyOutcome(userId, reminder, outcome, summary);
            if (!keepGoing)
                return false;
            await pause(options.pauseBetweenSendsMs, signal);
        }
        return true;
    }
    canStillSend(reminder, now) {
        const hasStarted = now.toMillis() >= reminder.occurrence.startsAt.toMillis();
        const latenessMs = now.toMillis() - reminder.firesAt.toMillis();
        return !hasStarted && latenessMs <= this.deps.options.maxLatenessMs;
    }
    async send(userId, reminder) {
        try {
            return await this.deps.messenger.sendReminder(userId, reminder);
        }
        catch (error) {
            // El puerto no debe lanzar, pero un fallo inesperado nunca debe tumbar el lote.
            return { kind: 'failed', error };
        }
    }
    /** Registra el resultado. Devuelve `false` si hay que parar el lote. */
    applyOutcome(userId, reminder, outcome, summary) {
        const { deliveries, subscribers, clock, logger, options } = this.deps;
        const now = clock.now();
        const context = {
            koth: reminder.occurrence.slot.name,
            startsAt: toUtcIsoString(reminder.occurrence.startsAt),
        };
        switch (outcome.kind) {
            case 'sent':
                deliveries.markSent(reminder.key, userId, outcome.messageId, now);
                subscribers.resetFailures(userId);
                summary.sent.push(userId);
                logger.info({ ...context, userId, messageId: outcome.messageId }, 'MD de KOTH enviado');
                return true;
            case 'not-member':
                deliveries.markUndelivered(reminder.key, userId, DeliveryStatus.Left, now);
                subscribers.remove(userId);
                summary.unsubscribed.push(userId);
                logger.info({ ...context, userId }, 'Suscriptor dado de baja: ya no está en el servidor');
                return true;
            case 'dms-closed': {
                deliveries.markUndelivered(reminder.key, userId, DeliveryStatus.Unreachable, now);
                const failures = subscribers.recordFailure(userId);
                logger.info({ ...context, userId, failures }, 'No se pudo enviar el MD: MD cerrados');
                if (failures >= options.maxConsecutiveFailures) {
                    subscribers.remove(userId);
                    summary.unsubscribed.push(userId);
                    logger.info({ userId, failures }, 'Suscriptor dado de baja por MD cerrados repetidos');
                }
                return true;
            }
            case 'rate-limited':
                deliveries.release(reminder.key, userId);
                summary.rateLimited = true;
                logger.warn(context, 'Discord pidió frenar los MD; se reintentará en el siguiente ciclo');
                return false;
            case 'failed':
                deliveries.markUndelivered(reminder.key, userId, DeliveryStatus.Failed, now);
                summary.failed.push(userId);
                logger.error({ ...context, userId, err: outcome.error }, 'Error inesperado al enviar el MD');
                return true;
        }
    }
}
//# sourceMappingURL=koth-dm-dispatcher.service.js.map