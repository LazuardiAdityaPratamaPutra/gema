import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@gema\/(.*)$/,
        replacement: path.resolve(import.meta.dirname, 'packages/$1/index.ts'),
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(import.meta.dirname, 'src/$1') },
    ],
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    // seed demo (PBKDF2 600k + ML-KEM) di beforeAll bisa melewati batas bawaan 10 detik saat CPU sibuk
    hookTimeout: 60000,
  },
});
