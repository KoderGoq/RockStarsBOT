import { DiscordAPIError } from 'discord.js';

/** Error de la API de Discord con el código indicado (p. ej. 50007, 40003). */
export function discordError(code: number, status = 400): DiscordAPIError {
  return new DiscordAPIError(
    { code, message: `error ${code}` },
    code,
    status,
    'POST',
    'https://discord.com/api/v10/test',
    { body: undefined, files: undefined },
  );
}
