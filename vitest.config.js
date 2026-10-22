import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/support/**/*.test.js'],
    environment: 'node',
    restoreMocks: true,
    setupFiles: ['tests/support/setup.js'],
  },
});
