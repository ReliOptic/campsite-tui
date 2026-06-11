import { defineConfig } from 'vitest/config';

export const config = defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});

export default config;
