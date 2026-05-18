import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { uniqueId } from '../helpers/factory'
import { supabaseAdmin } from '../helpers/supabase'

// ─── Factory Helpers ───────────────────────────────────────────────────────

async function createOrder(overrides: Record<string, unknown> = {}) {
  const id = uniqueId('ORD')
  const row = {
    id,
    siparis_no: id,
    musteri: 'TEST-E2E-Müşteri',
    mamul_kod: 'TEST-E2E-MAMUL',
    mamul_ad: 'TEST-E2E-Mamul',
    adet: 5,
    termin: '2026-12-31',
    durum: '',
    olusturma: new Date().toISOString(),
    ...overrides,
  }
  const { error } = await supabaseAdmin.from('uys_orders').insert(row)
  if (error) throw new Error(`Sipariş oluşturulamadı: ${error.message}`)
  return row
}

async function createMaterial() {
  const id = uniqueId('MAT')
  const row = { id, kod: id, ad: `TEST-E2E-Hammadde`, tip: 'Hammadde' }
  const { error } = await supabaseAdmin.from('uys_malzemeler').insert(row)
  if (error) throw new Error(`Malzeme oluşturulamadı: ${error.message}`)
  return row
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe('04 — Sipariş → MRP → Tedarik → Sevkiyat Tam Akış', () => {

  // ── 1. Sipariş oluştur ──────────────────────────────────────────────────

  test('1. Yeni İş Emri modal açılır, tür tikleri görünür, müşteri SearchSelect açılır, İptal kapatır', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni İş Emri")').click()
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).toBeVisible({ timeout: 5_000 })

    // Form varsayılan olarak "Müşteri yok / Stok için" tikli açılır
    await expect(page.locator('text=Müşteri yok')).toBeVisible()

    // İsStokIE tikini kaldırınca müşteri SearchSelect görünür
    const stokIETick = page.locator('input[type="checkbox"]').nth(1)
    await stokIETick.uncheck()
    await expect(page.locator('input[placeholder="Müşteri ara veya yaz..."]')).toBeVisible({ timeout: 3_000 })

    await page.getByRole('button', { name: 'İptal', exact: true }).click()
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).not.toBeVisible({ timeout: 5_000 })
  })

  test('2. DB siparişi Siparişler listesinde görünür (aktif filtre)', async ({ page }) => {
    const ord = await createOrder()

    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Sipariş No sütununda monospace button olarak render edilir
    const sipBtn = page.locator('button', { hasText: ord.siparis_no }).first()
    await expect(sipBtn).toBeVisible({ timeout: 10_000 })
  })

  // ── 3. MRP hesapla ──────────────────────────────────────────────────────

  test('3. MRP: sipariş seçilip Hesapla çalıştırılır, sonuç bölümü görünür', async ({ page }) => {
    const ord = await createOrder()

    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const orderCard = page.locator('[data-testid="order-card"]', { hasText: ord.siparis_no })
    await expect(orderCard).toBeVisible({ timeout: 10_000 })
    await orderCard.click()

    // Seçim onayı
    await expect(page.locator('text=1 kayıt seçili')).toBeVisible({ timeout: 3_000 })

    // Hesapla enabled → tıkla
    const hesaplaBtn = page.locator('button:has-text("Hesapla")')
    await expect(hesaplaBtn).toBeEnabled()
    await hesaplaBtn.click()

    // Sonuç bölümü: "X eksik" veya "X yeterli" filtreleme butonları belirir
    await expect(page.locator('button', { hasText: /\d+ eksik/ }).first()).toBeVisible({ timeout: 15_000 })
  })

  // ── 4. Tedarik ekle ─────────────────────────────────────────────────────

  test('4. Yeni Tedarik: modal → malkod + miktar → Kaydet → listede görünür', async ({ page }) => {
    const mat = await createMaterial()

    await loginAs(page, 'admin')
    await page.goto('/#/procurement')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni Tedarik")').click()
    await expect(page.locator('h2:has-text("Yeni Tedarik")')).toBeVisible({ timeout: 5_000 })

    // Malzeme kodu: allowNew=true (varsayılan) → fill() tetikler onChange(val,val) → malkod set edilir
    const malkodInput = page.locator('input[placeholder="Malzeme kodu ara..."]')
    await malkodInput.fill(mat.kod)

    // Dropdown'u kapat + miktar gir
    const miktarInput = page.locator('input[type="number"]').first()
    await miktarInput.click()
    await miktarInput.fill('10')

    await page.locator('button:has-text("Kaydet")').click()

    // Modal kapanmalı (kayıt başarılı)
    await expect(page.locator('h2:has-text("Yeni Tedarik")')).not.toBeVisible({ timeout: 8_000 })

    // Store'da 30s TTL cache var — loadAllStores() kayıt sonrası cache nedeniyle geç yükler.
    // Sayfa yenileme JS state'i sıfırlar → fresh fetch → yeni tedarik listede görünür.
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await expect(page.locator('td', { hasText: mat.kod }).first()).toBeVisible({ timeout: 10_000 })
  })

  // ── 5. Sevkiyat yap ─────────────────────────────────────────────────────

  test('5. Yeni Sevkiyat: sipariş ara → auto-fill kalem → Oluştur → müşteri grubunda görünür', async ({ page }) => {
    // adet:5 → kısmi sevk (2 adet) → tamamen_sevk olmaz → arşive düşmez → listede görünür
    const ord = await createOrder({ adet: 5 })

    await loginAs(page, 'admin')
    await page.goto('/#/shipment')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni Sevkiyat")').click()
    await expect(page.locator('h2:has-text("Yeni Sevkiyat")')).toBeVisible({ timeout: 5_000 })

    // Sipariş arama — yaz ve dropdown'dan seç
    // onMouseDown handler kullanıldığından .click() mousedown'ı önce tetikler
    const orderSearchInput = page.locator('input[placeholder="Sipariş no veya müşteri ara..."]')
    await orderSearchInput.fill(ord.siparis_no)
    const orderOption = page.locator('button', { hasText: ord.siparis_no }).first()
    await expect(orderOption).toBeVisible({ timeout: 5_000 })
    await orderOption.click()

    // Bakiye bilgisi: Kalan 5 adet
    await expect(page.locator('text=Kalan: 5 adet')).toBeVisible({ timeout: 5_000 })

    // Kalemler auto-fill: mamulKod ile doldurulmalı
    await expect(page.locator('input[placeholder="Malzeme kodu"]').first()).toHaveValue(ord.mamul_kod, { timeout: 3_000 })

    // Miktar'ı 2'ye indir (kısmi sevk — sipariş tamamen_sevk olmayacak, arşive düşmeyecek)
    await page.locator('input[type="number"]').first().fill('2')

    // TEST-E2E-MAMUL stok hareketi yok → stok çıkışı kontrolü fail eder → kapat
    await page.locator('label:has-text("stok çıkışı")').locator('input[type="checkbox"]').uncheck()

    // Oluştur
    await page.locator('button:has-text("Oluştur")').click()

    // Modal kapanmalı (kayıt başarılı)
    await expect(page.locator('h2:has-text("Yeni Sevkiyat")')).not.toBeVisible({ timeout: 10_000 })

    // Store'da 30s TTL cache var → sayfa yenileme cache'i sıfırlar → fresh fetch
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Müşteri grup başlığı satırı her zaman görünür (collapsed bile olsa header tr gösterilir)
    await expect(page.locator('tr', { hasText: ord.musteri }).first()).toBeVisible({ timeout: 10_000 })
  })

  // ── 6. Tamamlandı durumu doğrula ────────────────────────────────────────

  test('6. Tamamen sevk edilen sipariş ✓ Tamam badge gösterir', async ({ page }) => {
    // sevk_durum = 'tamamen_sevk' doğrudan DB'ye yazılır → mapper okur → badge render edilir
    const ord = await createOrder({ adet: 3, sevk_durum: 'tamamen_sevk' })

    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const row = page.locator('tr', { hasText: ord.siparis_no }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.locator('text=✓ Tamam')).toBeVisible({ timeout: 5_000 })
  })

  // ── 7–8. RBAC ───────────────────────────────────────────────────────────

  test('7. depocu "Yeni İş Emri" butonunu göremez (RBAC)', async ({ page }) => {
    await loginAs(page, 'depocu')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await expect(page.locator('button:has-text("Yeni İş Emri")')).toHaveCount(0, { timeout: 5_000 })
  })

  test('8. planlama "Yeni İş Emri" görebilir (RBAC)', async ({ page }) => {
    await loginAs(page, 'planlama')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await expect(page.locator('button:has-text("Yeni İş Emri")').first()).toBeVisible({ timeout: 10_000 })
  })
})
