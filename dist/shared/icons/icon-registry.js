import { ICON_CATALOG, ICON_NAMES, toEmojiName } from './icon-catalog.js';
/**
 * Resuelve iconos a su emoji personalizado de Discord (`<:lc_swords:123…>`).
 * Mientras no se hayan cargado (o si faltan), devuelve el emoji Unicode de
 * respaldo, de modo que el bot siempre puede publicar mensajes legibles.
 */
export class IconRegistry {
    customEmojis = new Map();
    get(name) {
        return this.customEmojis.get(name) ?? ICON_CATALOG[name].fallback;
    }
    /** Sustituye los emojis conocidos por los de la lista recibida. */
    load(emojis) {
        const byName = new Map();
        for (const emoji of emojis) {
            if (emoji.name !== null)
                byName.set(emoji.name, emoji);
        }
        this.customEmojis.clear();
        const missing = [];
        for (const icon of ICON_NAMES) {
            const emoji = byName.get(toEmojiName(icon));
            if (emoji === undefined) {
                missing.push(icon);
            }
            else {
                this.customEmojis.set(icon, formatCustomEmoji(emoji));
            }
        }
        return { loaded: [...this.customEmojis.keys()], missing };
    }
}
function formatCustomEmoji(emoji) {
    return `<${emoji.animated === true ? 'a' : ''}:${emoji.name ?? ''}:${emoji.id}>`;
}
//# sourceMappingURL=icon-registry.js.map