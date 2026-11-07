import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the local Auth + Firestore emulators (`npm run test:e2e`).
// The app runs in "emulators" mode (.env.emulators → demo-pbl project), never against production.

// E2E_PORT: when another project's dev server already has 5174
const PORT = Number(process.env.E2E_PORT ?? 5174)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1, // one shared emulator database
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-CO',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --mode emulators --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    // The app talks to the emulators `emulators:exec` started, wherever they are
    env: {
      VITE_FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '',
      VITE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '',
    },
  },
})
