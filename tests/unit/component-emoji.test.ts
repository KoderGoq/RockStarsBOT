import { describe, expect, it } from 'vitest';
import { toComponentEmoji } from '../../src/shared/icons/component-emoji.js';

describe('toComponentEmoji', () => {
  it('descompone un emoji personalizado en id y nombre', () => {
    expect(toComponentEmoji('<:lc_bell:1570918164261376220>')).toEqual({
      id: '1570918164261376220',
      name: 'lc_bell',
      animated: false,
    });
  });

  it('reconoce los emojis animados', () => {
    expect(toComponentEmoji('<a:lc_bell:123>')).toEqual({
      id: '123',
      name: 'lc_bell',
      animated: true,
    });
  });

  it('un emoji Unicode se devuelve tal cual, solo con su nombre', () => {
    expect(toComponentEmoji('🔔')).toEqual({ name: '🔔' });
  });
});
