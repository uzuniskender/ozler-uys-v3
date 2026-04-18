import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { createIndependentHammaddeWO, createTestMaterial } from '../helpers/factory'
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
    })

    // 3) Admin olarak gir, İE listesine git
    await loginAs(page, 'admin')
    await page.goto('/#/work-orders')

    // 4) Veriler yüklenene kadar bekle (store loadAll)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // 5) Bu İE'nin satırını bul (kod ile ara — factory ie_no = kod set etti)
    const row = page.locator('tr', { hasText: wo.kod }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    // 6) ⛔ YOK badge'i aynı satırda olmalı
    await expect(row.locator('text=/⛔|YOK/')).toBeVisible({ timeout: 5_000 })
  })

  test('İE DB doğrulaması — oluşturulan satır id ile bulunabilir', async () => {
    // master_schema'da 'kod' kolonu yok, 'id' kolonu var.
    // Factory id = uniqueId (kod) olarak set ediyor, 'kod' kolonu yazılmıyor.
    const mat = await createTestMaterial({ ad: 'Hammadde-Sync', tip: 'Hammadde' })
    const wo = await createIndependentHammaddeWO({
      hmKod: mat.kod,
      hmAd: mat.ad,
      hedef: 50_000,
    })

    // DB doğrulama: wo gerçekten orada mı (id ile sorgula)
    const { data } = await supabaseTest
      .from('uys_work_orders')
      .select('id, durum, hedef, bagimsiz, mamul_kod')
      .eq('id', wo.kod)
      .single()
    expect(data).toBeTruthy()
    expect(data?.id).toBe(wo.kod)
    expect(data?.bagimsiz).toBe(true)
    expect(data?.mamul_kod).toBe(mat.kod)
  })
})
