import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'verification/**/*.test.ts',
      'guardian/**/*.test.ts',
      'auditor/**/*.test.ts',
      'contracts/**/*.test.ts',
      'scripts/**/*.test.ts',
      'verify/**/*.test.ts',
    ],
    testTimeout: 30_000,
  },
});
