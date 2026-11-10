import type { DateTime } from 'luxon';

/** Minutos de antelación admitidos para los avisos. Cada valor tiene su propio template. */
export type ReminderOffsetMinutes = 60 | 30 | 10;

/** Definición recurrente de un KOTH, expresada en la hora local de la zona oficial. */
export interface KothSlot {
  readonly id: string;
  readonly name: string;
  readonly hour: number;
  readonly minute: number;
}

/** Calendario completo de KOTH: zona horaria, horarios diarios y avisos. */
export interface KothScheduleDefinition {
  readonly timezone: string;
  readonly slots: readonly KothSlot[];
  readonly reminderOffsetsMinutes: readonly ReminderOffsetMinutes[];
}

/** Ejecución concreta de un KOTH en un instante exacto. */
export interface KothOccurrence {
  /** Identificador estable: `<slotId>@<inicio en UTC ISO>`. */
  readonly id: string;
  readonly slot: KothSlot;
  /** Instante exacto de inicio, expresado en la zona oficial. */
  readonly startsAt: DateTime;
}

/** Aviso concreto asociado a una ejecución de KOTH. */
export interface KothReminder {
  /** Clave de idempotencia: `<occurrenceId>#<offset>m`. */
  readonly key: string;
  readonly occurrence: KothOccurrence;
  readonly offsetMinutes: ReminderOffsetMinutes;
  readonly firesAt: DateTime;
}

/** Rango temporal semiabierto `(after, until]`. */
export interface TimeRange {
  readonly after: DateTime;
  readonly until: DateTime;
}
