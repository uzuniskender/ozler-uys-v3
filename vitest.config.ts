import { defineConfig } from 'vitest/config'
import path from 'node:path'

// v15.48a — Birim test config
// Sadece *.test.ts dosyaları çalıştırılır. Playwright E2E (tests/e2e) ayrı.
// Saf algoritma testleri — Supabase / DOM gerektirmez (node env).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'tests/e2e/**', 'dist'],
    globals: false,
    reporters: ['default'],
  },
})
