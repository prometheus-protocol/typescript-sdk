// File: vite.config.cli.ts

import { resolve } from 'path';
import { defineConfig } from 'vite';
import pkg from './package.json'; // Import your package.json

export default defineConfig({
  build: {
    // Target a recent Node.js version for compatibility.
    target: 'node18',

    // Output to the same 'dist' directory.
    outDir: 'dist',
    // Don't clean the output directory, as the library build runs first.
    emptyOutDir: false,

    // We are building an executable, not a library in the traditional sense.
    lib: {
      entry: resolve(__dirname, 'src/cli/configure.ts'),
      formats: ['es'], // A single ES module is perfect for a Node CLI.
      fileName: () => 'cli.js', // Output a single file named cli.js.
    },

    rollupOptions: {
      // Externalize all dependencies and Node built-ins.
      // The CLI will be executed in a Node environment where these are available.
      // `npx` will handle installing the dependencies from your package.json.
      external: [
        ...Object.keys(pkg.dependencies || {}),
        /^node:.*/, // A regex to externalize all 'node:*' imports
      ],
    },

    // Minification is not necessary for a CLI tool and can sometimes cause issues.
    minify: false,
  },
});
