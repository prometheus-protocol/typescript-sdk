import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    // Tell Vite to build a library
    lib: {
      // The entry point for our library
      entry: {
        server: resolve(__dirname, 'src/server.ts'),
        browser: resolve(__dirname, 'src/browser.ts'),
      },

      // The name of the global variable when used in a <script> tag
      name: 'PrometheusSDK',
      // The formats to build
      formats: ['es', 'cjs'],
      // The file name for the output bundles
      fileName: (format, entryName) => {
        const extension = format === 'es' ? 'js' : format; // Use .js for es modules, .cjs for commonjs
        return `${entryName}.${extension}`;
      },
    },
    rollupOptions: {
      // We don't want to bundle external dependencies
      external: [
        '@dfinity/agent',
        '@dfinity/identity',
        '@dfinity/principal',
        'pem-file',
        'node:fs',
        'node:buffer',
      ],
      output: {
        // Define globals for UMD build (if you were building for browsers)
        globals: {},
      },
    },
    // Generate source maps for easier debugging
    sourcemap: true,
    // Clean the output directory before building
    emptyOutDir: true,
  },
  plugins: [
    // This plugin generates the .d.ts files
    dts({
      insertTypesEntry: true,
    }),
  ],
});
