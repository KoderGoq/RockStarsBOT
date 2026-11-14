import { RESTJSONErrorCodes } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { classifyDirectMessageError } from '../../src/modules/koth/services/classify-direct-message-error.js';
import { discordError } from '../helpers/discord-errors.js';

describe('classifyDirectMessageError', () => {
  it.each([
    [RESTJSONErrorCodes.CannotSendMessagesToThisUser, 'dms-closed'],
    [RESTJSONErrorCodes.CannotSendMessagesToThisUserDueToHavingNoMutualGuilds, 'dms-closed'],
    [RESTJSONErrorCodes.OpeningDirectMessagesTooFast, 'rate-limited'],
    [RESTJSONErrorCodes.UnknownMember, 'not-member'],
    [RESTJSONErrorCodes.UnknownUser, 'not-member'],
  ])('el código %i se traduce a "%s"', (code, expected) => {
    expect(classifyDirectMessageError(discordError(code)).kind).toBe(expected);
  });

  it('cualquier otro error de Discord es un fallo inesperado que conserva el error', () => {
    const error = discordError(RESTJSONErrorCodes.MissingAccess);

    expect(classifyDirectMessageError(error)).toEqual({ kind: 'failed', error });
  });

  it('un error que no es de Discord también es un fallo inesperado', () => {
    const error = new Error('sin red');

    expect(classifyDirectMessageError(error)).toEqual({ kind: 'failed', error });
  });
});
