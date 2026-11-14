export const KOTH_COMMAND_NAME = 'koth';
/** Los siete días de la semana, de lunes (1) a domingo (7). */
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/** Estado de un aviso registrado en la persistencia. */
export const NotificationStatus = {
    /** Reservado por un proceso; el envío está en curso (o el proceso cayó a mitad). */
    Processing: 'processing',
    Sent: 'sent',
    Skipped: 'skipped',
};
/** Motivo por el que un aviso no se publicó. */
export const SkipReason = {
    /** Existe un aviso posterior del mismo KOTH que ya es exigible. */
    Superseded: 'superseded',
    /** El aviso se detectó con más retraso del tolerado (p. ej. el bot estaba caído). */
    TooLate: 'too-late',
};
/** Estado del MD de un aviso para un suscriptor concreto. */
export const DeliveryStatus = {
    /** Reservado; el envío está en curso (o el proceso cayó a mitad). */
    Processing: 'processing',
    Sent: 'sent',
    /** Tiene los MD cerrados o bloqueó al bot. */
    Unreachable: 'unreachable',
    /** Ya no está en el servidor. */
    Left: 'left',
    /** Error inesperado; no se reintenta. */
    Failed: 'failed',
};
export const KOTH_EMBED_COLORS = {
    info: 0x5865f2,
    reminder60: 0xf1c40f,
    reminder30: 0xe67e22,
    reminder10: 0xe74c3c,
};
//# sourceMappingURL=koth.constants.js.map