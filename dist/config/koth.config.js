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
const rawKothConfig = {
    slots: [
        { id: 'koth-1', name: 'KOTH 1', hour: 17, minute: 0 },
        { id: 'koth-2', name: 'KOTH 2', hour: 22, minute: 0 },
        { id: 'koth-3', name: 'KOTH 3', hour: 2, minute: 0 },
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
});
const kothConfigSchema = z.object({
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
    scheduler: z.object({
        pollIntervalMs: z.number().int().min(1_000),
        maxLatenessMs: z.number().int().positive(),
        historyRetentionDays: z.number().int().positive(),
    }),
});
export const kothConfig = kothConfigSchema.parse(rawKothConfig);
//# sourceMappingURL=koth.config.js.map