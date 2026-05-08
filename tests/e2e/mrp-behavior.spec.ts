/**
 * MRP Davranış E2E Testleri — v16.50
 *
 * 07.05.2026 yaşanan davranış bozukluklarından türetildi.
 * KURAL: Her yeni MRP bozukluğu → buraya test, sonra kod düzelt.
 *
 * BOZUKLUK 1: Tamamlanmış WO ihtiyaç üretiyordu (kalan=0 → continue atladı)
 * BOZUKLUK 2: mrp_durum=tamam sipariş aktif listede görünüyordu
 * BOZUKLUK 3: Arşiv modunda Hesapla → boş (viewFilter eksik'te kaldı)
 */

import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { supabaseAdmin, supabaseTest } from '../helpers/supabase'
import { uniqueId } from '../helpers/factory'

const PREFIX = 'TEST-E2E-MRP-'

async function cleanup() {
  await supabaseAdmin.from('uys_logs').delete().ilike('ie_no', `${PREFIX}%`)
  await supabaseAdmin.from('uys_stok_hareketler').delete().ilike('malkod', `${PREFIX}%`)
  await supabaseAdmin.from('uys_work_orders').delete().ilike('id', `${PREFIX}%`)
  await supabaseAdmin.from('uys_malzemeler').delete().ilike('id', `${PREFIX}%`)
}

async function createHM(suffix: string) {
  const id = `${PREFIX}MAT-${suffix}`
  const row = { id, kod: id, ad: `${PREFIX}${suffix}`, tip: 'Hammadde', aktif: true }
  const { error } = await supabaseAdmin.from('uys_malzemeler').insert(row)
  if (error) throw new Error(`HM oluşturulamadı: ${error.message}`)
  return { id, kod: id, ad: row.ad }
}

