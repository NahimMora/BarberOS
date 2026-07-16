import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Serial on purpose: a cold Next.js dev server compiling /login and
  // /dashboard for the first time under parallel workers was slower than
  // the default assertion timeout and made this small smoke suite flaky.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3411',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- -p 3411',
    url: 'http://127.0.0.1:3411',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
