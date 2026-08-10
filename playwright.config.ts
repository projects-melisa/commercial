import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  // These tests share one seeded database; parallel workers would let one spec's
  // writes change another's expected row set.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The phone-sized assertions belong to the mobile project alone.
      testIgnore: /responsive\.spec\.ts/,
    },
    // The spec asks for the dashboard to be usable on a phone; running the whole
    // suite there would be slow, so mobile-specific assertions live in one spec.
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command: `pnpm build && pnpm start --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // The reminder button invokes this; without it the manual path would be
      // exercised only as far as the network call and its failure branch.
      command:
        'supabase functions serve send-reminders --env-file supabase/functions/.env.local --no-verify-jwt',
      url: 'http://127.0.0.1:54321/functions/v1/send-reminders',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