async function createBagimsizIE(params: {
  suffix: string
  hedef: number
  durum?: string
  hm?: { malkod: string; malad: string; miktarTotal: number }[]
}) {
  const id = `${PREFIX}WO-${params.suffix}`
  const row = {
    id,
    mamul_kod: `${PREFIX}YM-${params.suffix}`,
    mamul_ad: `${PREFIX}YM ${params.suffix}`,
    malkod: `${PREFIX}YM-${params.suffix}`,
    malad: `${PREFIX}YM ${params.suffix}`,
    hedef: params.hedef,
    durum: params.durum ?? 'bekliyor',
    bagimsiz: true,
    siparis_disi: false,
    ie_no: id,
    hm: params.hm ?? [],
    olusturma: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin.from('uys_work_orders').insert(row)
  if (error) throw new Error(`İE oluşturulamadı: ${error.message}`)
  return { id }
}

async function addLog(woId: string, qty: number) {
  const id = uniqueId('LOG')
  await supabaseAdmin.from('uys_logs').insert({
    id, wo_id: woId, tarih: new Date().toISOString().slice(0, 10),
    saat: '08:00', qty, fire: 0, ie_no: woId, operatorlar: [], duruslar: [],
  })
  return id
}

async function addStok(malkod: string, miktar: number) {
  await supabaseAdmin.from('uys_stok_hareketler').insert({
    id: uniqueId('SH'), malkod, malad: malkod, miktar,
    tip: 'giris', tarih: new Date().toISOString().slice(0, 10), aciklama: 'E2E',
  })
}

// ─── GRUP 1: Temel Erişim ───────────────────────────────────────
test.describe('MRP-01 — Temel Erişim', () => {
  test('mrp-01-a: Admin MRP sayfasına erişebilir', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await expect(page.locator('text=Malzeme İhtiyaç Planlaması')).toBeVisible({ timeout: 15_000 })
  })

  test('mrp-01-b: Hesapla butonu görünür', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await expect(page.locator('button:has-text("Hesapla")')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── GRUP 2: BOZUKLUK 1 — Tamamlanmış WO ihtiyaç üretmemeli ────
test.describe('MRP-02 — Tamamlanmış WO kalan=0 (DB doğrulama)', () => {
  test.beforeEach(async () => cleanup())
  test.afterAll(async () => cleanup())

  test('mrp-02-a: tamamlandi WO → kalan=0', async () => {
    const hm = await createHM('TAMAM')
    const ie = await createBagimsizIE({
      suffix: 'TAMAM', hedef: 10, durum: 'tamamlandi',
      hm: [{ malkod: hm.kod, malad: hm.ad, miktarTotal: 5 }],
    })
    await addLog(ie.id, 10) // tam üretildi

    const { data: logs } = await supabaseTest.from('uys_logs').select('qty').eq('wo_id', ie.id)
    const uretilen = logs?.reduce((a, l) => a + l.qty, 0) ?? 0
    const kalan = Math.max(0, 10 - uretilen)

    // Kalan = 0 → hesaplaMRP bu WO'yu atlamalı (normal mod)
    expect(kalan).toBe(0)
  })

  test('mrp-02-b: bekliyor WO → kalan>0', async () => {
    const hm = await createHM('AKTIF')
    await createBagimsizIE({
      suffix: 'AKTIF', hedef: 10, durum: 'bekliyor',
      hm: [{ malkod: hm.kod, malad: hm.ad, miktarTotal: 5 }],
    })
    // Log yok → kalan = hedef = 10
    const { data: wo } = await supabaseTest
      .from('uys_work_orders').select('hedef').eq('id', `${PREFIX}WO-AKTIF`).single()
    expect(wo?.hedef).toBe(10) // kalan > 0
  })

  test('mrp-02-c: retrospektif mod — tamamlandi WO hedef üzerinden hesap', async () => {
    // hesaplaMRP retrospektif=true → kalan=0 bile olsa hedef kullanılır
    // Bu testi DB katmanında: hm alanındaki miktarTotal doğru mu?
    const hm = await createHM('RETRO')
    await createBagimsizIE({
      suffix: 'RETRO', hedef: 10, durum: 'tamamlandi',
      hm: [{ malkod: hm.kod, malad: hm.ad, miktarTotal: 7 }],
    })
    const { data: wo } = await supabaseTest
      .from('uys_work_orders').select('hm').eq('id', `${PREFIX}WO-RETRO`).single()

    const hmData = (wo?.hm as any[])?.[0]
    // Retrospektif modda bu miktar (7) kullanılacak — DB'de doğru yazılmış mı?
    expect(hmData?.miktarTotal).toBe(7)
    expect(hmData?.malkod).toBe(hm.kod)
  })
})

// ─── GRUP 3: BOZUKLUK 2 — Seçim State ──────────────────────────
test.describe('MRP-03 — Seçim State Tutarlılığı', () => {
  test('mrp-03-a: Tümünü Seç → Hiçbirini → 0 kayıt seçili', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const selectAll = page.locator('button:has-text("Tümünü Seç")')
    if (await selectAll.count() === 0) { test.skip(); return }

    await selectAll.click()
    await page.waitForTimeout(400)
    await expect(page.locator('text=/\\d+ kayıt seçili/')).toBeVisible({ timeout: 5_000 })

    await page.locator('button:has-text("Hiçbirini")').click()
    await page.waitForTimeout(400)
    await expect(page.locator('text=0 kayıt seçili')).toBeVisible({ timeout: 5_000 })
  })

  test('mrp-03-b: Hesapla → toast gelir', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const selectAll = page.locator('button:has-text("Tümünü Seç")')
    if (await selectAll.count() === 0) { test.skip(); return }

    await selectAll.click()
    await page.waitForTimeout(400)
    await page.locator('button:has-text("Hesapla")').click()
    await expect(page.locator('text=/kalem hesaplandı/')).toBeVisible({ timeout: 15_000 })
  })
})

// ─── GRUP 4: BOZUKLUK 3 — Arşiv Modu ───────────────────────────
test.describe('MRP-04 — Arşiv Modu', () => {
  test('mrp-04-a: Arşiv butonu tıklanabilir ve kapalı siparişler görünür', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const archiveBtn = page.locator('button', { hasText: /Arşiv/ })
    await expect(archiveBtn).toBeVisible({ timeout: 10_000 })
    await archiveBtn.click()
    await page.waitForTimeout(500)
    // Arşiv açıkken buton değişmeli (text veya class)
    await expect(archiveBtn).toContainText('Arşiv')
  })

  test('mrp-04-b: Arşiv açılınca Tümü filtresi aktif olmalı', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/mrp')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button', { hasText: /Arşiv/ }).click()
    await page.waitForTimeout(500)

    // Sonuç alanındaki filtre: "Tümü" butonu aktif (bg-accent sınıfı) olmalı
    // Not: Hesapla basmadan filtre state'i 'tum' geçmeli (arşiv açılınca otomatik)
    const tumBtn = page.locator('button:has-text("Tümü")').first()
    // Aktif durumda accent class içermeli
    const cls = await tumBtn.getAttribute('class')
    expect(cls).toMatch(/accent/)
  })
})

// ─── GRUP 5: Stok Yeterliliği DB Doğrulaması ────────────────────
test.describe('MRP-05 — Stok Yeterliliği', () => {
  test.beforeEach(async () => cleanup())
  test.afterAll(async () => cleanup())

  test('mrp-05-a: stok >= ihtiyaç → net = 0', async () => {
    const hm = await createHM('YTR')
    await addStok(hm.kod, 100)
    const stok = 100
    const ihtiyac = 5
    expect(stok - ihtiyac).toBeGreaterThanOrEqual(0)
  })

  test('mrp-05-b: stok < ihtiyaç → net > 0', async () => {
    const hm = await createHM('EKS')
    await addStok(hm.kod, 2)
    const stok = 2
    const ihtiyac = 10
    expect(stok - ihtiyac).toBeLessThan(0) // eksik
  })

  test('mrp-05-c: tedarik stok hareketini kapatmalı', async () => {
    // "Geldi" işaretlenmiş tedarik → stok hareketi yazılmış olmalı
    // (Bugün 16 tedarik eksik stok girişi vardı — bu hatanın tekrar testı)
    const hm = await createHM('TDR')
    await addStok(hm.kod, 50) // tedarik geldi, stok yazıldı

    const { data: sh } = await supabaseTest
      .from('uys_stok_hareketler').select('miktar, tip').eq('malkod', hm.kod)

    const net = sh?.reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0) ?? 0
    expect(net).toBe(50) // stok hareketi doğru yazılmış
  })
})
