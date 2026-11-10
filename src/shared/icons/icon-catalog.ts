/**
 * Catálogo de iconos del bot.
 *
 * Cada clave es el nombre de un icono de Lucide (https://lucide.dev/icons).
 * Discord no puede renderizar componentes de React ni SVG, así que `pnpm icons:sync`
 * convierte estos iconos a PNG y los sube como **emojis de la aplicación**; los
 * mensajes los usan mediante `IconResolver`.
 *
 * Para añadir un icono: agrégalo aquí, ejecuta `pnpm icons:sync` y reinicia el bot.
 */
export const ICON_CATALOG = {
  swords: { color: '#ED4245', fallback: '⚔️' },
  shield: { color: '#5865F2', fallback: '🛡️' },
  flame: { color: '#F26522', fallback: '🔥' },
  calendar: { color: '#5865F2', fallback: '📅' },
  'calendar-days': { color: '#5865F2', fallback: '🗓️' },
  hourglass: { color: '#F0B232', fallback: '⏳' },
  clock: { color: '#F0B232', fallback: '🕐' },
  globe: { color: '#3BA55D', fallback: '🌐' },
  earth: { color: '#3BA55D', fallback: '🌍' },
  bell: { color: '#F0B232', fallback: '🔔' },
  'flask-conical': { color: '#9B59B6', fallback: '🧪' },
  'circle-check': { color: '#3BA55D', fallback: '✅' },
  'circle-x': { color: '#ED4245', fallback: '❌' },
  ban: { color: '#ED4245', fallback: '⛔' },
} as const satisfies Record<string, IconDefinition>;

export interface IconDefinition {
  /** Color del trazo en hexadecimal. Elegido para verse bien en tema claro y oscuro. */
  readonly color: `#${string}`;
  /** Emoji Unicode que se usa mientras los emojis de la aplicación no estén sincronizados. */
  readonly fallback: string;
}

export type IconName = keyof typeof ICON_CATALOG;

export const ICON_NAMES = Object.keys(ICON_CATALOG) as IconName[];

const EMOJI_NAME_PREFIX = 'lc_';

/**
 * Nombre del emoji de aplicación asociado a un icono: `calendar-days` → `lc_calendar_days`.
 * Discord solo admite letras, números y guiones bajos (2-32 caracteres).
 */
export function toEmojiName(icon: IconName): string {
  return `${EMOJI_NAME_PREFIX}${icon.replaceAll('-', '_')}`;
}
