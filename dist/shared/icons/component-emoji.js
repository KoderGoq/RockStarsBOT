const CUSTOM_EMOJI = /^<(a?):(\w{2,32}):(\d+)>$/;
/**
 * Convierte el texto de un icono (`<:lc_bell:123>` o un emoji Unicode) en el objeto que
 * necesitan los botones: en los botones el emoji no va dentro de un texto, sino aparte.
 */
export function toComponentEmoji(emoji) {
    const match = CUSTOM_EMOJI.exec(emoji);
    if (match?.[2] === undefined || match[3] === undefined) {
        return { name: emoji };
    }
    return { id: match[3], name: match[2], animated: match[1] === 'a' };
}
//# sourceMappingURL=component-emoji.js.map