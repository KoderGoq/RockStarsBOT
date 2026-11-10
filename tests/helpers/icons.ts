import { ICON_NAMES, toEmojiName } from '../../src/shared/icons/icon-catalog.js';
import { IconRegistry } from '../../src/shared/icons/icon-registry.js';

/** Id simulado y estable de cada emoji de aplicación: lc_swords → 1000, 1001... */
export function fakeEmojiId(index: number): string {
  return String(1000 + index);
}

/** Registro con todos los iconos del catálogo "sincronizados" con ids simulados. */
export function createLoadedIconRegistry(): IconRegistry {
  const registry = new IconRegistry();
  registry.load(
    ICON_NAMES.map((icon, index) => ({
      id: fakeEmojiId(index),
      name: toEmojiName(icon),
      animated: false,
    })),
  );
  return registry;
}
