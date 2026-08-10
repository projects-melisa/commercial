import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    environment: 'node',
    // These tests share one seeded database; running files in parallel would let one
    // file's writes change another's expected row set.
    fileParallelism: false,
    testTimeout: 20_000,
    setupFiles: ['tests/rls/setup.ts'],
  },
})
