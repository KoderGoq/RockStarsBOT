/**
 * Los SVG de Lucide dibujan con `currentColor`, que no existe fuera de un
 * navegador. Se sustituye por un color fijo antes de rasterizar.
 */
export function colorizeSvg(svg, color) {
    if (!svg.includes('currentColor')) {
        throw new Error('El SVG no usa currentColor; no parece un icono de Lucide');
    }
    return svg.replaceAll('currentColor', color);
}
//# sourceMappingURL=colorize-svg.js.map