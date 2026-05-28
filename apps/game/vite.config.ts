import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  return {
    root: '.',
    publicDir: 'public',

    // __DEMO_MODE__ is replaced at build time by Rollup — never a runtime variable.
    // CI smoke test (T-32) boots the production bundle and asserts __DEMO_MODE__ === false.
    define: {
      __DEMO_MODE__: isDemo,
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

    server: {
      port: 5173,
      strictPort: true,
      host: true, // allow LAN access for physical device testing
    },

    build: {
      outDir: isDemo ? 'dist-demo' : 'dist',
      emptyOutDir: true,
      // Target floor: iOS 15+ (Safari 15) / Android 10+ (Chrome 80+). TDD §15 / DR-002.
      target: ['es2022', 'safari15', 'chrome80'],
      // Source maps for production (Crashlytics symbolication); stripped from demo bundle.
      sourcemap: !isDemo,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // Phaser (~1.5 MB) in its own chunk for long-term HTTP cache reuse.
          manualChunks: {
            phaser: ['phaser'],
          },
        },
      },
    },
  };
});
