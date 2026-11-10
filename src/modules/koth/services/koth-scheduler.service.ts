import type { DateTime } from 'luxon';
import type { Logger } from 'pino';
import { toUtcIsoString } from '../../../shared/utils/time.js';
import { SkipReason } from '../domain/koth.constants.js';
import type { KothAnnouncer } from '../domain/koth.ports.js';
import type { KothOccurrence, KothReminder } from '../domain/koth.types.js';
import type { KothNotificationRepository } from '../repositories/koth-notification.repository.js';
import type { KothTimeService } from './koth-time.service.js';

export interface KothSchedulerOptions {
  /** Retraso máximo con el que todavía se publica un aviso. */
  readonly maxLatenessMs: number;
}

export interface KothSchedulerDependencies {
  readonly timeService: KothTimeService;
  readonly repository: KothNotificationRepository;
  readonly announcer: KothAnnouncer;
  readonly logger: Logger;
  readonly options: KothSchedulerOptions;
}

export interface SkippedReminder {
  readonly key: string;
  readonly reason: SkipReason;
}

/** Resultado de un tick, útil para observabilidad y pruebas. */
export interface SchedulerTickSummary {
  readonly sent: string[];
  readonly skipped: SkippedReminder[];
  readonly failed: string[];
}

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
  constructor(private readonly deps: KothSchedulerDependencies) {}

  async tick(now: DateTime): Promise<SchedulerTickSummary> {
    const summary: SchedulerTickSummary = { sent: [], skipped: [], failed: [] };

    for (const occurrence of this.getOccurrencesWithPossibleReminders(now)) {
      await this.processOccurrence(occurrence, now, summary);
    }

    return summary;
  }

  /** KOTH que aún no han comenzado y cuyo primer aviso ya puede haber vencido. */
  private getOccurrencesWithPossibleReminders(now: DateTime): KothOccurrence[] {
    const { timeService } = this.deps;
    return timeService.getOccurrencesInRange({
      after: now,
      until: now.plus({ minutes: timeService.maxReminderOffsetMinutes }),
    });
  }

  private async processOccurrence(
    occurrence: KothOccurrence,
    now: DateTime,
    summary: SchedulerTickSummary,
  ): Promise<void> {
    const dueReminders = this.deps.timeService
      .getReminders(occurrence)
      .filter((reminder) => reminder.firesAt.toMillis() <= now.toMillis());

    const latest = dueReminders.at(-1);
    if (latest === undefined) return;

    for (const superseded of dueReminders.slice(0, -1)) {
      this.skip(superseded, SkipReason.Superseded, now, summary);
    }

    if (this.isTooLate(latest, now)) {
      this.skip(latest, SkipReason.TooLate, now, summary);
      return;
    }

    await this.dispatch(latest, now, summary);
  }

  private isTooLate(reminder: KothReminder, now: DateTime): boolean {
    const latenessMs = now.toMillis() - reminder.firesAt.toMillis();
    return latenessMs > this.deps.options.maxLatenessMs;
  }

  private skip(
    reminder: KothReminder,
    reason: SkipReason,
    now: DateTime,
    summary: SchedulerTickSummary,
  ): void {
    const recorded = this.deps.repository.recordSkipped(reminder, reason, now);
    if (!recorded) return;

    summary.skipped.push({ key: reminder.key, reason });
    this.deps.logger.info({ ...describeReminder(reminder), reason }, 'Aviso de KOTH omitido');
  }

  private async dispatch(
    reminder: KothReminder,
    now: DateTime,
    summary: SchedulerTickSummary,
  ): Promise<void> {
    const { repository, announcer, logger } = this.deps;

    if (!repository.tryClaim(reminder, now)) return;

    let messageId: string;
    try {
      ({ messageId } = await announcer.announce(reminder));
    } catch (error: unknown) {
      repository.release(reminder.key);
      summary.failed.push(reminder.key);
      logger.error(
        { err: error, ...describeReminder(reminder) },
        'No se pudo publicar el aviso de KOTH; se reintentará',
      );
      return;
    }

    // Fuera del try: si la confirmación fallase, la reserva permanece y el aviso
    // no se reenvía (se prioriza no duplicar mensajes).
    repository.markSent(reminder.key, messageId, now);
    summary.sent.push(reminder.key);
    logger.info({ ...describeReminder(reminder), messageId }, 'Aviso de KOTH publicado');
  }
}

function describeReminder(reminder: KothReminder): Record<string, string | number> {
  return {
    key: reminder.key,
    koth: reminder.occurrence.slot.name,
    offsetMinutes: reminder.offsetMinutes,
    startsAt: toUtcIsoString(reminder.occurrence.startsAt),
  };
}
