import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../src/config/env.js';

const validEnv = {
  DISCORD_TOKEN: 'fake-token',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_GUILD_ID: '223456789012345678',
  DISCORD_CHANNEL_ID: '323456789012345678',
};

describe('parseEnv', () => {
  it('aplica los valores por defecto', () => {
    expect(parseEnv(validEnv)).toMatchObject({
      TIMEZONE: 'Europe/Madrid',
      SERVER_IP: 'boutcraft.xyz',
      DATABASE_PATH: './data/boutcraft.sqlite',
      LOG_LEVEL: 'info',
    });
  });

  it('trata las variables vacías como ausentes', () => {
    expect(parseEnv({ ...validEnv, TIMEZONE: '', LOG_LEVEL: '  ' }).TIMEZONE).toBe('Europe/Madrid');
  });

  it('rechaza una zona horaria que no sea IANA', () => {
    expect(() => parseEnv({ ...validEnv, TIMEZONE: 'Mars/Olympus' })).toThrow(EnvValidationError);
  });

  it('rechaza IDs de Discord inválidos', () => {
    expect(() => parseEnv({ ...validEnv, DISCORD_CHANNEL_ID: 'general' })).toThrow(
      /DISCORD_CHANNEL_ID/,
    );
  });

  it('exige el token de Discord', () => {
    expect(() => parseEnv({ ...validEnv, DISCORD_TOKEN: undefined })).toThrow(/DISCORD_TOKEN/);
  });
});
