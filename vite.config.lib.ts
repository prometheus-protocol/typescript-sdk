// File: vite.config.lib.ts

import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  build: {
    lib: {
      entry: {
        server: resolve(__dirname, 'src/server.ts'),
        browser: resolve(__dirname, 'src/browser.ts'),
      },
      name: 'PrometheusSDK',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },

    rollupOptions: {
      external: [
        '@dfinity/agent',
        '@dfinity/identity',
        '@dfinity/identity-secp256k1',
        '@dfinity/ledger-icrc',
        '@dfinity/principal',
        'pem-file',
        'node:fs',
        'node:buffer',
        'node:child_process',
        'node:path',
        'node:os',
      ],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
    nodePolyfills({
      include: ['util'],
    }),
  ],
});
