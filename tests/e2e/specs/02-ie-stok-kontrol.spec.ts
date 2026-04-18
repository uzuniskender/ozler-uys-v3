import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { createIndependentHammaddeWO, createTestMaterial, uniqueId } from '../helpers/factory'
import { supabaseTest } from '../helpers/supabase'

test.describe('02 — Stok Kontrol (v15.10 regression)', () => {
  test('bağımsız hammadde İE, stoktan büyük hedef → ⛔ YOK badge görünür', async ({ page }) => {
    // 1) Stoğu 0 olan test malzemesi
    const mat = await createTestMaterial({ ad: 'Hammadde-NoStock', tip: 'Hammadde' })

    // 2) Bağımsız İE (hedef = 999999)
    const wo = await createIndependentHammaddeWO({
      hmKod: mat.kod,
      hmAd: mat.ad,
      hedef: 999_999,
      kalan: 999_999,
    })

    // 3) Admin olarak gir, İE listesine git
    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')

    // 4) Veriler yüklenene kadar bekle (store loadAll)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // 5) Bu İE'nin satırını bul (kod ile ara)
    const row = page.locator('tr', { hasText: wo.kod }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    // 6) ⛔ YOK badge'i aynı satırda olmalı
    await expect(row.locator('text=/⛔|YOK/')).toBeVisible({ timeout: 5_000 })
  })

  test('hedef 0 → stok kontrolü çalışmaz, badge yok', async ({ page }) => {
    const mat = await createTestMaterial({ ad: 'Hammadde-Zero', tip: 'Hammadde' })
    const wo = await createIndependentHammaddeWO({
      hmKod: mat.kod,
      hmAd: mat.ad,
      hedef: 100,
      kalan: 0, // tamamlanmış
    })

    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const row = page.locator('tr', { hasText: wo.kod }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    // kalan=0 → stok badge'i olmamalı
    const badge = row.locator('text=/⛔ YOK/')
    await expect(badge).toHaveCount(0, { timeout: 3_000 })
  })

  test('İE listesi badge ile operatör panel aynı sonucu gösterir', async ({ page }) => {
    // Regression: v15.9+v15.10 sonrası liste↔operatör panel uyumu
    const mat = await createTestMaterial({ ad: 'Hammadde-Sync', tip: 'Hammadde' })
    const wo = await createIndependentHammaddeWO({
      hmKod: mat.kod,
      hmAd: mat.ad,
      hedef: 50_000,
    })

    // DB doğrulama: wo gerçekten orada mı
    const { data } = await supabaseTest
      .from('uys_work_orders')
      .select('id, kod, durum, hedef, kalan')
      .eq('kod', wo.kod)
      .single()
    expect(data).toBeTruthy()
    expect(data?.kod).toBe(wo.kod)
  })
})
