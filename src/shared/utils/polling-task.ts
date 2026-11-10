import type { Logger } from 'pino';

export interface PollingTaskOptions {
  readonly name: string;
  readonly intervalMs: number;
  readonly task: () => Promise<void>;
  readonly logger: Logger;
}

/**
 * Ejecuta una tarea periódicamente con un intervalo fijo.
 *
 * Garantías:
 * - Nunca hay dos ejecuciones simultáneas: si una ejecución tarda más que el
 *   intervalo, los ticks intermedios se descartan.
 * - Un error en una ejecución se registra y no detiene el polling.
 * - `stop()` espera a que finalice la ejecución en curso.
 *
 * La tarea debe recalcular su estado a partir del reloj en cada ejecución, de modo
 * que el retraso del temporizador (suspensión del equipo, carga del event loop)
 * no provoque pérdidas ni duplicados.
 */
export class PollingTask {
  private timer: NodeJS.Timeout | undefined;
  private currentRun: Promise<void> | undefined;

  constructor(private readonly options: PollingTaskOptions) {}

  get isRunning(): boolean {
    return this.timer !== undefined;
  }

  start(): void {
    if (this.timer !== undefined) return;

    this.timer = setInterval(() => void this.runOnce(), this.options.intervalMs);
    void this.runOnce();
    this.options.logger.info(
      { task: this.options.name, intervalMs: this.options.intervalMs },
      'Tarea periódica iniciada',
    );
  }

  async stop(): Promise<void> {
    if (this.timer === undefined) return;

    clearInterval(this.timer);
    this.timer = undefined;
    await this.currentRun;
    this.options.logger.info({ task: this.options.name }, 'Tarea periódica detenida');
  }

  /** Ejecuta la tarea una vez, salvo que ya haya una ejecución en curso. */
  async runOnce(): Promise<void> {
    if (this.currentRun !== undefined) {
      this.options.logger.debug(
        { task: this.options.name },
        'Ejecución anterior en curso; se omite',
      );
      return;
    }

    this.currentRun = this.execute();
    try {
      await this.currentRun;
    } finally {
      this.currentRun = undefined;
    }
  }

  private async execute(): Promise<void> {
    try {
      await this.options.task();
    } catch (error: unknown) {
      this.options.logger.error(
        { err: error, task: this.options.name },
        'Error en tarea periódica',
      );
    }
  }
}
