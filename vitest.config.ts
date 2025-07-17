import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use 'jsdom' to simulate a browser environment, which provides
    // localStorage and sessionStorage for our provider tests.
    environment: 'jsdom',
    // Look for test files in a 'test' directory.
    include: ['test/**/*.test.ts'],
  },
});
