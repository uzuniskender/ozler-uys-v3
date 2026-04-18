import { Page, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Test ortamı kontrolü — .env.test yüklü değilse dur
const url = process.env.VITE_SUPABASE_URL || ''
const key = process.env.VITE_SUPABASE_ANON_KEY || ''

if (!url || !key) {
  throw new Error('❌ .env.test yüklü değil veya VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY eksik')
}

// SAFETY: Canlı DB URL'ine bağlanılmadığından emin ol
// Canlı proje id: kudpuqqxxkhuxhhxqbjw — bu testlerde ASLA olmamalı
if (url.includes('kudpuqqxxkhuxhhxqbjw')) {
  throw new Error('🚨 GÜVENLİK DURDU: Testler CANLI Supabase\'e bağlanmaya çalışıyor! .env.test dosyasını kontrol et.')
}

export const supabaseTest = createClient(url, key)

export const TEST_PREFIX = 'E2E-'

/**
 * Login helper — test admin ile giriş yapar
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/')
  // Login ekranı var mı kontrol et
  const userInput = page.locator('input[placeholder*="kullanıcı"], input[name="username"]').first()
  if (await userInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await userInput.fill('admin')
    const passInput = page.locator('input[type="password"]').first()
    await passInput.fill('admin123')
    await page.locator('button:has-text("Giriş"), button[type="submit"]').first().click()
  }
  // Dashboard yüklendiğini bekle
  await page.waitForURL(/\/dashboard|\/$/, { timeout: 10_000 }).catch(() => {})
  // Topbar'da Bağlı göstergesi gelsin
  await expect(page.locator('text=Bağlı').first()).toBeVisible({ timeout: 10_000 })
}

/**
 * Test sonrası tüm E2E- önekli kayıtları temizle
 * Tablo sırası FK bağımlılığına göre: önce bağımlılar, sonra ana kayıtlar
 */
export async function cleanupTestData() {
  const tables = [
    // Bağımlılar önce
    ['uys_stok_hareketler', 'aciklama'],
    ['uys_fire_logs', 'ie_no'],
    ['uys_logs', 'ie_no'],
    ['uys_sevkler', 'siparis_no'],
    ['uys_tedarikler', 'siparis_no'],
    ['uys_active_work', 'ie_no'],
    ['uys_kesim_planlari', 'ham_malkod'],
    ['uys_operator_notes', 'mesaj'],
    ['uys_notes', 'baslik'],
    // Ana kayıtlar
    ['uys_work_orders', 'ie_no'],
    ['uys_orders', 'siparis_no'],
    ['uys_recipes', 'rc_kod'],
    ['uys_bom_trees', 'mamul_kod'],
    ['uys_malzemeler', 'kod'],
    ['uys_customers', 'ad'],
    ['uys_tedarikciler', 'ad'],
  ] as const

  for (const [table, col] of tables) {
    try {
      // E2E- prefix'li kayıtları sil
      await supabaseTest.from(table).delete().ilike(col, `${TEST_PREFIX}%`)
    } catch (e) {
      console.warn(`cleanup ${table}.${col} fail:`, e)
    }
  }

  // Ekstra: TEST-SMOKE-* prefix'li de temizle (eski test sayfasından kalma)
  for (const [table, col] of tables) {
    try {
      await supabaseTest.from(table).delete().ilike(col, 'TEST-SMOKE-%')
    } catch {}
  }
}

/**
 * E2E- önekli benzersiz id üretici
 */
export function testId(prefix: string): string {
  return TEST_PREFIX + prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5)
}

/**
 * Beklenti: toast ile görünen mesaj içinde belirli metin
 */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]', { hasText: text }).first()).toBeVisible({ timeout: 5000 })
}

/**
 * Modal kapanmasını bekle
 */
export async function waitModalClosed(page: Page) {
  await page.locator('.fixed.inset-0').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
}

/**
 * Sayfa navigate + yüklenme bekleme
 */
export async function goTo(page: Page, hash: string) {
  await page.goto('/#' + hash)
  await page.waitForLoadState('networkidle', { timeout: 10_000 })
}

/**
 * Test öncesi güvenlik kontrol: hedef DB'de E2E- önekli kayıt zaten var mı?
 * Varsa temizle, yoksa geç
 */
export async function preTestSafetyCheck() {
  const { count: woCount } = await supabaseTest.from('uys_work_orders').select('*', { count: 'exact', head: true }).ilike('ie_no', `${TEST_PREFIX}%`)
  if ((woCount || 0) > 0) {
    console.warn(`⚠ Önceki test verisi tespit edildi (${woCount} IE). Temizleniyor...`)
    await cleanupTestData()
  }
}
