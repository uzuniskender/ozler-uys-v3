import { test, expect } from './fixtures'
import { goTo, testId, supabaseTest, expectToast } from './helpers'

test.describe('Malzeme CRUD', () => {
  test('Yeni hammadde malzeme ekleme', async ({ page }) => {
    const kod = testId('HM')
    const ad = 'Test Çelik Profil'

    await goTo(page, '/materials')
    await page.locator('button:has-text("Yeni"), button:has-text("Ekle")').first().click()
    
    await page.locator('input[placeholder*="Kod"], input[name="kod"]').first().fill(kod)
    await page.locator('input[placeholder*="Ad"], input[name="ad"]').first().fill(ad)
    
    // Tip dropdown
    const tipSelect = page.locator('select').filter({ hasText: /Hammadde|Mamul|Yarı/i }).first()
    if (await tipSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tipSelect.selectOption({ label: 'Hammadde' })
    }
    
    await page.locator('button:has-text("Kaydet")').first().click()
    
    // DB'de oluştuğunu doğrula
    const { data } = await supabaseTest.from('uys_malzemeler').select('*').eq('kod', kod).single()
    expect(data).toBeTruthy()
    expect(data?.ad).toBe(ad)
  })

  test('Malzemeyi ölçü filtresiyle arama', async ({ page }) => {
    // Önce bir malzeme oluştur (doğrudan DB)
    const kod = testId('HM-OLCU')
    await supabaseTest.from('uys_malzemeler').insert({
      id: kod, kod, ad: 'Test Boy Ölçülü', tip: 'Hammadde',
      birim: 'Adet', boy: 6000, en: 50, kalinlik: 3, cap: 0, ic_cap: 0,
      aktif: true,
    })
    
    await goTo(page, '/bom')
    // Yeni BOM oluşturma aç
    await page.locator('button:has-text("Yeni")').first().click()
    
    // Detaylı arama butonu
    const searchBtn = page.locator('button[title*="Detaylı arama"]').first()
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBtn.click()
      // Modal açıldı
      await expect(page.locator('h2:has-text("Malzeme Ara")').first()).toBeVisible()
      // Boy filtresiyle ara
      await page.locator('input[type="number"]').first().fill('6000')
      // Sonuç listede görünsün
      await expect(page.locator(`text=${kod}`).first()).toBeVisible({ timeout: 3000 })
    }
  })
})
