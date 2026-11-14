import { z } from 'zod';
/**
 * Configuración central de los KOTH.
 *
 * ÚNICO lugar donde se definen los horarios. Las horas se expresan en la hora
 * local de la zona oficial (variable de entorno TIMEZONE, por defecto
 * Europe/Madrid), nunca como offsets UTC fijos.
 *
 * El orden de `slots` es el orden en que se muestran en `/koth horarios`.
 */
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
/** Todos los días menos el sábado (6): ese día solo se celebra el KOTH de las 02:00. */
const ALL_BUT_SATURDAY = [1, 2, 3, 4, 5, 7];
const rawKothConfig = {
    /**
     * `days` usa el día natural del inicio del KOTH en la zona oficial (1 = lunes … 7 = domingo).
     * El KOTH de las 02:00 se cuenta en el día en que ocurre: el de la madrugada del sábado es
     * del sábado, y el de la madrugada del domingo es del domingo.
     */
    slots: [
        { id: 'koth-1', name: 'KOTH 1', hour: 17, minute: 0, days: ALL_BUT_SATURDAY },
        { id: 'koth-2', name: 'KOTH 2', hour: 22, minute: 0, days: ALL_BUT_SATURDAY },
        { id: 'koth-3', name: 'KOTH 3', hour: 2, minute: 0, days: EVERY_DAY },
    ],
    /** Avisos previos al inicio de cada KOTH, en minutos. */
    reminderOffsetsMinutes: [60, 30, 10],
    /**
     * Si es `true`, cada aviso termina con "@everyone @here" y notifica a todos.
     * Ahora está desactivado: esas menciones se hacen a mano. Si se vuelve a activar,
     * el bot necesita el permiso "Mencionar a @everyone, @here y todos los roles"
     * en el canal de avisos.
     */
    mentionEveryone: false,
    /**
     * Mensajes privados (MD) a los miembros que se hayan suscrito con `/koth suscribirme`.
     * Solo reciben MD quienes lo han pedido expresamente; nunca se escribe a nadie más.
     */
    directMessages: {
        /** Antelación con la que se envía el MD. Debe ser uno de `reminderOffsetsMinutes`. */
        offsetMinutes: 10,
        /** Pausa entre MD consecutivos, para no disparar los límites anti-spam de Discord. */
        pauseBetweenSendsMs: 1_500,
        /**
         * Retraso máximo tolerado desde la hora del aviso. Es mayor que el del canal porque
         * enviar muchos MD espaciados lleva tiempo. Nunca se envía una vez iniciado el KOTH.
         */
        maxLatenessMs: 8 * 60_000,
        /**
         * MD fallidos seguidos (porque los tiene cerrados o bloqueó al bot) tras los que se
         * da de baja al suscriptor. Un envío correcto reinicia la cuenta.
         */
        maxConsecutiveFailures: 3,
    },
    scheduler: {
        /** Frecuencia con la que el scheduler revisa si hay avisos pendientes. */
        pollIntervalMs: 10_000,
        /**
         * Retraso máximo tolerado para publicar un aviso. Si el bot detecta un aviso
         * con más retraso (p. ej. estaba caído), lo omite en lugar de publicar un
         * mensaje desactualizado.
         */
        maxLatenessMs: 5 * 60_000,
        /** Días que se conserva el historial de avisos en SQLite. */
        historyRetentionDays: 30,
    },
};
const slotSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'El id del slot solo admite minúsculas, números y guiones'),
    name: z.string().min(1),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    days: z
        .array(z.literal([1, 2, 3, 4, 5, 6, 7]))
        .min(1, 'Cada KOTH debe celebrarse al menos un día a la semana')
        .refine((days) => new Set(days).size === days.length, {
        message: 'Los días de un KOTH no pueden repetirse',
    }),
});
const kothConfigSchema = z
    .object({
    slots: z
        .array(slotSchema)
        .min(1)
        .refine((slots) => new Set(slots.map((slot) => slot.id)).size === slots.length, {
        message: 'Los ids de los slots de KOTH deben ser únicos',
    })
        .refine((slots) => new Set(slots.map((slot) => slot.hour * 60 + slot.minute)).size === slots.length, { message: 'No puede haber dos KOTH a la misma hora' }),
    reminderOffsetsMinutes: z
        .array(z.literal([60, 30, 10]))
        .min(1)
        .refine((offsets) => new Set(offsets).size === offsets.length, {
        message: 'Los avisos no pueden repetirse',
    }),
    mentionEveryone: z.boolean(),
    directMessages: z.object({
        offsetMinutes: z.literal([60, 30, 10]),
        pauseBetweenSendsMs: z.number().int().min(0),
        maxLatenessMs: z.number().int().positive(),
        maxConsecutiveFailures: z.number().int().positive(),
    }),
    scheduler: z.object({
        pollIntervalMs: z.number().int().min(1_000),
        maxLatenessMs: z.number().int().positive(),
        historyRetentionDays: z.number().int().positive(),
    }),
})
    .refine((config) => config.reminderOffsetsMinutes.includes(config.directMessages.offsetMinutes), {
    message: 'directMessages.offsetMinutes debe ser uno de reminderOffsetsMinutes',
});
export const kothConfig = kothConfigSchema.parse(rawKothConfig);
//# sourceMappingURL=koth.config.js.map