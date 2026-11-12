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
    options;
    timer;
    currentRun;
    constructor(options) {
        this.options = options;
    }
    get isRunning() {
        return this.timer !== undefined;
    }
    start() {
        if (this.timer !== undefined)
            return;
        this.timer = setInterval(() => void this.runOnce(), this.options.intervalMs);
        void this.runOnce();
        this.options.logger.info({ task: this.options.name, intervalMs: this.options.intervalMs }, 'Tarea periódica iniciada');
    }
    async stop() {
        if (this.timer === undefined)
            return;
        clearInterval(this.timer);
        this.timer = undefined;
        await this.currentRun;
        this.options.logger.info({ task: this.options.name }, 'Tarea periódica detenida');
    }
    /** Ejecuta la tarea una vez, salvo que ya haya una ejecución en curso. */
    async runOnce() {
        if (this.currentRun !== undefined) {
            this.options.logger.debug({ task: this.options.name }, 'Ejecución anterior en curso; se omite');
            return;
        }
        this.currentRun = this.execute();
        try {
            await this.currentRun;
        }
        finally {
            this.currentRun = undefined;
        }
    }
    async execute() {
        try {
            await this.options.task();
        }
        catch (error) {
            this.options.logger.error({ err: error, task: this.options.name }, 'Error en tarea periódica');
        }
    }
}
//# sourceMappingURL=polling-task.js.map