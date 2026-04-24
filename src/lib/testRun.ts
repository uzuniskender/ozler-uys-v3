// ═══ TEST MODU — v15.37 ═══
// Test sırasında oluşan tüm kayıtlara `test_run_id` etiketi eklenir.
// Test sonlandırılınca cascade delete ile sadece o etiketli kayıtlar silinir.
//
// Aktif test run'ı tutmak için: localStorage['uys_active_test_run_id']
// Bu değer varsa kayıt oluşturan her fonksiyon (Orders, WorkOrders, vb.) otomatik ekler.

import { supabase } from './supabase'
import { today } from './utils'
import type { TestRun } from '@/types'

const TABLE = 'uys_test_runs'
const LS_KEY = 'uys_active_test_run_id'

/** Aktif test run ID'sini localStorage'dan al (kayıt oluşturucular kullanır) */
export function getActiveTestRunId(): string | null {
  try { return localStorage.getItem(LS_KEY) } catch { return null }
}

/** Aktif test run'ı set et (veya null = kapat) */
export function setActiveTestRunId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LS_KEY, id)
    else localStorage.removeItem(LS_KEY)
  } catch {}
}

/** Yeni test_run_id üret: TEST_YYYYMMDD_NN (var olanlara göre N artırılır) */
export async function newTestRunId(): Promise<string> {
  const tarih = today().replace(/-/g, '')
  const { data } = await supabase
    .from(TABLE)
    .select('id')
    .like('id', `TEST_${tarih}_%`)
  const nums = (data || [])
    .map(r => parseInt(((r as any).id || '').split('_')[2] || '0'))
    .filter(n => !isNaN(n))
  const next = (Math.max(0, ...nums) + 1).toString().padStart(2, '0')
  return `TEST_${tarih}_${next}`
}

/** Test modu başlat — DB kaydı oluştur + localStorage set */
export async function startTestRun(params: {
  userId: string
  userAd: string
  aciklama?: string
}): Promise<TestRun | null> {
  // Daha önce aktif bir test varsa uyar (caller UI'da kontrol etmeli, burası guardrail)
  const mevcut = getActiveTestRunId()
  if (mevcut) {
    console.warn('[testRun] Zaten aktif test var:', mevcut)
    return null
  }

  const id = await newTestRunId()
  const now = new Date().toISOString()
  const { error } = await supabase.from(TABLE).insert({
    id,
    baslangic: now,
    durum: 'aktif',
    user_id: params.userId,
    user_ad: params.userAd,
    aciklama: params.aciklama || '',
    temizlenen_kayit_sayisi: {},
    not_: '',
  })
  if (error) { console.error('[testRun] start:', error); return null }

  setActiveTestRunId(id)
  return {
    id,
    baslangic: now,
    bitis: '',
    durum: 'aktif',
    userId: params.userId,
    userAd: params.userAd,
    aciklama: params.aciklama || '',
    temizlenenKayitSayisi: {},
    not: '',
  }
}

// Cascade delete için tablo listesi — test_run_id kolonu olan tüm tablolar
// Sıra: bağımlılıklar önce (child → parent değil, delete sırası önemli değil çünkü FK yok)
const TABLE_CASCADE = [
  'uys_logs',               // üretim girişleri
  'uys_stok_hareketler',    // stok hareketleri
  'uys_fire_logs',          // fire kayıtları
  'uys_active_work',        // aktif çalışma
  'uys_mrp_rezerve',        // rezerveler
  'uys_tedarikler',         // tedarikler
  'uys_acik_barlar',        // açık bar havuzu
  'uys_sevkler',            // sevkler
  'uys_kesim_planlari',     // kesim planları
  'uys_work_orders',        // iş emirleri
  'uys_orders',             // siparişler (en son, diğerleri buna ref eder)
]

/** Cascade delete — sadece bu test_run_id'ye ait kayıtları sil */
export async function cascadeDeleteTestRun(testRunId: string): Promise<Record<string, number>> {
  const sayilar: Record<string, number> = {}
  for (const tablo of TABLE_CASCADE) {
    // Önce say (before state için)
    const { count: oncesi } = await supabase
      .from(tablo)
      .select('*', { count: 'exact', head: true })
      .eq('test_run_id', testRunId)
    // Sil
    const { error } = await supabase.from(tablo).delete().eq('test_run_id', testRunId)
    if (error) {
      console.error(`[testRun] ${tablo} delete:`, error)
      sayilar[tablo] = -1
    } else {
      sayilar[tablo] = oncesi || 0
    }
  }
  return sayilar
}

/** Test modu sonlandır — cascade delete + DB kaydı güncelle + localStorage temizle */
export async function finishTestRun(testRunId: string, opts?: { cleanup?: boolean }): Promise<{
  ok: boolean
  silinen: Record<string, number>
}> {
  const cleanup = opts?.cleanup !== false  // default true

  let silinen: Record<string, number> = {}
  if (cleanup) {
    // v15.37 v2: Parent + sub-run'ları (s1, s2, s3, s4, s5) hepsini temizle
    const tumIds = [testRunId,
      `${testRunId}_s1`, `${testRunId}_s2`, `${testRunId}_s3`,
      `${testRunId}_s4`, `${testRunId}_s5`]
    for (const id of tumIds) {
      const part = await cascadeDeleteTestRun(id)
      // Topla
      for (const [tablo, n] of Object.entries(part)) {
        silinen[tablo] = (silinen[tablo] || 0) + (n > 0 ? n : 0)
      }
    }
  }

  const { error } = await supabase.from(TABLE).update({
    durum: 'tamamlandi',
    bitis: new Date().toISOString(),
    temizlenen_kayit_sayisi: silinen,
  }).eq('id', testRunId)

  setActiveTestRunId(null)

  if (error) { console.error('[testRun] finish:', error); return { ok: false, silinen } }
  return { ok: true, silinen }
}

/** Test modu iptal et — cleanup yapmadan sadece etiket kaldır (içerik canlıda kalır) */
export async function cancelTestRun(testRunId: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).update({
    durum: 'iptal',
    bitis: new Date().toISOString(),
  }).eq('id', testRunId)
  setActiveTestRunId(null)
  if (error) { console.error('[testRun] cancel:', error); return false }
  return true
}

/** Kayıt olmadan sadece aktif test_run_id'yi geçici set et (senaryo runner içi) */
export function tempSetActiveTestRunId(id: string | null): void {
  setActiveTestRunId(id)
}

/**
 * Yardımcı: bir kayıt insert'inde test_run_id kolonunu ekle.
 * Kullanım: supabase.from('uys_orders').insert(withTestRunId({ id, siparis_no, ... }))
 */
export function withTestRunId<T extends Record<string, unknown>>(row: T): T & { test_run_id?: string | null } {
  const trId = getActiveTestRunId()
  if (!trId) return row  // aktif test yoksa dokunma
  return { ...row, test_run_id: trId }
}

/**
 * Toplu insert için yardımcı: her satıra test_run_id ekle
 */
export function withTestRunIdAll<T extends Record<string, unknown>>(rows: T[]): (T & { test_run_id?: string | null })[] {
  const trId = getActiveTestRunId()
  if (!trId) return rows
  return rows.map(r => ({ ...r, test_run_id: trId }))
}
