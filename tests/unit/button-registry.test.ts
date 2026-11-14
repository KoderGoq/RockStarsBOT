import { describe, expect, it, vi } from 'vitest';
import { ButtonRegistry } from '../../src/core/interactions/button-registry.js';
import type { ButtonHandler } from '../../src/shared/types/button.js';
import { createLoadedIconRegistry } from '../helpers/icons.js';
import { createFakeButtonInteraction } from '../helpers/interactions.js';
import { silentLogger } from '../helpers/scheduler.js';

const icons = createLoadedIconRegistry();

function handler(customId: string, execute: ButtonHandler['execute']): ButtonHandler {
  return { customId, execute };
}

describe('ButtonRegistry', () => {
  it('despacha cada botón a su handler por customId', async () => {
    const a = vi.fn(() => Promise.resolve());
    const b = vi.fn(() => Promise.resolve());
    const registry = new ButtonRegistry([handler('a', a), handler('b', b)], icons, silentLogger);

    await registry.handle(createFakeButtonInteraction('b').interaction);

    expect(b).toHaveBeenCalledOnce();
    expect(a).not.toHaveBeenCalled();
  });

  it('rechaza dos botones con el mismo identificador', () => {
    const noop = () => Promise.resolve();

    expect(
      () => new ButtonRegistry([handler('a', noop), handler('a', noop)], icons, silentLogger),
    ).toThrow(/duplicado/);
  });

  it('un botón desconocido (mensaje antiguo) recibe una respuesta privada en lugar de fallar', async () => {
    const registry = new ButtonRegistry([], icons, silentLogger);
    const fake = createFakeButtonInteraction('viejo:boton');

    await registry.handle(fake.interaction);

    expect(fake.reply).toHaveBeenCalledOnce();
    expect(fake.reply.mock.calls[0]?.[0]).toMatchObject({ flags: 64 });
    expect(fake.texts().join('\n')).toContain('ya no está disponible');
  });

  it('si el handler falla, avisa al usuario y no propaga el error', async () => {
    const failing = handler('a', () => Promise.reject(new Error('boom')));
    const registry = new ButtonRegistry([failing], icons, silentLogger);
    const fake = createFakeButtonInteraction('a');

    await expect(registry.handle(fake.interaction)).resolves.toBeUndefined();

    expect(fake.texts().join('\n')).toContain('Ha ocurrido un error');
  });

  it('si el handler ya había respondido, el error se comunica con un mensaje adicional', async () => {
    const failing = handler('a', async (interaction) => {
      await interaction.deferReply();
      throw new Error('boom');
    });
    const registry = new ButtonRegistry([failing], icons, silentLogger);
    const fake = createFakeButtonInteraction('a');

    await registry.handle(fake.interaction);

    expect(fake.followUp).toHaveBeenCalledOnce();
    expect(fake.reply).not.toHaveBeenCalled();
  });
});
