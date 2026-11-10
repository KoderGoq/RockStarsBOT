import type { DateTime } from 'luxon';

/**
 * Estilos nativos de timestamp de Discord.
 * Discord los renderiza en la zona horaria local de cada usuario.
 *
 * - `t`: 16:20 · `T`: 16:20:30 · `d`: 20/04/2026 · `D`: 20 de abril de 2026
 * - `f`: fecha y hora corta · `F`: fecha completa con día de la semana · `R`: relativo ("en 2 horas")
 */
export type DiscordTimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

export function toDiscordTimestamp(date: DateTime, style: DiscordTimestampStyle): string {
  return `<t:${Math.floor(date.toSeconds())}:${style}>`;
}
