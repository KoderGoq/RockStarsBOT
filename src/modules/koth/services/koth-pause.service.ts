import type { Logger } from 'pino';
import type { Clock } from '../../../shared/types/clock.js';
import type {
  KothPauseState,
  KothPauseStateRepository,
} from '../repositories/koth-pause-state.repository.js';

/** Resultado de apagar o encender los avisos. */
export type PauseChange =
  /** El estado cambió; `state` es el nuevo. */
  | { readonly kind: 'changed'; readonly state: KothPauseState }
  /** Ya estaba así. `state` es el último cambio registrado (`undefined` si nunca se tocó). */
  | { readonly kind: 'unchanged'; readonly state: KothPauseState | undefined };

export interface KothPauseServiceDependencies {
  readonly repository: KothPauseStateRepository;
  readonly clock: Clock;
  readonly logger: Logger;
}

/**
 * "Apagado/encendido" de los avisos. No detiene el proceso: el bot sigue conectado y
 * atendiendo comandos, pero el scheduler y el reparto de MD no envían nada mientras
 * esté apagado. Se guarda en SQLite, así que sobrevive a los reinicios del host.
 *
 * No se puede apagar el proceso entero y encenderlo después desde Discord: sin proceso
 * no habría nadie escuchando el comando de encender.
 */
export class KothPauseService {
  constructor(private readonly deps: KothPauseServiceDependencies) {}

  /** Se consulta en cada ciclo del scheduler; es una lectura barata a SQLite. */
  isPaused(): boolean {
    return this.deps.repository.find()?.paused === true;
  }

  /** Último cambio de estado, o `undefined` si nunca se ha tocado (arranca encendido). */
  status(): KothPauseState | undefined {
    return this.deps.repository.find();
  }

  pause(userId: string): PauseChange {
    const current = this.deps.repository.find();
    if (current?.paused === true) {
      return { kind: 'unchanged', state: current };
    }

    return { kind: 'changed', state: this.record(true, userId) };
  }

  resume(userId: string): PauseChange {
    const current = this.deps.repository.find();
    // Sin registro, o ya encendido: no hay nada que cambiar.
    if (current?.paused !== true) {
      return { kind: 'unchanged', state: current };
    }

    return { kind: 'changed', state: this.record(false, userId) };
  }

  private record(paused: boolean, userId: string): KothPauseState {
    const { repository, clock, logger } = this.deps;
    repository.save(paused, userId, clock.now());

    const state = repository.find();
    if (state === undefined) {
      throw new Error('No se pudo guardar el estado de los avisos');
    }

    logger.warn(
      { paused, userId },
      paused ? 'Avisos APAGADOS por un administrador' : 'Avisos ENCENDIDOS por un administrador',
    );
    return state;
  }
}
