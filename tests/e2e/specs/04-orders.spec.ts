import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { uniqueId } from '../helpers/factory'
import { supabaseAdmin } from '../helpers/supabase'

async function createTestOrder(overrides: Record<string, unknown> = {}) {
  const id = uniqueId('ORD')
  const row = {
    id,
    siparis_no: id,
    musteri: 'TEST-E2E-Müşteri',
    mamul_kod: 'TEST-MAT',
    mamul_ad: 'Test Mamul',
    adet: 10,
    termin: '2026-12-31',
    durum: '',
    olusturma: new Date().toISOString(),
    ...overrides,
  }
  const { error } = await supabaseAdmin.from('uys_orders').insert(row)
  if (error) throw new Error(`Sipariş oluşturulamadı: ${error.message}`)
  return row
}

test.describe('04 — Sipariş Yönetimi', () => {
  test('DB sipariş Siparişler listesinde görünür (aktif filtre)', async ({ page }) => {
    const ord = await createTestOrder()

    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Default statusFilter = active + late; durum='' ve state=yeni → aktif eşleşir
    // Sipariş No sütununda monospace button olarak render edilir
    const sipBtn = page.locator('button', { hasText: ord.siparis_no }).first()
    await expect(sipBtn).toBeVisible({ timeout: 10_000 })
  })

  test('"Yeni İş Emri" modalı açılır, İptal ile kapatılır', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni İş Emri")').click()
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).toBeVisible({ timeout: 5_000 })

    await page.getByRole('button', { name: 'İptal', exact: true }).click()
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).not.toBeVisible({ timeout: 5_000 })
  })

  test('planlama kullanıcısı "Yeni İş Emri" görebilir', async ({ page }) => {
    await loginAs(page, 'planlama')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await expect(page.locator('button:has-text("Yeni İş Emri")').first()).toBeVisible({ timeout: 10_000 })
  })

  test('depocu "Yeni İş Emri" butonunu göremez (RBAC)', async ({ page }) => {
    await loginAs(page, 'depocu')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await expect(page.locator('button:has-text("Yeni İş Emri")')).toHaveCount(0, { timeout: 5_000 })
  })
})
