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
      // Type-only files and barrel re-exports have no runtime to cover;
      // excluding them keeps the coverage % a meaningful signal about
      // behavioural test depth.
      exclude: [
        'src/core/**/*.d.ts',
        'src/core/**/index.ts',          // barrel re-exports — no behaviour
        'src/core/turn-engine/effect.ts',       // type defs only
        'src/core/turn-engine/turn-error.ts',   // type defs only
      ],
      // T-390: 80% line coverage gate on /core/
      thresholds: {
        lines: 80,
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
