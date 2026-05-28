import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      // 80% line coverage gate on /core/ — enforced once tests land (T-390)
      thresholds: {
        lines: 0, // raised to 80 in T-390
      },
    },
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@scenes': resolve(__dirname, 'src/scenes'),
      '@platform': resolve(__dirname, 'src/platform'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@balance': resolve(__dirname, '../../packages/balance'),
      '@content': resolve(__dirname, '../../packages/content'),
    },
  },
});
