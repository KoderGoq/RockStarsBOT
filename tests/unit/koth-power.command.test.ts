import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createKothPauseSubcommand,
  createKothResumeSubcommand,
} from '../../src/modules/koth/commands/koth-power.command.js';
import {
  buildAlreadyPausedReply,
  buildAlreadyRunningReply,
  buildPausedReply,
  buildResumedReply,
} from '../../src/modules/koth/templates/koth-admin-messages.js';
import { createDmHarness, type DmHarness } from '../helpers/direct-messages.js';
import { createLoadedIconRegistry } from '../helpers/icons.js';
import { createCommandDependencies, createFakeChatInteraction } from '../helpers/interactions.js';
import { madrid } from '../helpers/time.js';

const EPHEMERAL = 64;
const UNICODE_EMOJI = /\p{Extended_Pictographic}/u;

describe('/koth apagar y /koth encender', () => {
  let harness: DmHarness;

  beforeEach(() => {
    harness = createDmHarness();
  });

  afterEach(() => {
    harness.database.close();
  });

  function setup() {
    const deps = createCommandDependencies(harness);
    return {
      deps,
      apagar: createKothPauseSubcommand(deps),
      encender: createKothResumeSubcommand(deps),
    };
  }

  it('apagar deja los avisos apagados y responde solo a quien lo ejecutó', async () => {
    const { deps, apagar } = setup();
    const fake = createFakeChatInteraction({ canManageServer: true, userId: 'admin-1' });

    await apagar.execute(fake.interaction);

    expect(deps.pause.isPaused()).toBe(true);
    expect(deps.pause.status()?.changedBy).toBe('admin-1');
    expect(fake.reply.mock.calls[0]?.[0]).toMatchObject({ flags: EPHEMERAL });
    expect(fake.texts().join('\n')).toContain('Avisos apagados');
  });

  it('encender vuelve a activar los avisos', async () => {
    const { deps, apagar, encender } = setup();
    await apagar.execute(createFakeChatInteraction({ canManageServer: true }).interaction);
    const fake = createFakeChatInteraction({ canManageServer: true });

    await encender.execute(fake.interaction);

    expect(deps.pause.isPaused()).toBe(false);
    expect(fake.texts().join('\n')).toContain('Avisos encendidos');
  });

  it('apagar un bot ya apagado lo dice y no cambia nada', async () => {
    const { deps, apagar } = setup();
    await apagar.execute(
      createFakeChatInteraction({ canManageServer: true, userId: 'admin-1' }).interaction,
    );
    const fake = createFakeChatInteraction({ canManageServer: true, userId: 'admin-2' });

    await apagar.execute(fake.interaction);

    expect(fake.texts().join('\n')).toContain('ya estaban apagados desde');
    expect(deps.pause.status()?.changedBy).toBe('admin-1');
  });

  it('encender un bot ya encendido lo dice', async () => {
    const { encender } = setup();
    const fake = createFakeChatInteraction({ canManageServer: true });

    await encender.execute(fake.interaction);

    expect(fake.texts().join('\n')).toContain('ya estaban encendidos');
  });

  it('sin el permiso "Gestionar servidor" no se puede apagar ni encender', async () => {
    const { deps, apagar, encender } = setup();
    const noPermission = createFakeChatInteraction({ canManageServer: false });

    await apagar.execute(noPermission.interaction);
    expect(deps.pause.isPaused()).toBe(false);
    expect(noPermission.texts().join('\n')).toContain('Gestionar servidor');

    deps.pause.pause('admin-1');
    const again = createFakeChatInteraction({ canManageServer: false });
    await encender.execute(again.interaction);
    expect(deps.pause.isPaused()).toBe(true);
  });

  it('funciona desde cualquier canal: no depende del canal de suscripción', async () => {
    const { deps, apagar } = setup();
    const fake = createFakeChatInteraction({ canManageServer: true, channelId: 'general' });

    await apagar.execute(fake.interaction);

    expect(deps.pause.isPaused()).toBe(true);
  });
});

describe('respuestas de apagar y encender', () => {
  const icons = createLoadedIconRegistry();

  it('indican que el bot sigue conectado y cómo volver a encender', () => {
    expect(buildPausedReply(icons)).toContain('sigue conectado');
    expect(buildPausedReply(icons)).toContain('/koth encender');
  });

  it('explican qué pasa con los avisos que vencieron mientras estaba apagado', () => {
    expect(buildResumedReply(icons)).toContain('no se envían');
  });

  it('"ya estaban apagados" indica desde cuándo con la fecha relativa de Discord', () => {
    const state = {
      paused: true,
      changedBy: 'admin-1',
      changedAt: madrid('2026-11-19T12:00').toUTC().toISO() ?? '',
    };

    expect(buildAlreadyPausedReply(state, icons)).toContain(
      `<t:${Math.floor(madrid('2026-11-19T12:00').toSeconds())}:R>`,
    );
    expect(buildAlreadyPausedReply(undefined, icons)).not.toContain('<t:');
  });

  it('no usan emojis Unicode cuando los iconos están cargados', () => {
    const texts = [
      buildPausedReply(icons),
      buildResumedReply(icons),
      buildAlreadyRunningReply(icons),
      buildAlreadyPausedReply(undefined, icons),
    ];

    for (const text of texts) expect(text).not.toMatch(UNICODE_EMOJI);
  });
});
