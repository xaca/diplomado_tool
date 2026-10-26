import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Two test projects:
// - unit:  pure logic in src (`npm test`)
// - rules: Security Rules against the Firestore emulator (`npm run test:rules`)
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.ts'],
          environment: 'node',
          // Tests share one emulator database
          fileParallelism: false,
        },
      },
    ],
  },
})
