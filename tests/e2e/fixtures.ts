import { test as base, expect } from '@playwright/test'
import { cleanupTestData, preTestSafetyCheck, loginAsAdmin } from './helpers'

/**
 * Özelleştirilmiş test fixture
 * - Her test öncesi test verisi temizlenir (güvenlik)
 * - Her test öncesi admin login yapılır
 * - Her test sonrası test verisi temizlenir
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Test öncesi güvenlik
    await preTestSafetyCheck()

    // Login
    await loginAsAdmin(page)

    // Test çalışsın
    await use(page)

    // Test sonrası temizlik
    await cleanupTestData()
  },
})

export { expect }
