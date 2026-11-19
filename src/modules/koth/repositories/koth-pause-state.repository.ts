import type { DateTime } from 'luxon';

export interface KothPauseState {
  readonly paused: boolean;
  /** ID del usuario de Discord que hizo el último cambio. */
  readonly changedBy: string;
  /** Fecha del último cambio en UTC ISO. */
  readonly changedAt: string;
}

/** Estado persistente de "apagado/encendido" de los avisos. */
export interface KothPauseStateRepository {
  /** `undefined` si nunca se ha apagado ni encendido (el bot arranca encendido). */
  find(): KothPauseState | undefined;

  save(paused: boolean, changedBy: string, now: DateTime): void;
}
