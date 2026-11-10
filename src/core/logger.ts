import { type LevelWithSilent, type Logger, pino } from 'pino';

export function createLogger(level: LevelWithSilent): Logger {
  return pino({
    level,
    base: { app: 'boutcraft-koth-bot' },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Defensa en profundidad: nunca volcar el token aunque llegue a un log.
    redact: {
      paths: ['token', '*.token', 'DISCORD_TOKEN', '*.DISCORD_TOKEN'],
      censor: '[REDACTED]',
    },
  });
}
