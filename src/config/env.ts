import { config as loadDotenv } from 'dotenv';
import { IANAZone } from 'luxon';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const discordSnowflake = (variable: string): z.ZodString =>
  z
    .string({ error: `${variable} es obligatorio` })
    .regex(/^\d{17,20}$/, `${variable} debe ser un ID de Discord válido (17-20 dígitos)`);

const envSchema = z.object({
  DISCORD_TOKEN: z.string({ error: 'DISCORD_TOKEN es obligatorio' }).min(1),
  DISCORD_CLIENT_ID: discordSnowflake('DISCORD_CLIENT_ID'),
  DISCORD_GUILD_ID: discordSnowflake('DISCORD_GUILD_ID'),
  DISCORD_CHANNEL_ID: discordSnowflake('DISCORD_CHANNEL_ID'),

  TIMEZONE: z
    .string()
    .refine((zone) => IANAZone.isValidZone(zone), {
      message: 'TIMEZONE debe ser una zona horaria IANA válida (p. ej. Europe/Madrid)',
    })
    .default('Europe/Madrid'),
  SERVER_IP: z.string().min(1).default('boutcraft.xyz'),

  DATABASE_PATH: z.string().min(1).default('./data/boutcraft.sqlite'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError';
}

/** Valida un conjunto de variables de entorno. Las variables vacías se tratan como ausentes. */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const result = envSchema.safeParse(withoutEmptyValues(source));

  if (!result.success) {
    throw new EnvValidationError(
      `Variables de entorno inválidas:\n${z.prettifyError(result.error)}\n` +
        'Revisa tu archivo .env (puedes partir de .env.example).',
    );
  }

  return result.data;
}

/** Carga `.env` (si existe) y valida `process.env`. */
export function loadEnv(): Env {
  loadDotenv({ quiet: true });
  return parseEnv(process.env);
}

function withoutEmptyValues(
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const entries = Object.entries(source).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1].trim() !== '',
  );
  return Object.fromEntries(entries.map(([key, value]) => [key, value.trim()]));
}
