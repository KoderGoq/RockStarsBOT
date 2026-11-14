import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKothSubscriptionButtons } from '../../src/modules/koth/buttons/koth-subscription.buttons.js';
import { createKothPanelSubcommand } from '../../src/modules/koth/commands/koth-panel.command.js';
import {
  createKothSubscribeSubcommand,
  createKothUnsubscribeSubcommand,
} from '../../src/modules/koth/commands/koth-subscribe.command.js';
import {
  createKothRemoveSubscriberSubcommand,
  createKothSubscribersSubcommand,
} from '../../src/modules/koth/commands/koth-subscribers.command.js';
import {
  KOTH_SUBSCRIBE_BUTTON_ID,
  KOTH_UNSUBSCRIBE_BUTTON_ID,
} from '../../src/modules/koth/domain/koth.constants.js';
import { createDmHarness, type DmHarness } from '../helpers/direct-messages.js';
import {
  createCommandDependencies,
  createFakeButtonInteraction,
  createFakeChatInteraction,
  FakePanelGateway,
  SUBSCRIPTION_CHANNEL_ID,
} from '../helpers/interactions.js';

const EPHEMERAL = 64;

describe('Canal exclusivo de suscripción', () => {
  let harness: DmHarness;

  beforeEach(() => {
    harness = createDmHarness();
  });

  afterEach(() => {
    harness.database.close();
  });

  describe('/koth suscribirme', () => {
    it('en otro canal no suscribe y dice dónde hay que ir', async () => {
      const command = createKothSubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({ channelId: 'general' });

      await command.execute(fake.interaction);

      expect(fake.texts().join('\n')).toContain(`<#${SUBSCRIPTION_CHANNEL_ID}>`);
      expect(fake.reply.mock.calls[0]?.[0]).toMatchObject({ flags: EPHEMERAL });
      expect(fake.deferReply).not.toHaveBeenCalled();
      expect(harness.subscribers.has('u1')).toBe(false);
      expect(harness.messenger.confirmations).toEqual([]);
    });

    it('en el canal de suscripción suscribe', async () => {
      const command = createKothSubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({ channelId: SUBSCRIPTION_CHANNEL_ID });

      await command.execute(fake.interaction);

      expect(harness.subscribers.has('u1')).toBe(true);
      expect(fake.deferReply).toHaveBeenCalledOnce();
      expect(fake.texts().join('\n')).toContain('Te has suscrito');
    });

    it('dentro de un hilo del canal de suscripción también vale', async () => {
      const command = createKothSubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({
        channelId: 'hilo-1',
        threadParentId: SUBSCRIPTION_CHANNEL_ID,
      });

      await command.execute(fake.interaction);

      expect(harness.subscribers.has('u1')).toBe(true);
    });

    it('un hilo de otro canal no vale', async () => {
      const command = createKothSubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({ channelId: 'hilo-1', threadParentId: 'general' });

      await command.execute(fake.interaction);

      expect(harness.subscribers.has('u1')).toBe(false);
    });

    it('sin canal de suscripción configurado funciona en cualquier canal', async () => {
      const deps = createCommandDependencies(harness, { subscriptionChannelId: null });
      const fake = createFakeChatInteraction({ channelId: 'general' });

      await createKothSubscribeSubcommand(deps).execute(fake.interaction);

      expect(harness.subscribers.has('u1')).toBe(true);
    });
  });

  describe('/koth cancelar', () => {
    it('en otro canal no da de baja', async () => {
      harness.subscribers.add('u1', harness.clock.now());
      const command = createKothUnsubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({ channelId: 'general' });

      await command.execute(fake.interaction);

      expect(harness.subscribers.has('u1')).toBe(true);
      expect(fake.texts().join('\n')).toContain(`<#${SUBSCRIPTION_CHANNEL_ID}>`);
    });

    it('en el canal de suscripción da de baja', async () => {
      harness.subscribers.add('u1', harness.clock.now());
      const command = createKothUnsubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({ channelId: SUBSCRIPTION_CHANNEL_ID });

      await command.execute(fake.interaction);

      expect(harness.subscribers.has('u1')).toBe(false);
      expect(fake.texts().join('\n')).toContain('Te has dado de baja');
    });

    it('avisa si no estaba suscrito', async () => {
      const command = createKothUnsubscribeSubcommand(createCommandDependencies(harness));
      const fake = createFakeChatInteraction({ channelId: SUBSCRIPTION_CHANNEL_ID });

      await command.execute(fake.interaction);

      expect(fake.texts().join('\n')).toContain('No estabas suscrito');
    });
  });

  describe('comandos de administración', () => {
    it('/koth suscriptores y /koth quitar no dependen del canal', async () => {
      harness.subscribers.add('u2', harness.clock.now());
      const deps = createCommandDependencies(harness);

      const list = createFakeChatInteraction({ channelId: 'general', canManageServer: true });
      await createKothSubscribersSubcommand(deps).execute(list.interaction);
      expect(list.editReply).toHaveBeenCalledOnce();

      const remove = createFakeChatInteraction({
        channelId: 'general',
        canManageServer: true,
        targetUserId: 'u2',
      });
      await createKothRemoveSubscriberSubcommand(deps).execute(remove.interaction);
      expect(harness.subscribers.has('u2')).toBe(false);
    });

    it('sin el permiso "Gestionar servidor" no se puede listar ni quitar a nadie', async () => {
      harness.subscribers.add('u2', harness.clock.now());
      const deps = createCommandDependencies(harness);

      const list = createFakeChatInteraction({ canManageServer: false });
      await createKothSubscribersSubcommand(deps).execute(list.interaction);
      const remove = createFakeChatInteraction({ canManageServer: false, targetUserId: 'u2' });
      await createKothRemoveSubscriberSubcommand(deps).execute(remove.interaction);

      expect(list.texts().join('\n')).toContain('Gestionar servidor');
      expect(harness.subscribers.has('u2')).toBe(true);
    });
  });
});

