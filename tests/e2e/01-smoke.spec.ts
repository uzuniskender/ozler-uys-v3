import { test, expect } from './fixtures'
import { goTo } from './helpers'

/**
 * SMOKE TESTLERİ — her sayfa hatasız açılıyor mu?
 */
test.describe('Smoke — Sayfa Yüklenebilirliği', () => {
  const sayfalar = [
    { hash: '/', baslik: 'Dashboard' },
    { hash: '/orders', baslik: 'Siparişler' },
    { hash: '/work-orders', baslik: 'İş Emirleri' },
    { hash: '/production', baslik: 'Üretim Girişi' },
    { hash: '/materials', baslik: 'Malzeme' },
    { hash: '/recipes', baslik: 'Reçete' },
    { hash: '/bom', baslik: 'Ürün Ağacı' },
    { hash: '/cutting', baslik: 'Kesim' },
    { hash: '/mrp', baslik: 'MRP' },
    { hash: '/shipment', baslik: 'Sevkiyat' },
    { hash: '/warehouse', baslik: 'Depo' },
    { hash: '/reports', baslik: 'Rapor' },
    { hash: '/data', baslik: 'Veri Yönetimi' },
  ]

  for (const { hash, baslik } of sayfalar) {
    test(`${hash} sayfası açılıyor ve "${baslik}" başlığı görünüyor`, async ({ page }) => {
      await goTo(page, hash)
      await expect(page.locator('h1').filter({ hasText: new RegExp(baslik, 'i') }).first()).toBeVisible({ timeout: 5000 })
      // Konsolda error olmasın
      const errors: string[] = []
      page.on('pageerror', err => errors.push(err.message))
      await page.waitForTimeout(500)
      expect(errors).toHaveLength(0)
    })
  }

  test('Yardım butonu çalışıyor', async ({ page }) => {
    await goTo(page, '/work-orders')
    await page.locator('button[title="Sayfa yardımı"]').click()
    await expect(page.locator('h2:has-text("İş Emirleri")').first()).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Notlar butonu çalışıyor', async ({ page }) => {
    await goTo(page, '/orders')
    await page.locator('button[title="Ekip notları"]').click()
    await expect(page.locator('h2:has-text("Ekip Notları")').first()).toBeVisible()
  })
})
