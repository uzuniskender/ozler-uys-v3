import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { uniqueId } from '../helpers/factory'
import { supabaseAdmin } from '../helpers/supabase'
async function createTestSevk() {
  const id = uniqueId('SEVK')
  const tarih = new Date().toISOString().slice(0, 10)
  const { error } = await supabaseAdmin.from('uys_sevkler').insert({
    id,
    siparis_no: id,
    musteri: 'TEST-E2E-Sevk-Müşteri',
    tarih,
    kalemler: [{ malkod: 'TEST-MAT', malad: 'Test Mamul', miktar: 5 }],
    durum: 'gerceklesti',
    olusturma: new Date().toISOString(),
  })
  if (error) throw new Error(`Sevkiyat oluşturulamadı: ${error.message}`)
  return id
}

test.describe('06 — Sevkiyat', () => {
  test('Sevkiyat sayfası açılır, "Yeni Sevkiyat" butonu görünür (admin)', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/shipment')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await expect(page.locator('h1:has-text("Sevkiyat")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button:has-text("Yeni Sevkiyat")')).toBeVisible()
  })

  test('"Yeni Sevkiyat" modalı açılır, kapat', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/shipment')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni Sevkiyat")').click()
    // Modal başlığı
    await expect(page.locator('h2:has-text("Yeni Sevkiyat")')).toBeVisible({ timeout: 5_000 })
    // Kalem alanları: Malzeme kodu + Malzeme adı input'ları
    await expect(page.locator('input[placeholder="Malzeme kodu"]').first()).toBeVisible()
    await expect(page.locator('input[placeholder="Malzeme adı"]').first()).toBeVisible()

    // Kapat
    await page.getByRole('button', { name: 'İptal', exact: true }).click()
    await expect(page.locator('h2:has-text("Yeni Sevkiyat")')).not.toBeVisible({ timeout: 5_000 })
  })

  test('DB sevkiyat müşteri grubunda listelenir, genişletince satır görünür', async ({ page }) => {
    const siparisNo = await createTestSevk()

    await loginAs(page, 'admin')
    await page.goto('/#/shipment')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Müşteri grup satırı görünür
    const grupRow = page.locator('tr', { hasText: 'TEST-E2E-Sevk-Müşteri' }).first()
    await expect(grupRow).toBeVisible({ timeout: 10_000 })

    // Genişlet → sevkiyat satırı belirir
    await grupRow.click()
    const sevkCell = page.locator('td', { hasText: siparisNo }).first()
    await expect(sevkCell).toBeVisible({ timeout: 5_000 })
  })
})
