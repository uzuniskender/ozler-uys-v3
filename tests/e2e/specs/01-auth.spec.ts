import { test, expect } from '../fixtures'
import { loginAs, clearAuth } from '../helpers/auth'

test.describe('01 — Auth ve RBAC', () => {
  test('giriş yapmadan Login ekranı görünür', async ({ page }) => {
    await clearAuth(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /giri[şs]/i })).toBeVisible({ timeout: 10_000 })
  })

  test('admin → Dashboard görünür, hassas menüler erişilebilir', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/')
    // Sidebar'da Veri Yönetimi admin'e görünmeli
    await expect(page.getByRole('link', { name: /veri y[öo]netimi/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: /kullan[ıi]c[ıi]/i })).toBeVisible()
  })

  test('planlama → sipariş ekleyebilir, kullanıcı paneline erişemez', async ({ page }) => {
    await loginAs(page, 'planlama')
    await page.goto('/#/orders')
    // + Yeni sipariş butonu görünmeli
    await expect(page.getByRole('button', { name: /\+ ?yeni|yeni sipari[şs]/i }).first()).toBeVisible({ timeout: 10_000 })
    // Veri Yönetimi planlama'ya kapalı (varsayılan RBAC)
    await expect(page.getByRole('link', { name: /veri y[öo]netimi/i })).not.toBeVisible()
  })

  test('depocu → sipariş ekleme butonu görünmez', async ({ page }) => {
    await loginAs(page, 'depocu')
    await page.goto('/#/orders')
    // Depocu read-only
    const yeniBtn = page.getByRole('button', { name: /\+ ?yeni sipari[şs]/i })
    await expect(yeniBtn).toHaveCount(0, { timeout: 5_000 })
  })
})