describe('/koth panel', () => {
  let harness: DmHarness;

  beforeEach(() => {
    harness = createDmHarness();
  });

  afterEach(() => {
    harness.database.close();
  });

  it('solo lo puede usar quien tenga "Gestionar servidor"', async () => {
    const gateway = new FakePanelGateway();
    const command = createKothPanelSubcommand(createCommandDependencies(harness, { gateway }));
    const fake = createFakeChatInteraction({ canManageServer: false });

    await command.execute(fake.interaction);

    expect(fake.texts().join('\n')).toContain('Gestionar servidor');
    expect(gateway.created).toEqual([]);
  });

  it('sin canal de suscripción configurado explica cómo configurarlo', async () => {
    const deps = createCommandDependencies(harness, { subscriptionChannelId: null });
    const fake = createFakeChatInteraction({ canManageServer: true });

    await createKothPanelSubcommand(deps).execute(fake.interaction);

    expect(fake.texts().join('\n')).toContain('DISCORD_SUBSCRIPTION_CHANNEL_ID');
  });

  it('publica el panel la primera vez y lo actualiza las siguientes', async () => {
    const gateway = new FakePanelGateway();
    const command = createKothPanelSubcommand(createCommandDependencies(harness, { gateway }));

    const first = createFakeChatInteraction({ canManageServer: true });
    await command.execute(first.interaction);
    const second = createFakeChatInteraction({ canManageServer: true });
    await command.execute(second.interaction);

    expect(first.texts().join('\n')).toContain('publicado');
    expect(first.texts().join('\n')).toContain(`<#${SUBSCRIPTION_CHANNEL_ID}>`);
    expect(second.texts().join('\n')).toContain('actualizado');
    expect(gateway.created).toHaveLength(1);
    expect(gateway.updated).toHaveLength(1);
  });

  it('si Discord falla, responde con el motivo en lugar de lanzar el error', async () => {
    const gateway = new FakePanelGateway();
    gateway.failWith(new Error('Missing Access'));
    const command = createKothPanelSubcommand(createCommandDependencies(harness, { gateway }));
    const fake = createFakeChatInteraction({ canManageServer: true });

    await command.execute(fake.interaction);

    expect(fake.texts().join('\n')).toContain('No pude publicar el panel');
    expect(fake.texts().join('\n')).toContain('Missing Access');
  });
});

describe('botones del panel', () => {
  let harness: DmHarness;

  beforeEach(() => {
    harness = createDmHarness();
  });

  afterEach(() => {
    harness.database.close();
  });

  function handlerFor(customId: string) {
    const handler = createKothSubscriptionButtons(createCommandDependencies(harness)).find(
      (candidate) => candidate.customId === customId,
    );
    if (handler === undefined) throw new Error(`Falta el botón ${customId}`);
    return handler;
  }

  it('el botón Suscribirme suscribe y responde solo a quien lo pulsó', async () => {
    const fake = createFakeButtonInteraction(KOTH_SUBSCRIBE_BUTTON_ID, 'u7');

    await handlerFor(KOTH_SUBSCRIBE_BUTTON_ID).execute(fake.interaction);

    expect(harness.subscribers.has('u7')).toBe(true);
    expect(fake.deferReply.mock.calls[0]?.[0]).toMatchObject({ flags: EPHEMERAL });
    expect(fake.texts().join('\n')).toContain('Te has suscrito');
  });

  it('el botón Suscribirme explica qué hacer si el usuario tiene los MD cerrados', async () => {
    harness.messenger.setConfirmationOutcome({ kind: 'dms-closed' });
    const fake = createFakeButtonInteraction(KOTH_SUBSCRIBE_BUTTON_ID);

    await handlerFor(KOTH_SUBSCRIBE_BUTTON_ID).execute(fake.interaction);

    expect(harness.subscribers.has('u1')).toBe(false);
    expect(fake.texts().join('\n')).toContain('Mensajes directos');
  });

  it('el botón Cancelar suscripción da de baja', async () => {
    harness.subscribers.add('u7', harness.clock.now());
    const fake = createFakeButtonInteraction(KOTH_UNSUBSCRIBE_BUTTON_ID, 'u7');

    await handlerFor(KOTH_UNSUBSCRIBE_BUTTON_ID).execute(fake.interaction);

    expect(harness.subscribers.has('u7')).toBe(false);
    expect(fake.reply.mock.calls[0]?.[0]).toMatchObject({ flags: EPHEMERAL });
  });
});
