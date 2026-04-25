import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/backend/dist/**', '**/legacy/**', '**/tests/e2e/**'],
    testTimeout: 15000,
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-key-for-testing-only-min-32-chars',
    },
  },
});
