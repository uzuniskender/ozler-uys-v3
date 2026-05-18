import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { uniqueId } from '../helpers/factory'
import { supabaseAdmin } from '../helpers/supabase'

async function createTestOrder() {
  const id = uniqueId('MRP')
  const { error } = await supabaseAdmin.from('uys_orders').insert({
    id,
    siparis_no: id,
    musteri: 'TEST-E2E-MRP-Müşteri',
    mamul_kod: 'TEST-MAT',
    mamul_ad: 'Test Mamul',
    adet: 5,
    termin: '2026-12-31',
    durum: '',
    olusturma: new Date().toISOString(),
  })
  if (error) throw new Error(`MRP test siparişi oluşturulamadı: ${error.message}`)
  return id
}

test.describe('05 — MRP Hesaplama', () => {
  test('MRP sayfası açılır, Hesapla butonu başlangıçta disabled', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // "Hesapla →" butonu sayfa yüklenince görünür fakat seçili sipariş yok → disabled
    const hesaplaBtn = page.locator('button:has-text("Hesapla")')
    await expect(hesaplaBtn).toBeVisible({ timeout: 10_000 })
    await expect(hesaplaBtn).toBeDisabled()
  })

  test('DB sipariş MRP listesinde görünür, seçilince Hesapla aktif olur', async ({ page }) => {
    const siparisNo = await createTestOrder()

    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Sipariş kartı: data-testid="order-card" + siparisNo metni
    const orderCard = page.locator('[data-testid="order-card"]', { hasText: siparisNo })
    await expect(orderCard).toBeVisible({ timeout: 10_000 })

    // Tıkla → seçili hale gelir
    await orderCard.click()
    await expect(page.locator('text=1 kayıt seçili')).toBeVisible({ timeout: 3_000 })

    // Hesapla artık enabled
    const hesaplaBtn = page.locator('button:has-text("Hesapla")')
    await expect(hesaplaBtn).toBeEnabled({ timeout: 3_000 })
  })

  test('Hesapla → sonuç bölümü görünür (WO yoksa 0 eksik)', async ({ page }) => {
    const siparisNo = await createTestOrder()

    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const orderCard = page.locator('[data-testid="order-card"]', { hasText: siparisNo })
    await expect(orderCard).toBeVisible({ timeout: 10_000 })
    await orderCard.click()

    await page.locator('button:has-text("Hesapla")').click()

    // Sonuç bölümü: "0 eksik" ve "0 yeterli" filtreleme butonları belirir
    await expect(page.locator('button', { hasText: /\d+ eksik/ }).first()).toBeVisible({ timeout: 15_000 })
  })
})
