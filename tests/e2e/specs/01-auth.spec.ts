import { test, expect } from '../fixtures'
import { loginAs, clearAuth } from '../helpers/auth'

test.describe('01 — Auth ve RBAC', () => {
  test('giriş yapmadan Login ekranı görünür', async ({ page }) => {
    await clearAuth(page)
    await page.goto('/')
    // Login sayfası: h1 "ÖZLER ÜRETİM"
    await expect(page.getByRole('heading', { name: /[öo]zler [üu]retim/i })).toBeVisible({ timeout: 10_000 })
  })

  test('admin → Dashboard görünür, hassas menüler erişilebilir', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/')
    // Sidebar öğeleri <button>, <link> değil
    await expect(page.getByRole('button', { name: /veri y[öo]netimi/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /operat[öo]r/i }).first()).toBeVisible()
  })

  test('planlama → sipariş ekleyebilir, kullanıcı paneline erişemez', async ({ page }) => {
    await loginAs(page, 'planlama')
    await page.goto('/#/orders')
    // + Yeni Sipariş butonu görünmeli
    await expect(page.getByRole('button', { name: /yeni sipari[şs]/i }).first()).toBeVisible({ timeout: 10_000 })
    // Veri Yönetimi planlama'ya kapalı (varsayılan RBAC)
    await expect(page.getByRole('button', { name: /veri y[öo]netimi/i })).not.toBeVisible()
  })

  test('depocu → sipariş ekleme butonu görünmez', async ({ page }) => {
    await loginAs(page, 'depocu')
    await page.goto('/#/orders')
    // Depocu read-only — "Yeni Sipariş" butonu olmamalı
    const yeniBtn = page.getByRole('button', { name: /yeni sipari[şs]/i })
    await expect(yeniBtn).toHaveCount(0, { timeout: 5_000 })
  })
})
