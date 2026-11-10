import { describe, expect, it } from 'vitest';
import { colorizeSvg } from '../../src/shared/icons/colorize-svg.js';
import { ICON_CATALOG, ICON_NAMES, toEmojiName } from '../../src/shared/icons/icon-catalog.js';
import { IconRegistry } from '../../src/shared/icons/icon-registry.js';
import { createLoadedIconRegistry, fakeEmojiId } from '../helpers/icons.js';

/** Reglas de Discord para el nombre de un emoji: 2-32 caracteres, letras, números y _. */
const VALID_EMOJI_NAME = /^[A-Za-z0-9_]{2,32}$/;

describe('catálogo de iconos', () => {
  it('genera nombres de emoji válidos para Discord y sin repetir', () => {
    const names = ICON_NAMES.map(toEmojiName);

    for (const name of names) expect(name).toMatch(VALID_EMOJI_NAME);
    expect(new Set(names).size).toBe(names.length);
  });

  it('convierte los guiones de Lucide en guiones bajos', () => {
    expect(toEmojiName('calendar-days')).toBe('lc_calendar_days');
  });

  it('define un color hexadecimal y un emoji de respaldo para cada icono', () => {
    for (const icon of ICON_NAMES) {
      expect(ICON_CATALOG[icon].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ICON_CATALOG[icon].fallback.length).toBeGreaterThan(0);
    }
  });
});

describe('IconRegistry', () => {
  it('usa el emoji Unicode de respaldo mientras no se hayan cargado los iconos', () => {
    const registry = new IconRegistry();

    expect(registry.get('swords')).toBe(ICON_CATALOG.swords.fallback);
  });

  it('devuelve el emoji personalizado una vez cargado', () => {
    const registry = createLoadedIconRegistry();
    const index = ICON_NAMES.indexOf('swords');

    expect(registry.get('swords')).toBe(`<:lc_swords:${fakeEmojiId(index)}>`);
  });

  it('informa de los iconos que faltan y usa el respaldo solo para esos', () => {
    const registry = new IconRegistry();

    const report = registry.load([{ id: '42', name: 'lc_swords', animated: false }]);

    expect(report.loaded).toEqual(['swords']);
    expect(report.missing).toHaveLength(ICON_NAMES.length - 1);
    expect(report.missing).not.toContain('swords');
    expect(registry.get('swords')).toBe('<:lc_swords:42>');
    expect(registry.get('shield')).toBe(ICON_CATALOG.shield.fallback);
  });

  it('ignora emojis que no pertenecen al catálogo o no tienen nombre', () => {
    const registry = new IconRegistry();

    const report = registry.load([
      { id: '1', name: 'otro_emoji', animated: false },
      { id: '2', name: null, animated: null },
    ]);

    expect(report.loaded).toEqual([]);
  });

  it('una nueva carga sustituye a la anterior', () => {
    const registry = createLoadedIconRegistry();

    registry.load([]);

    expect(registry.get('swords')).toBe(ICON_CATALOG.swords.fallback);
  });

  it('formatea los emojis animados con el prefijo "a"', () => {
    const registry = new IconRegistry();
    registry.load([{ id: '7', name: 'lc_bell', animated: true }]);

    expect(registry.get('bell')).toBe('<a:lc_bell:7>');
  });
});

describe('colorizeSvg', () => {
  const lucideSvg = '<svg stroke="currentColor" fill="none"><path d="m1 1" /></svg>';

  it('sustituye currentColor por el color indicado', () => {
    expect(colorizeSvg(lucideSvg, '#ED4245')).toBe(
      '<svg stroke="#ED4245" fill="none"><path d="m1 1" /></svg>',
    );
  });

  it('rechaza un SVG que no sea un icono de Lucide', () => {
    expect(() => colorizeSvg('<svg stroke="red"></svg>', '#fff')).toThrow(/currentColor/);
  });
});
