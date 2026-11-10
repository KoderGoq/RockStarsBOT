import type { DateTime } from 'luxon';

/**
 * Abstracción del reloj del sistema.
 * Permite inyectar fechas simuladas en las pruebas y no depender de la hora real.
 */
export interface Clock {
  now(): DateTime;
}
