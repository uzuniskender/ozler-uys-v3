import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { uniqueId } from '../helpers/factory'

test.describe('03 — Problem Takip (D4/D5 + Kapandı akışı)', () => {
  test('problem oluştur → D4 kök neden ve D5 kalıcı çözüm doldur → Kapandı işaretle → satır yeşil', async ({ page }) => {
    // TEST-E2E- prefixli problem tanımı — cleanup.ts'de 'problem' kolonu ile temizlenir
    const problemAdi = uniqueId('PROBLEM')

    await loginAs(page, 'admin')
    await page.goto('/#/problem-takip')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Yeni Problem modalını aç
    await page.locator('button:has-text("Yeni Problem")').click()
    await expect(page.locator('h2:has-text("Yeni Problem Ekle")')).toBeVisible({ timeout: 5_000 })

    // Problem tanımını doldur
    await page.locator('textarea[placeholder="Problemi açıklayın..."]').fill(problemAdi)

    // D4 — Kök Neden
    await page.locator('textarea[placeholder*="kök neden analizi"]').fill('TEST-E2E kök neden — 5-Neden analizi')

    // D5 — Kalıcı Çözüm
    await page.locator('textarea[placeholder*="düzeltici aksiyon"]').fill('TEST-E2E kalıcı çözüm — proses güncellemesi')

    // D4 + D5 dolu olduğunda öneri banner'ı belirir
    const kapatBtn = page.locator('button:has-text("Kapandı olarak işaretle")')
    await expect(kapatBtn).toBeVisible({ timeout: 3_000 })
    await kapatBtn.click()

    // Kaydet — exact: true: "Ekle" has-text case-insensitive olarak "Yedekler"/"Bekleyen" ile de eşleşir
    await page.getByRole('button', { name: 'Ekle', exact: true }).click()

    // Modal kapandı mı?
    await expect(page.locator('h2:has-text("Yeni Problem Ekle")')).not.toBeVisible({ timeout: 8_000 })

    // Tabloda satır görünür
    const row = page.locator('tr', { hasText: problemAdi }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Satır yeşil — Kapandı durumu: bg-green/5 border-l-green/30
    await expect(row).toHaveClass(/bg-green/)

    // Durum badge "Kapandı" içeriyor
    await expect(row.locator('span:has-text("Kapandı")')).toBeVisible()
  })
})
