import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// .env.test'i yükle — test Supabase URL + anon key
loadEnv({ path: '.env.test' })

export default defineConfig({
  testDir: './tests/e2e/specs',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // DB paylaşımlı, paralel çalıştırmayalım (şimdilik)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Tek worker — DB kirliliğini en aza indir
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev:test',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  globalTeardown: './tests/e2e/run-cleanup.ts',
})
