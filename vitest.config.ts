import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: {
    '@aragoz/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
    '@aragoz/combat': fileURLToPath(new URL('./packages/combat/src/index.ts', import.meta.url)),
  } },
  test: { include: ['packages/**/*.test.ts', 'apps/server/**/*.test.ts', 'apps/web/src/**/*.test.ts'], maxWorkers: 1, testTimeout: 10000 },
});
