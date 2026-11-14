import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PANEL_KEY } from '../../src/modules/koth/domain/koth.constants.js';
import { SqliteKothPanelMessageRepository } from '../../src/modules/koth/repositories/sqlite-koth-panel-message.repository.js';
import { KothSubscriptionPanelService } from '../../src/modules/koth/services/koth-subscription-panel.service.js';
import { buildSubscriptionPanelMessage } from '../../src/modules/koth/templates/koth-dm-messages.js';
import {
  createDmHarness,
  createMessageContext,
  type DmHarness,
} from '../helpers/direct-messages.js';
import { FakePanelGateway } from '../helpers/interactions.js';

const CHANNEL = '1570918164261376220';
const UNICODE_EMOJI = /\p{Extended_Pictographic}/u;

describe('KothSubscriptionPanelService', () => {
  let harness: DmHarness;
  let gateway: FakePanelGateway;
  let repository: SqliteKothPanelMessageRepository;

  function createService(channelId = CHANNEL): KothSubscriptionPanelService {
    return new KothSubscriptionPanelService({
      channelId,
      panels: repository,
      gateway,
      clock: harness.clock,
    });
  }

  beforeEach(() => {
    harness = createDmHarness();
    gateway = new FakePanelGateway();
    repository = new SqliteKothPanelMessageRepository(harness.database);
  });

  afterEach(() => {
    harness.database.close();
  });

  it('publica un panel nuevo y recuerda cuál es', async () => {
    const result = await createService().publish();

    expect(result).toEqual({ kind: 'created', messageId: 'panel-1' });
    expect(gateway.created).toEqual([{ channelId: CHANNEL, messageId: 'panel-1' }]);
    expect(repository.find(SUBSCRIPTION_PANEL_KEY)).toEqual({
      key: SUBSCRIPTION_PANEL_KEY,
      channelId: CHANNEL,
      messageId: 'panel-1',
    });
  });

  it('si el panel ya existe lo actualiza en su sitio sin publicar otro', async () => {
    const service = createService();
    await service.publish();

    const result = await service.publish();

    expect(result).toEqual({ kind: 'updated', messageId: 'panel-1' });
    expect(gateway.created).toHaveLength(1);
    expect(gateway.updated).toEqual([{ channelId: CHANNEL, messageId: 'panel-1' }]);
  });

  it('si borraron el mensaje a mano, publica uno nuevo y se queda con el nuevo', async () => {
    const service = createService();
    await service.publish();
    gateway.deleteStoredMessage();

    const result = await service.publish();

    expect(result).toEqual({ kind: 'created', messageId: 'panel-2' });
    expect(repository.find(SUBSCRIPTION_PANEL_KEY)?.messageId).toBe('panel-2');
  });

  it('si se cambia el canal, publica en el nuevo en lugar de editar el antiguo', async () => {
    await createService('1111111111111111111').publish();

    const result = await createService(CHANNEL).publish();

    expect(result.kind).toBe('created');
    expect(gateway.updated).toEqual([]);
    expect(repository.find(SUBSCRIPTION_PANEL_KEY)?.channelId).toBe(CHANNEL);
  });

  it('tras reiniciar el bot sigue actualizando el mismo panel', async () => {
    await createService().publish();

    // Otro servicio sobre la misma base de datos, como tras un reinicio.
    const afterRestart = createService();
    const result = await afterRestart.publish();

    expect(result.kind).toBe('updated');
    expect(gateway.created).toHaveLength(1);
  });

  it('si Discord falla, propaga el error y no recuerda nada', async () => {
    gateway.failWith(new Error('Missing Access'));

    await expect(createService().publish()).rejects.toThrow('Missing Access');
    expect(repository.find(SUBSCRIPTION_PANEL_KEY)).toBeUndefined();
  });
});

interface SerializedButton {
  custom_id: string;
  label: string;
  style: number;
  emoji?: { id?: string; name?: string };
}

/** Los botones tal y como se envían a Discord (el mensaje serializado a JSON). */
function serializedButtons(
  message: ReturnType<typeof buildSubscriptionPanelMessage>,
): SerializedButton[] {
  const json = JSON.parse(JSON.stringify(message)) as {
    components: { components: SerializedButton[] }[];
  };
  return json.components[0]?.components ?? [];
}

describe('panel de suscripción (mensaje)', () => {
  const context = createMessageContext({ subscriptionChannelId: CHANNEL });
  const message = buildSubscriptionPanelMessage(context);
  const buttons = serializedButtons(message);

  it('lleva dos botones con identificadores y estilos distintos', () => {
    expect(buttons.map((button) => button.custom_id)).toEqual([
      'koth:subscribe',
      'koth:unsubscribe',
    ]);
    expect(buttons.map((button) => button.label)).toEqual(['Suscribirme', 'Cancelar suscripción']);
    expect(buttons.map((button) => button.style)).toEqual([3, 2]); // Success, Secondary
  });

  it('los botones usan los iconos de Lucide como emojis personalizados', () => {
    for (const button of buttons) {
      expect(button.emoji?.id).toBeDefined();
      expect(button.emoji?.name).toMatch(/^lc_/);
    }
  });

  it('explica que hay que tener los mensajes directos abiertos y que se puede cancelar', () => {
    const embed = message.embeds?.[0];
    const json = JSON.stringify(embed);

    expect(json).toContain('mensajes directos');
    expect(json).toContain('darte de baja');
  });

  it('no usa emojis Unicode cuando los iconos están cargados', () => {
    expect(JSON.stringify(message)).not.toMatch(UNICODE_EMOJI);
  });

  it('con los iconos sin sincronizar, los botones caen a emojis Unicode', () => {
    const unsynced = buildSubscriptionPanelMessage(
      createMessageContext({ icons: { get: () => '🔔' } }),
    );
    const [first] = serializedButtons(unsynced);

    expect(first?.emoji).toEqual({ name: '🔔' });
  });
});
