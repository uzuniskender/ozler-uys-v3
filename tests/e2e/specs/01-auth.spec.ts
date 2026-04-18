import { test, expect } from '../fixtures'
import { loginAs, clearAuth } from '../helpers/auth'

test.describe('01 — Auth ve RBAC', () => {
  test('giriş yapmadan Login ekranı görünür', async ({ page }) => {
    await clearAuth(page)
    await page.goto('/')
    // useAuth getSession() async — loading state ilk geçmesi lazım.
    // En sağlamı görünen herhangi bir "ÖZLER ÜRETİM" metnine bakmak.
    await expect(page.locator('text=ÖZLER ÜRETİM').first()).toBeVisible({ timeout: 15_000 })
  })

  test('admin → Dashboard görünür, hassas menüler erişilebilir', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/')
    // Sidebar'daki "Veri Yönetimi" button — Dashboard içinde de aynı label'lı link olabildiği
    // için sadece navigation içindekini arıyoruz (strict mode violation önlemi).
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('button', { name: /veri y[öo]netimi/i })).toBeVisible({ timeout: 10_000 })
    await expect(nav.getByRole('button', { name: /operat[öo]rler/i })).toBeVisible()
  })

  test('planlama → sipariş ekleyebilir', async ({ page }) => {
    await loginAs(page, 'planlama')
    await page.goto('/#/orders')
    // Planlama sipariş ekleyebilir
    await expect(page.getByRole('button', { name: /yeni sipari[şs]/i }).first()).toBeVisible({ timeout: 10_000 })
    // NOT: planlama'nın sidebar'da "Veri Yönetimi" görünür (data_backup yetkisi var).
    // Hassas aksiyonlar (data_pass/data_reset) sayfa içinde kontrol ediliyor, sidebar
    // değil — dolayısıyla sidebar locator'ı RBAC testi için uygun değil.
  })

  test('depocu → sipariş ekleme butonu görünmez', async ({ page }) => {
    await loginAs(page, 'depocu')
    await page.goto('/#/orders')
    const yeniBtn = page.getByRole('button', { name: /yeni sipari[şs]/i })
    await expect(yeniBtn).toHaveCount(0, { timeout: 5_000 })
  })
})
