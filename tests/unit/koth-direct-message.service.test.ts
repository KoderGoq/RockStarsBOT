import type { Client } from 'discord.js';
import { RESTJSONErrorCodes } from 'discord.js';
import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { DiscordKothDirectMessenger } from '../../src/modules/koth/services/koth-direct-message.service.js';
import { discordError } from '../helpers/discord-errors.js';
import { createMessageContext } from '../helpers/direct-messages.js';

function createMessenger(sendError: Error | undefined) {
  const logger = { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() };
  const send = vi.fn(() =>
    sendError === undefined ? Promise.resolve({ id: 'm1' }) : Promise.reject(sendError),
  );
  const client = { users: { send } } as unknown as Client;
  const messenger = new DiscordKothDirectMessenger({
    client,
    guildId: '1510104515062272171',
    messageContext: createMessageContext(),
    logger: logger as unknown as Logger,
  });
  return { messenger, logger, send };
}

describe('DiscordKothDirectMessenger', () => {
  it('entrega el MD de confirmación sin registrar ningún aviso', async () => {
    const { messenger, logger, send } = createMessenger(undefined);

    const outcome = await messenger.sendSubscriptionConfirmation('u1');

    expect(outcome).toEqual({ kind: 'sent', messageId: 'm1' });
    expect(send).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('el MD no menciona a nadie aunque el texto lleve menciones', async () => {
    const { messenger, send } = createMessenger(undefined);

    await messenger.sendSubscriptionConfirmation('u1');

    expect(send).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ allowedMentions: { parse: [] } }),
    );
  });

  it('con los MD cerrados no genera un aviso en el log (es lo esperable)', async () => {
    const { messenger, logger } = createMessenger(
      discordError(RESTJSONErrorCodes.CannotSendMessagesToThisUser, 403),
    );

    const outcome = await messenger.sendSubscriptionConfirmation('u1');

    expect(outcome.kind).toBe('dms-closed');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledOnce();
  });

  it('un límite de MD de Discord se registra con su código para poder diagnosticarlo', async () => {
    const { messenger, logger } = createMessenger(
      discordError(RESTJSONErrorCodes.OpeningDirectMessagesTooFast, 400),
    );

    const outcome = await messenger.sendSubscriptionConfirmation('u1');

    expect(outcome.kind).toBe('rate-limited');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        purpose: 'confirmación',
        outcome: 'rate-limited',
        code: 40003,
        status: 400,
      }),
      expect.any(String),
    );
  });

  it('un error inesperado de Discord se registra con su código y mensaje', async () => {
    const { messenger, logger } = createMessenger(
      discordError(RESTJSONErrorCodes.SendMessagesHasBeenTemporarilyDisabled, 403),
    );

    const outcome = await messenger.sendSubscriptionConfirmation('u1');

    expect(outcome.kind).toBe('failed');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 40004, status: 403, reason: 'error 40004' }),
      expect.any(String),
    );
  });

  it('un error que no es de Discord también se registra', async () => {
    const { messenger, logger } = createMessenger(new Error('sin red'));

    const outcome = await messenger.sendSubscriptionConfirmation('u1');

    expect(outcome.kind).toBe('failed');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'sin red' }),
      expect.any(String),
    );
  });
});
