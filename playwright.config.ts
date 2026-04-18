import { defineConfig, devices } from '@playwright/test'

/**
 * UYS v3 E2E test konfigürasyonu
 *
 * KURULUM:
 *   1. .env.test dosyası oluştur (.env.test.example'dan kopyala)
 *   2. npm run test:e2e
 *
 * UYARI:
 *   Testler TEST Supabase projesine yazar, CANLI'ya DOKUNMAZ.
 *   .env.test yanlış yapılandırılırsa testler çalışmaz.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Serial — aynı DB'ye yazıyoruz, parallel olursa çakışır
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Test hızı için biraz yavaşlat (UI yarışlarını azalt)
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev:test',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
