import { ICON_CATALOG, ICON_NAMES, type IconName, toEmojiName } from './icon-catalog.js';

/** Lo único que necesitan los templates: obtener el texto que representa un icono. */
export interface IconResolver {
  get(name: IconName): string;
}

/** Forma mínima de un emoji de aplicación de Discord (compatible con `ApplicationEmoji`). */
export interface CustomEmojiLike {
  readonly id: string;
  readonly name: string | null;
  readonly animated: boolean | null;
}

export interface IconLoadReport {
  readonly loaded: readonly IconName[];
  /** Iconos del catálogo que aún no están sincronizados en Discord. */
  readonly missing: readonly IconName[];
}

/**
 * Resuelve iconos a su emoji personalizado de Discord (`<:lc_swords:123…>`).
 * Mientras no se hayan cargado (o si faltan), devuelve el emoji Unicode de
 * respaldo, de modo que el bot siempre puede publicar mensajes legibles.
 */
export class IconRegistry implements IconResolver {
  private readonly customEmojis = new Map<IconName, string>();

  get(name: IconName): string {
    return this.customEmojis.get(name) ?? ICON_CATALOG[name].fallback;
  }

  /** Sustituye los emojis conocidos por los de la lista recibida. */
  load(emojis: Iterable<CustomEmojiLike>): IconLoadReport {
    const byName = new Map<string, CustomEmojiLike>();
    for (const emoji of emojis) {
      if (emoji.name !== null) byName.set(emoji.name, emoji);
    }

    this.customEmojis.clear();
    const missing: IconName[] = [];

    for (const icon of ICON_NAMES) {
      const emoji = byName.get(toEmojiName(icon));
      if (emoji === undefined) {
        missing.push(icon);
      } else {
        this.customEmojis.set(icon, formatCustomEmoji(emoji));
      }
    }

    return { loaded: [...this.customEmojis.keys()], missing };
  }
}

function formatCustomEmoji(emoji: CustomEmojiLike): string {
  return `<${emoji.animated === true ? 'a' : ''}:${emoji.name ?? ''}:${emoji.id}>`;
}
