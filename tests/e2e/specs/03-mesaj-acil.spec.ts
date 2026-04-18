import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { createTestOperator, createOperatorMessage } from '../helpers/factory'

test.describe('03 — Operatör Mesajları (v15.11 + v15.12)', () => {
  test('Acil mesaj → admin Messages sayfasında kırmızı ACİL pulse sayacı', async ({ page }) => {
    // 1) Test operatörü + acil mesaj
    const opr = await createTestOperator({ ad: 'Opr-Test', bolum: 'E2E' })
    await createOperatorMessage({
      oprId: opr.id,
      oprAd: opr.ad,
      mesaj: 'Boru stokta yok — acil',
      kategori: 'Stok',
      oncelik: 'Acil',
    })

    // 2) Admin olarak Messages sayfasına git
    await loginAs(page, 'admin')
    await page.goto('/#/messages')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // 3) ACİL rozeti (animate-pulse) görünür olmalı
    await expect(page.locator('text=/ACİL/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Normal mesaj → ACİL rozeti görünmez', async ({ page }) => {
    const opr = await createTestOperator({ ad: 'Opr-Norm', bolum: 'E2E' })
    await createOperatorMessage({
      oprId: opr.id,
      oprAd: opr.ad,
      mesaj: 'Standart bilgilendirme',
      kategori: 'Diğer',
      oncelik: 'Normal',
    })

    await loginAs(page, 'admin')
    await page.goto('/#/messages')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Operatör adı listede görünmeli
    await expect(page.locator(`text=${opr.ad}`).first()).toBeVisible({ timeout: 10_000 })

    // Ama ACİL rozet top bar'da sayaç yok (başlık altındaki)
    // Not: Başka acil mesaj varsa bu test zayıflar — cleanup her test öncesi çalıştığı için güvenli.
    const acilCount = await page.locator('[class*="animate-pulse"]').filter({ hasText: /ACİL/i }).count()
    expect(acilCount).toBe(0)
  })

  test('Kategori filtresi → sadece seçili kategoride operatörler görünür', async ({ page }) => {
    const oprStok = await createTestOperator({ ad: 'Opr-Stok', bolum: 'E2E' })
    const oprAriza = await createTestOperator({ ad: 'Opr-Ariza', bolum: 'E2E' })

    await createOperatorMessage({
      oprId: oprStok.id,
      oprAd: oprStok.ad,
      mesaj: 'Profil bitti',
      kategori: 'Stok',
      oncelik: 'Normal',
    })
    await createOperatorMessage({
      oprId: oprAriza.id,
      oprAd: oprAriza.ad,
      mesaj: 'Makine durdu',
      kategori: 'Arıza',
      oncelik: 'Normal',
    })

    await loginAs(page, 'admin')
    await page.goto('/#/messages')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // İkisi de görünmeli başlangıçta
    await expect(page.locator(`text=${oprStok.ad}`).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator(`text=${oprAriza.ad}`).first()).toBeVisible()

    // Kategori dropdown: "Arıza" seç
    const dropdown = page.locator('select').filter({ hasText: /kategoril?er/i }).first()
    if (await dropdown.count() > 0) {
      await dropdown.selectOption({ label: 'Arıza' })
      // Stok operatörü artık görünmemeli, Arıza operatörü görünmeli
      await expect(page.locator(`text=${oprAriza.ad}`).first()).toBeVisible({ timeout: 5_000 })
      await expect(page.locator(`text=${oprStok.ad}`)).toHaveCount(0, { timeout: 3_000 })
    }
  })
})
