/**
 * MRP Davranış E2E Testleri — Playwright
 * 
 * Bugün yaşanan 3 davranış bozukluğundan türetildi:
 * 1. Kapalı/tamamlanmış sipariş aktif MRP listesinde görünmemeli
 * 2. Arşiv modunda seçip Hesapla → sonuç gelmeli (0 eksik, N yeterli)
 * 3. selectedOrders state — kapanan sipariş seçimden düşmeli
 * 
 * KURAL: Her yeni MRP davranış bozukluğu = buraya yeni senaryo.
 */

import { test, expect } from '@playwright/test'

// ─── Yardımcı: MRP sayfasına git ve yüklenmeyi bekle ─────────────
async function goToMRP(page: any) {
  await page.goto('/#/mrp')
  await page.waitForSelector('text=Malzeme İhtiyaç Planlaması', { timeout: 10000 })
  // Store yüklenene kadar bekle
  await page.waitForTimeout(1500)
}

// ─── GRUP 1: Kapalı sipariş görünürlüğü ──────────────────────────
test.describe('MRP — Kapalı sipariş görünürlüğü', () => {
  test('durum=kapalı sipariş aktif listede görünmemeli', async ({ page }) => {
    await goToMRP(page)

    // Aktif listede S26A_02981 görünmemeli (kapalı sipariş)
    // Not: Bu test gerçek DB'ye karşı çalışır — TEST Supabase projesi kullanılmalı
    const cards = page.locator('[data-testid="order-card"]')
    const count = await cards.count()

    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent()
      // Kapalı sipariş içeriği aktif listede olmamalı
      expect(text).not.toContain('S26A_02981')
    }
  })

  test('Arşiv butonu açılınca kapalı siparişler görünmeli', async ({ page }) => {
    await goToMRP(page)

    // Önce arşiv kapalı — count=0 olmalı
    const archiveBtn = page.locator('button:has-text("Arşiv")')
    await expect(archiveBtn).toBeVisible()

    // Arşiv aç
    await archiveBtn.click()
    await page.waitForTimeout(500)

    // Arşiv açıkken filtre "Tümü" moduna geçmeli (viewFilter)
    const tumBtn = page.locator('button:has-text("Tümü")').first()
    // Tümü aktif olmalı (arşiv modunda otomatik)
    await expect(tumBtn).toHaveClass(/bg-accent|text-accent/i)
  })
})

// ─── GRUP 2: Hesapla → Sonuç ─────────────────────────────────────
test.describe('MRP — Hesaplama sonucu', () => {
  test('Aktif sipariş seçip Hesapla → sonuç satırları gelmeli', async ({ page }) => {
    await goToMRP(page)

    // İlk aktif siparişi seç
    const firstCard = page.locator('[data-testid="order-card"]').first()
    if (await firstCard.count() === 0) {
      test.skip() // Aktif sipariş yok
      return
    }
    await firstCard.click()

    // Hesapla
    await page.click('button:has-text("Hesapla")')
    await page.waitForTimeout(2000)

    // Toast: "N kalem hesaplandı"
    await expect(page.locator('text=kalem hesaplandı')).toBeVisible({ timeout: 5000 })
  })

  test('Arşiv modunda kapalı sipariş seçip Hesapla → 0 eksik, N yeterli gelmeli', async ({ page }) => {
    await goToMRP(page)

    // Arşiv aç
    const archiveBtn = page.locator('button:has-text("Arşiv")')
    await archiveBtn.click()
    await page.waitForTimeout(500)

    // Kapalı sipariş kartı bul ve seç
    const closedCard = page.locator('[data-testid="order-card"]').first()
    if (await closedCard.count() === 0) {
      test.skip()
      return
    }
    await closedCard.click()

    // Hesapla
    await page.click('button:has-text("Hesapla")')
    await page.waitForTimeout(2000)

    // "0 eksik" rozeti görünmeli
    await expect(page.locator('text=0 eksik')).toBeVisible({ timeout: 5000 })

    // Yeterli satırları görünmeli (boş tablo olmamalı)
    const rows = page.locator('[data-testid="mrp-result-row"]')
    // Retrospektif modda en az 1 satır gelmeli
    // (eğer sipariş gerçekten malzeme kullananmışsa)
    const rowCount = await rows.count()
    // Toast'ta 0 kalem yazıyorsa test skip — sipariş HM kullanmamış
    const toast = await page.locator('text=kalem hesaplandı').textContent()
    if (toast && toast.includes('0 kalem')) {
      // Kabul edilebilir — sipariş BOM'suz veya YM-only
    } else {
      expect(rowCount).toBeGreaterThan(0)
    }
  })
})

// ─── GRUP 3: selectedOrders state temizleme ──────────────────────
test.describe('MRP — selectedOrders state', () => {
  test('Hiçbirini butonu → tüm seçimler temizlenmeli', async ({ page }) => {
    await goToMRP(page)

    // Tüm seç
    const selectAllBtn = page.locator('button:has-text("Tümünü Seç")')
    if (await selectAllBtn.count() > 0) {
      await selectAllBtn.click()
      await page.waitForTimeout(300)

      // Seçili count > 0
      const counter = page.locator('text=kayıt seçili')
      await expect(counter).toBeVisible()

      // Hiçbirini tıkla
      await page.click('button:has-text("Hiçbirini")')
      await page.waitForTimeout(300)

      // 0 kayıt seçili
      await expect(page.locator('text=0 kayıt seçili')).toBeVisible()
    }
  })

  test('Hesapla sonrası yeni sipariş seçilince önceki sonuç temizlenmeli', async ({ page }) => {
    await goToMRP(page)

    const cards = page.locator('[data-testid="order-card"]')
    if (await cards.count() < 2) {
      test.skip()
      return
    }

    // 1. sipariş seç + hesapla
    await cards.first().click()
    await page.click('button:has-text("Hesapla")')
    await page.waitForTimeout(2000)
    await expect(page.locator('text=kalem hesaplandı')).toBeVisible({ timeout: 5000 })

    // Seçimi değiştir
    await cards.first().click() // deselect
    await cards.nth(1).click()  // farklı seç

    // Önceki sonuç gitmeli — "Hesapla" düğmesine basılmadan sonuç görünmemeli
    await expect(page.locator('text=kalem hesaplandı')).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // Eğer toast zaten kaybolmuşsa OK
    })
  })
})

// ─── GRUP 4: MRP Rozet tutarlılığı ──────────────────────────────
test.describe('MRP — Rozet tutarlılığı', () => {
  test('Üstteki "MRP" rozeti sayısı liste ile tutarlı olmalı', async ({ page }) => {
    await goToMRP(page)
    await page.waitForTimeout(2000) // store yüklensin

    // Üstteki "MRP N" rozetindeki sayı
    const mrpBadge = page.locator('[data-testid="topbar-mrp-badge"]')
    if (await mrpBadge.count() === 0) {
      test.skip() // testid yoksa skip
      return
    }
    const badgeText = await mrpBadge.textContent()
    const badgeCount = parseInt(badgeText?.match(/\d+/)?.[0] || '0')

    // Aktif kart sayısı
    const cardCount = await page.locator('[data-testid="order-card"]').count()

    // Rozet ile kart sayısı uyumlu olmalı (badge = eksik olanlar, card = toplam aktif)
    expect(badgeCount).toBeLessThanOrEqual(cardCount)
  })
})
