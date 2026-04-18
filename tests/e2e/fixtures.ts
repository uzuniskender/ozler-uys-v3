import { test as base } from '@playwright/test'
import { cleanupAllTestData } from './helpers/cleanup'

type Fixtures = {
  autoCleanup: void
}

/**
 * Base test — her spec'te `test` olarak import edilir.
 * Her testten ÖNCE TEST-E2E-* kayıtlarını temizler.
 */
export const test = base.extend<Fixtures>({
  autoCleanup: [async ({}, use) => {
    await cleanupAllTestData(false)
    await use()
    // Test sonunda da temizle (başka testi etkilemesin)
    await cleanupAllTestData(false)
  }, { auto: true }],
})

export { expect } from '@playwright/test'
