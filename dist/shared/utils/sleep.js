/**
 * Espera `ms` milisegundos. Si se cancela la señal, termina antes de tiempo
 * (nunca rechaza), lo que permite apagar el bot sin esperar a una pausa larga.
 */
export function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted === true) {
            resolve();
            return;
        }
        const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', finish);
            resolve();
        };
        const timer = setTimeout(finish, ms);
        signal?.addEventListener('abort', finish, { once: true });
    });
}
//# sourceMappingURL=sleep.js.map