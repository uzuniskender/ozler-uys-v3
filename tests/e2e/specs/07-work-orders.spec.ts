import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { createIndependentHammaddeWO } from '../helpers/factory'

test.describe('07 — İş Emirleri', () => {
  test('İş Emirleri sayfası açılır, "Yeni İş Emri" butonu görünür (admin)', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await expect(page.locator('h1:has-text("İş Emirleri")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button:has-text("Yeni İş Emri")')).toBeVisible()
  })

  test('DB bağımsız İE listede görünür, "Sipariş Dışı" rozeti gösterir', async ({ page }) => {
    const { kod } = await createIndependentHammaddeWO({ hmKod: 'TEST-MAT', hmAd: 'Test Mamul', hedef: 3 })

    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const row = page.locator('tr', { hasText: kod }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.locator('text=Sipariş Dışı')).toBeVisible()
  })

  test('Üretim girişi → WODetailModal %100 gösterir', async ({ page }) => {
    const hedef = 3
    const { kod } = await createIndependentHammaddeWO({ hmKod: 'TEST-MAT', hmAd: 'Test Mamul', hedef })

    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // WO satırını bul, "Detayı aç" butonuna tıkla
    const row = page.locator('tr', { hasText: kod }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.locator('button[title="Detayı aç"]').click()

    // WODetailModal açıldı
    await expect(page.locator('h2', { hasText: kod })).toBeVisible({ timeout: 5_000 })

    // Kayıt Ekle → OprEntryModal açılır
    await page.locator('button:has-text("Kayıt Ekle")').click()

    // Üretim adedini doldur ve kaydet
    await page.locator('input[type="number"]').first().fill(String(hedef))
    await page.locator('button:has-text("Kaydet")').click()

    // OprEntryModal kapanır, WODetailModal h2 %100 gösterir
    await expect(page.locator('h2', { hasText: kod })).toContainText('100%', { timeout: 10_000 })
  })
})
