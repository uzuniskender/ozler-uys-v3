import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { createIndependentHammaddeWO } from '../helpers/factory'
import { supabaseAdmin } from '../helpers/supabase'

test.describe('07 — İş Emri ve Üretim Girişi', () => {

  test('İş Emirleri sayfası açılır, "Yeni İş Emri" butonu görünür (admin)', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await expect(page.locator('h1:has-text("İş Emirleri")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button:has-text("Yeni İş Emri")')).toBeVisible()
  })

  test('DB bağımsız İE listede görünür, "Sipariş Dışı" rozeti gösterir', async ({ page }) => {
    const { kod } = await createIndependentHammaddeWO({ hmKod: 'TEST-MAT', hmAd: 'TEST-E2E-Mamul', hedef: 3 })

    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const row = page.locator('tr', { hasText: kod }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.locator('text=Sipariş Dışı')).toBeVisible()
  })

  test('Bağımsız İE → üretim girişi yap → "Tamamlandı" durumu doğrula', async ({ page }) => {
    const hedef = 3
    const { kod: woId } = await createIndependentHammaddeWO({
      hmKod: 'TEST-MAT', hmAd: 'TEST-E2E-Mamul', hedef,
    })

    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // --- Adım 1: WO satırını bul, "Detayı aç" (Eye buton) ile aç ---
    const row = page.locator('tr', { hasText: woId }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.locator('button[title="Detayı aç"]').click()

    // WODetailModal açıldı
    await expect(page.locator('h2', { hasText: woId })).toBeVisible({ timeout: 5_000 })

    // --- Adım 2: Üretim girişi yap ---
    await page.locator('button:has-text("Kayıt Ekle")').click()

    // OprEntryModal → qty = hedef adet, kaydet
    const qtyInput = page.locator('input[type="number"]').first()
    await expect(qtyInput).toBeVisible({ timeout: 5_000 })
    await qtyInput.fill(String(hedef))
    await page.locator('button:has-text("Kaydet")').click()

    // Toast: "Üretim kaydı eklendi"
    await expect(page.locator('text=Üretim kaydı eklendi')).toBeVisible({ timeout: 10_000 })

    // WODetailModal %100 gösteriyor
    await expect(page.locator('h2', { hasText: woId })).toContainText('100%', { timeout: 8_000 })

    // --- Adım 3: "Tamamlandı" durumunu doğrula ---
    // DB trigger (fn_mrp_durum_check) log eklenince otomatik 'tamamlandi' yapıyor.
    // WODetailModal "▶ Devam Ettir" gösteriyorsa durum='tamamlandi' demektir.
    await expect(page.locator('button:has-text("Devam Ettir")')).toBeVisible({ timeout: 8_000 })

    // DB doğrulama: durum = 'tamamlandi'
    const { data } = await supabaseAdmin
      .from('uys_work_orders').select('durum').eq('id', woId).single()
    expect(data?.durum).toBe('tamamlandi')
  })

})
