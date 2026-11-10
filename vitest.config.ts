import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Las pruebas no deben depender de la zona horaria de la máquina.
    env: { TZ: 'UTC' },
    restoreMocks: true,
  },
});
