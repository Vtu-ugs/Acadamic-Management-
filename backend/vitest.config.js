import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share one MySQL test DB, so run files serially to avoid
    // cross-file interference on the same tables.
    fileParallelism: false,
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
